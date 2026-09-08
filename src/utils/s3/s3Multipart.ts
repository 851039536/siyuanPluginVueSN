/**
 * S3 Multipart 分片上传编排（共享层）
 *
 * 基于 S3Client.sendRequest 与 s3Protocol 纯函数实现 CreateMultipartUpload /
 * UploadPart / CompleteMultipartUpload / AbortMultipartUpload，对外提供
 * uploadFileSmart 大文件感知入口：>100MB 自动 fd 定位读 16MB 分片上传，
 * 存储端不支持 Multipart（OpenList/Alist 等代理）时自动降级整包单 PUT。
 */
import type { S3Client } from "./s3Client"
import { MSG_DESKTOP_ONLY, MULTIPART_MIN_SIZE, MULTIPART_PART_SIZE } from "./types"
import { getNodeModules } from "@/utils/nodeModules"
import type { MultipartPart } from "./s3Protocol"
import { buildCompleteMultipartBody, formatS3Error, parseSingleTag } from "./s3Protocol"

/** Multipart 协议不被存储端支持的降级信号（initiate 阶段判定，交由调用方回退单 PUT） */
export class MultipartUnsupportedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MultipartUnsupportedError"
  }
}

/** 获取原始 fs 模块（FileHandle 定位读分片用） */
function requireFsRaw() {
  const node = getNodeModules()
  if (!node) {
    throw new Error(MSG_DESKTOP_ONLY)
  }
  return node.fs
}

/** 判定是否「协议不支持」（HTTP 405/501 或 XML Code 为 NotImplemented 等方法集类错误） */
function isMultipartUnsupported(status: number, xml: string): boolean {
  if (status === 405 || status === 501) { return true }
  return /<Code>(NotImplemented|MethodNotAllowed|UnsupportedOperation)<\/Code>/.test(xml)
}

/**
 * 初始化分片上传（POST ?uploads），返回 UploadId
 * 存储端不支持时抛 MultipartUnsupportedError（不抛普通错误，供 uploadFileSmart 判定降级）
 */
export async function initiateMultipartUpload(client: S3Client, key: string): Promise<string> {
  // 查询串传 "uploads="：SigV4 canonical query 对空值参数需带 =，与服务端重算签名保持一致
  const response = await client.sendRequest("POST", key, "uploads=")
  const xml = await response.text()
  if (!response.ok) {
    const message = formatS3Error(response, xml, "S3 初始化分片上传失败")
    if (isMultipartUnsupported(response.status, xml)) {
      throw new MultipartUnsupportedError(message)
    }
    throw new Error(message)
  }
  const uploadId = parseSingleTag(xml, "UploadId")
  if (!uploadId) {
    throw new Error("S3 初始化分片上传失败: 响应缺少 UploadId")
  }
  return uploadId
}

/**
 * 上传单个分片（PUT ?partNumber=N&uploadId=…），返回服务端 ETag
 * onProgress 以本分片为 total（sent=本片已发字节数），片内由 256KB 分块写入平滑上报
 */
export async function uploadPart(
  client: S3Client,
  key: string,
  uploadId: string,
  partNumber: number,
  body: Buffer,
  onProgress?: (sent: number, total: number) => void,
): Promise<string> {
  const query = `partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`
  const response = await client.sendRequest("PUT", key, query, { body, onProgress })
  if (!response.ok) {
    const xml = await response.text()
    throw new Error(formatS3Error(response, xml, `S3 分片 ${partNumber} 上传失败`))
  }
  // ETag 优先取响应头（Node http 头 key 小写）；部分兼容实现将其放入响应体
  const headerEtag = (response.headers?.["etag"] ?? "").replace(/^"|"$/g, "")
  if (headerEtag) { return headerEtag }
  const xml = await response.text()
  const bodyEtag = parseSingleTag(xml, "ETag")
  if (bodyEtag) { return bodyEtag }
  throw new Error(`S3 分片 ${partNumber} 上传失败: 响应缺少 ETag`)
}

/**
 * 完成分片上传（POST ?uploadId= + XML 分片清单）
 * 仿 copyObject 已知行为：AWS 连接保活时可能先回 200 再在 body 报内嵌 <Error>
 */
export async function completeMultipartUpload(
  client: S3Client,
  key: string,
  uploadId: string,
  parts: MultipartPart[],
): Promise<void> {
  const body = Buffer.from(buildCompleteMultipartBody(parts), "utf-8")
  const query = `uploadId=${encodeURIComponent(uploadId)}`
  const response = await client.sendRequest("POST", key, query, { body })
  const xml = await response.text()
  if (!response.ok) {
    throw new Error(formatS3Error(response, xml, "S3 完成分片上传失败"))
  }
  if (xml && /<Error>/.test(xml) && !/<CompleteMultipartUploadResult/.test(xml)) {
    throw new Error(`S3 完成分片上传失败: ${xml.slice(0, 200)}`)
  }
}

/** 中止分片上传（DELETE ?uploadId=，best-effort 清理，失败仅告警） */
export async function abortMultipartUpload(client: S3Client, key: string, uploadId: string): Promise<void> {
  const query = `uploadId=${encodeURIComponent(uploadId)}`
  const response = await client.sendRequest("DELETE", key, query)
  if (!response.ok && response.status !== 204) {
    const xml = await response.text()
    console.warn(`[S3] 中止分片上传失败（可忽略，服务端会按生命周期清理）: ${formatS3Error(response, xml, "S3 中止分片上传失败")}`)
  }
}

/**
 * 分片上传编排：对 >MULTIPART_MIN_SIZE 的本地文件流式分片上传
 * fd 定位读 + 复用单片 Buffer，内存峰值 ≈ 单片大小；失败先 abort 会话再抛错交外层整文件重试
 * onProgress 以文件总字节为 total，跨片累计上报（片内 256KB 分块写平滑）
 */
export async function uploadFileMultipart(
  client: S3Client,
  filePath: string,
  key: string,
  fileSize: number,
  onProgress?: (sent: number, total: number) => void,
): Promise<void> {
  const fs = requireFsRaw()
  const uploadId = await initiateMultipartUpload(client, key)

  const part = Buffer.allocUnsafe(MULTIPART_PART_SIZE)
  const parts: MultipartPart[] = []
  let fd: import("node:fs/promises").FileHandle | null = null
  let partNumber = 1
  let position = 0
  try {
    // open 也纳入 try：失败（如文件在 stat 后消失）时仍 abort 会话，不留孤儿分片
    fd = await fs.promises.open(filePath, "r")
    // 串行逐片：每片独立签名上传（await 完成后才覆写复用 Buffer，无并发写坏风险）
    while (position < fileSize) {
      const readLen = Math.min(MULTIPART_PART_SIZE, fileSize - position)
      const { bytesRead } = await fd.read(part, 0, readLen, position)
      if (bytesRead <= 0) {
        throw new Error(`S3 分片 ${partNumber} 读取失败: 文件 ${filePath} 提前结束`)
      }
      const slice = bytesRead === MULTIPART_PART_SIZE ? part : Buffer.from(part.subarray(0, bytesRead))
      const partStart = position
      const etag = await uploadPart(
        client, key, uploadId, partNumber, slice,
        onProgress ? (sent) => onProgress(partStart + sent, fileSize) : undefined,
      )
      parts.push({ partNumber, etag })
      partNumber++
      position += bytesRead
      onProgress?.(position, fileSize)
    }
    await completeMultipartUpload(client, key, uploadId, parts)
  } catch (err) {
    // 传输/完成失败：清理已建会话后抛原始错误，交外层 TRANSFER_MAX_RETRIES 整文件重试
    await abortMultipartUpload(client, key, uploadId).catch(() => { /* abort 自身失败仅告警已处理 */ })
    throw err
  } finally {
    await fd?.close().catch(() => { /* 关闭失败可忽略 */ })
  }
}

/**
 * 大文件感知上传入口（s3Backup 三条上传路径共用）
 * ≤MULTIPART_MIN_SIZE：整包 readFile + uploadBuffer（恒传进度回调 → 256KB 分块写，规避 req.write 整写双倍驻留）；
 * >MULTIPART_MIN_SIZE：走 Multipart 分片；存储端不支持（MultipartUnsupportedError）时降级整包单 PUT 并给出保留语义的警告
 */
export async function uploadFileSmart(
  client: S3Client,
  filePath: string,
  key: string,
  onProgress?: (sent: number, total: number) => void,
): Promise<void> {
  const fs = requireFsRaw()
  const stats = await fs.promises.stat(filePath)

  if (stats.size <= MULTIPART_MIN_SIZE) {
    const content = await fs.promises.readFile(filePath)
    await client.uploadBuffer(content, key, onProgress ?? (() => { /* 恒传回调使分块写入生效 */ }))
    return
  }

  try {
    await uploadFileMultipart(client, filePath, key, stats.size, onProgress)
  } catch (err) {
    if (err instanceof MultipartUnsupportedError) {
      console.warn(`[S3] 大文件整体读入内存上传: ${key}（${stats.size} 字节，存储端不支持 Multipart，已降级单 PUT）`)
      const content = await fs.promises.readFile(filePath)
      await client.uploadBuffer(content, key, onProgress ?? (() => { /* 恒传回调使分块写入生效 */ }))
      return
    }
    throw err
  }
}
