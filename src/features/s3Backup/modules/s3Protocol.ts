/**
 * S3 协议层纯函数
 *
 * 与 S3Client 类解耦的无状态实现：AWS SigV4 签名（哈希/HMAC/CanonicalRequest）、
 * amz 时间戳生成、ListObjects/错误响应 XML 解析、请求体分块写入与
 * NodeResponse 兼容接口定义。
 */
import type { S3FileInfo } from "../types"
import { MSG_DESKTOP_ONLY } from "../types"
import { getNodeCrypto } from "@/utils/nodeModules"
import { padNum } from "../utils"

// ========== 哈希 / HMAC ==========

/** 获取 crypto 模块（仅 Electron/Node.js 环境可用） */
function requireCrypto() {
  const node = getNodeCrypto()
  if (!node) {
    throw new TypeError(MSG_DESKTOP_ONLY)
  }
  return node.crypto
}

/** SHA256 哈希，返回 hex 字符串 */
export function sha256Hex(data: string | Buffer): string {
  return requireCrypto().createHash("sha256").update(data).digest("hex")
}

/** HMAC-SHA256，返回 Buffer */
export function hmacSha256(key: Buffer | string, data: string): Buffer {
  const keyBuf = typeof key === "string" ? Buffer.from(key, "utf-8") : key
  return requireCrypto().createHmac("sha256", keyBuf).update(data).digest()
}

/** HMAC-SHA256，返回 hex 字符串 */
export function hmacSha256Hex(key: Buffer | string, data: string): string {
  return hmacSha256(key, data).toString("hex")
}

// ========== 时间 ==========

/** 生成 ISO 8601 时间戳 (YYYYMMDDTHHMMSSZ) */
export function amzDate(d: Date): string {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

/** 生成日期戳 (YYYYMMDD) */
export function dateStamp(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "")
}

/** 将 S3 UTC ISO 时间字符串转为 UTC 时间字符串（避免 formatTime 二次转本地时区） */
export function utcToUtcString(utcIso: string): string {
  const d = new Date(utcIso)
  if (isNaN(d.getTime())) return utcIso
  return `${d.getUTCFullYear()}-${padNum(d.getUTCMonth() + 1)}-${padNum(d.getUTCDate())} ${padNum(d.getUTCHours())}:${padNum(d.getUTCMinutes())}:${padNum(d.getUTCSeconds())}`
}

/**
 * 将 LastModified 的 UTC 墙钟字段按本地时区重组为 epoch 毫秒
 * OpenList/Alist 等代理返回的实为本地墙钟时间误标 Z；展示串（utcToUtcString）已按墙钟原样口径，
 * epoch 必须同口径重组，否则相对时间会比展示的绝对时间偏移一个时区（如显示"8小时后"）
 */
export function utcWallClockToLocalEpoch(utcIso: string): number {
  const d = new Date(utcIso)
  if (isNaN(d.getTime())) return NaN
  return new Date(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
  ).getTime()
}

// ========== XML 解析 ==========

/** 反转义 XML 预定义实体（S3 响应中 Key 含 & < > " ' 时被转义，须还原后才能用于后续请求） */
function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

/** ListObjects 单页解析结果 */
export interface ListObjectsPage {
  files: S3FileInfo[]
  /** 是否还有后续分页（<IsTruncated>true</IsTruncated>） */
  isTruncated: boolean
  /** 下一页起始 marker：优先 <NextMarker>，缺失时取本页最后一个 Key（V1 未开 delimiter 不返回 NextMarker） */
  nextMarker: string
}

/** 解析 S3 ListObjects XML 响应（兼容 OpenList/Alist 等非标准 S3 代理），含分页信息 */
export function parseListObjectsXml(xml: string): ListObjectsPage {
  const files: S3FileInfo[] = []
  // 按 <Contents> 块分割，逐块提取字段（兼容中间夹有 ETag/StorageClass 等额外元素）
  const blocks = xml.split(/<\/Contents>/)
  for (const block of blocks) {
    const keyMatch = /<Key>([\s\S]*?)<\/Key>/.exec(block)
    if (!keyMatch) continue
    const key = unescapeXml(keyMatch[1])
    const lastModMatch = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(block)
    const sizeMatch = /<Size>(\d+)<\/Size>/.exec(block)
    // epoch 与展示串同口径：取 UTC 墙钟字段按本地时区重组（兼容代理本地时间误标 Z）
    const lastModEpoch = lastModMatch ? utcWallClockToLocalEpoch(lastModMatch[1]) : NaN
    files.push({
      name: key.split("/").pop() || key,
      key,
      size: sizeMatch ? Number.parseInt(sizeMatch[1], 10) : 0,
      lastModified: lastModMatch ? utcToUtcString(lastModMatch[1]) : "",
      timestamp: isNaN(lastModEpoch) ? undefined : lastModEpoch,
    })
  }

  const isTruncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml)
  const nextMarkerMatch = /<NextMarker>([\s\S]*?)<\/NextMarker>/.exec(xml)
  const nextMarker = nextMarkerMatch
    ? unescapeXml(nextMarkerMatch[1])
    : (files.length > 0 ? files[files.length - 1].key : "")

  return { files, isTruncated, nextMarker }
}

/** 解析 S3 错误响应 XML，附带 HTTP 状态码辅助诊断 */
export function parseS3Error(xml: string, httpStatus?: number): string {
  const codeMatch = /<Code>(.*?)<\/Code>/.exec(xml)
  const msgMatch = /<Message>(.*?)<\/Message>/.exec(xml)
  const code = codeMatch ? codeMatch[1] : "Unknown"
  const msg = msgMatch ? msgMatch[1] : (xml || "(empty body)")
  const prefix = httpStatus !== undefined ? `[HTTP ${httpStatus}] ` : ""
  return `${prefix}${code}: ${msg}`
}

/**
 * 格式化 S3 错误信息，附带响应头诊断（405 时显示 Allow 头）
 * 用于 upload/download/list/delete 等非 ok 响应的统一错误构造
 */
export function formatS3Error(response: NodeResponse, body: string, operation: string): string {
  const errMsg = parseS3Error(body, response.status)
  let extra = ""
  if (response.status === 405 && response.headers?.["allow"]) {
    extra = `（服务器允许的方法: ${response.headers["allow"]}）`
  }
  return `${operation}: ${errMsg}${extra}`
}

// ========== 查询串 ==========

/** 对 query string 参数按字母序排序（SigV4 canonical request 强制要求） */
export function sortQueryString(qs: string): string {
  if (!qs) return ""
  return qs.split("&").sort().join("&")
}

// ========== AWS Signature V4 签名实现 ==========

/**
 * 构建 AWS Signature V4 Authorization header
 *
 * 签名流程:
 *   CanonicalRequest → StringToSign → Signature → Authorization header
 */
export function signRequest(
  method: string,
  uri: string,
  queryString: string,
  headers: Record<string, string>,
  signedHeaders: string,
  payloadHashStr: string,
  accessKey: string,
  secretKey: string,
  region: string,
  amzDateStr: string,
  dateStampStr: string,
): string {
  // 1. 构建 CanonicalRequest
  const canonicalHeaders = signedHeaders
    .split(";")
    .map((h) => `${h}:${headers[h]}`)
    .join("\n")

  const canonicalRequest = [
    method.toUpperCase(),
    uri,
    queryString,
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHashStr,
  ].join("\n")

  // 2. 构建 StringToSign
  const credentialScope = `${dateStampStr}/${region}/s3/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDateStr,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n")

  // 3. 计算签名密钥
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStampStr)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, "s3")
  const kSigning = hmacSha256(kService, "aws4_request")

  // 4. 计算签名
  const signature = hmacSha256Hex(kSigning, stringToSign)

  // 5. 组装 Authorization header
  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

// ========== 分块上传进度 ==========

/** 请求体分块写入的块大小（256KB，块间回调字节进度） */
const UPLOAD_CHUNK_SIZE = 256 * 1024

/**
 * 分块写入请求体并上报已发送字节数
 * req.write 整体写入无进度回调；分块写入 + 尊重背压（write 返回 false 时等 drain 再续写）
 * 使大文件上传期间能持续上报真实发送进度
 */
export function writeBodyInChunks(
  req: any,
  body: Buffer,
  onProgress: (sent: number, total: number) => void,
): void {
  let offset = 0
  const writeNext = (): void => {
    // 超时/错误已销毁请求时停止写入（错误由 req 的 error 监听兜底）
    if (req.destroyed) { return }
    while (offset < body.length) {
      const chunk = body.subarray(offset, offset + UPLOAD_CHUNK_SIZE)
      offset += chunk.length
      const canContinue = req.write(chunk)
      onProgress(offset, body.length)
      if (!canContinue) {
        req.once("drain", writeNext)
        return
      }
    }
    req.end()
  }
  writeNext()
}

// ========== NodeResponse 兼容接口 ==========

/**
 * Node http/https 响应的兼容接口（模拟浏览器 Response）
 *
 * S3Client 内部所有调用方（tryHeadBucket/tryListObjects/upload/uploadBuffer/
 * download/list/delete）均通过鸭子类型访问 .ok/.status/.text()，
 * 定义此接口后这些调用方零改动。
 */
export interface NodeResponse {
  ok: boolean
  status: number
  text(): Promise<string>
  /** 响应头（Node http 中 key 全小写） */
  headers?: Record<string, string>
}
