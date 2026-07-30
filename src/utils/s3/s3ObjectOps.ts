/**
 * S3 扩展对象操作（共享层）
 *
 * 基于 S3Client.sendRequest 的目录式列举（delimiter=/）、对象复制（CopyObject）
 * 与文件夹占位对象创建。独立模块承载以避免 s3Client.ts 突破单文件行数阈值。
 */
import type { S3Client } from "./s3Client"
import { MAX_LIST_PAGES } from "./s3Client"
import type { S3FileInfo } from "./types"
import { parseListDirXml, formatS3Error } from "./s3Protocol"

// ========== 目录式列举 ==========

/** listDir 聚合结果：当前层文件 + 子目录前缀 */
export interface S3DirListing {
  /** 当前层文件（不含子目录内对象） */
  files: S3FileInfo[]
  /** 子目录前缀（以 / 结尾，如 "photos/2026/"） */
  folders: string[]
}

/**
 * 目录式列举：ListObjects V1 + delimiter=/，仅返回 prefix 直接子层的文件与子目录
 * （沿用 V1 规避 OpenList/Alist 等代理对 V2 的兼容风险），marker 自动翻页聚合
 */
export async function listDir(client: S3Client, prefix: string): Promise<S3DirListing> {
  const files: S3FileInfo[] = []
  const folderSet = new Set<string>()
  let marker = ""

  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    let query = `delimiter=${encodeURIComponent("/")}&max-keys=1000&prefix=${encodeURIComponent(prefix)}`
    if (marker) {
      query += `&marker=${encodeURIComponent(marker)}`
    }

    const response = await client.sendRequest("GET", "", query)
    if (!response.ok) {
      const body = await response.text()
      throw new Error(formatS3Error(response, body, "S3 目录列举失败"))
    }

    const { files: pageFiles, folders, isTruncated, nextMarker } = parseListDirXml(await response.text())
    // 过滤当前目录自身的占位对象（key 与 prefix 相同，通常为 0 字节文件夹标记）
    files.push(...pageFiles.filter((f) => f.key !== prefix))
    for (const folder of folders) {
      // 过滤后端回显的当前目录自身与不属于本层的异常前缀（OpenList/Alist 等代理会回显 prefix 自身导致目录自嵌套）
      if (folder === prefix || !folder.startsWith(prefix)) { continue }
      folderSet.add(folder)
    }

    if (!isTruncated || !nextMarker) {
      return { files, folders: [...folderSet] }
    }
    marker = nextMarker
  }

  console.warn(`[S3] 目录列举超过 ${MAX_LIST_PAGES} 页上限，返回已收集的 ${files.length} 条（结果可能不完整）`)
  return { files, folders: [...folderSet] }
}

// ========== 对象复制 ==========

/**
 * 服务端复制对象（PUT + x-amz-copy-source 头）
 * 复制源必须与签名路径同规则编码（encodeCopySource 复用 encodeKeyPath），
 * 且该头进入 SigV4 签名头集合，否则中文/空格 key 触发 403 SignatureDoesNotMatch
 */
export async function copyObject(client: S3Client, srcKey: string, destKey: string): Promise<void> {
  const response = await client.sendRequest("PUT", destKey, "", {
    extraHeaders: { "x-amz-copy-source": client.encodeCopySource(srcKey) },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(formatS3Error(response, body, "S3 复制对象失败"))
  }
  // CopyObject 的错误可能藏在 200 响应体中（AWS 已知行为：连接保活时先回 200 再在 body 报错）
  const text = await response.text()
  if (text && /<Error>/.test(text) && !/<CopyObjectResult/.test(text)) {
    throw new Error(`S3 复制对象失败: ${text.slice(0, 200)}`)
  }
}

// ========== 文件夹占位对象 ==========

/**
 * 创建文件夹（PUT 0 字节、key 以 / 结尾的占位对象，S3 通行约定）
 */
export async function createFolder(client: S3Client, folderPrefix: string): Promise<void> {
  const key = folderPrefix.endsWith("/") ? folderPrefix : `${folderPrefix}/`
  const response = await client.sendRequest("PUT", key, "", { body: Buffer.alloc(0) })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(formatS3Error(response, body, "S3 创建文件夹失败"))
  }
}
