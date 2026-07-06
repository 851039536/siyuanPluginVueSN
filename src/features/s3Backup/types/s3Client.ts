/**
 * S3 兼容存储客户端
 *
 * 使用 AWS Signature V4 签名算法，通过 Node.js crypto 模块直接签名 HTTP 请求。
 * 不依赖任何外部 SDK，支持所有 S3 兼容存储（MinIO、Ceph、LocalStack 等）。
 *
 * 支持操作：HeadBucket(测试连接)、PutObject(上传Buffer)、GetObject(下载)、
 * ListObjects(列举)、DeleteObject(删除)
 */
import type { S3Config, S3FileInfo } from "./index"
import { getNodeModules } from "@/utils/nodeModules"

// ========== 工具函数 ==========

/** 获取 crypto 模块 (仅 Electron/Node.js 环境可用) */
function requireCrypto(): any {
  const node = getNodeModules()
  if (!node) throw new Error("签名需要 Node.js 环境，请使用桌面版思源笔记")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node:crypto")
}

/** 获取 fs/path 模块 */
function requireFsPath() {
  const node = getNodeModules()
  if (!node) throw new Error("无法访问文件系统，请使用桌面版思源笔记")
  return {
    fs: node.fs.promises,
    path: node.path,
  }
}

/** 获取 Node.js http/https 模块（绕过浏览器 Mixed Content 限制） */
function requireHttp(): { http: any; https: any } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const http = require("node:http")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const https = require("node:https")
  return { http, https }
}

/** SHA256 哈希，返回 hex 字符串 */
function sha256Hex(data: string | Buffer): string {
  const crypto = requireCrypto()
  return crypto.createHash("sha256").update(data).digest("hex")
}

/** HMAC-SHA256，返回 Buffer */
function hmacSha256(key: Buffer | string, data: string): Buffer {
  const crypto = requireCrypto()
  const keyBuf = typeof key === "string" ? Buffer.from(key, "utf-8") : key
  return crypto.createHmac("sha256", keyBuf).update(data).digest()
}

/** HMAC-SHA256，返回 hex 字符串 */
function hmacSha256Hex(key: Buffer | string, data: string): string {
  return hmacSha256(key, data).toString("hex")
}

/** 生成 ISO 8601 时间戳 (YYYYMMDDTHHMMSSZ) */
function amzDate(): string {
  const d = new Date()
  return d.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

/** 生成日期戳 (YYYYMMDD) */
function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "")
}

/** 生成 Payload 的 SHA256 哈希 (hex) */
function payloadHash(body: Buffer | string | null): string {
  if (body === null || body === undefined) {
    return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" // 空字符串的 SHA256
  }
  // B14 修复：两个分支返回相同，合并为单行
  return sha256Hex(body)
}

/** 对 query string 参数按字母序排序（SigV4 canonical request 强制要求） */
function sortQueryString(qs: string): string {
  if (!qs) return ""
  return qs.split("&").sort().join("&")
}

/** 解析 S3 ListObjects XML 响应（兼容 OpenList/Alist 等非标准 S3 代理） */
function parseListObjectsXml(xml: string): S3FileInfo[] {
  const results: S3FileInfo[] = []
  // 按 <Contents> 块分割，逐块提取字段（兼容中间夹有 ETag/StorageClass 等额外元素）
  const blocks = xml.split(/<\/Contents>/)
  for (const block of blocks) {
    const keyMatch = /<Key>([\s\S]*?)<\/Key>/.exec(block)
    if (!keyMatch) continue
    const lastModMatch = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(block)
    const sizeMatch = /<Size>(\d+)<\/Size>/.exec(block)
    results.push({
      name: keyMatch[1].split("/").pop() || keyMatch[1],
      key: keyMatch[1],
      size: sizeMatch ? Number.parseInt(sizeMatch[1], 10) : 0,
      lastModified: lastModMatch ? lastModMatch[1] : "",
    })
  }
  return results
}

/** 解析 S3 错误响应 XML，附带 HTTP 状态码辅助诊断 */
function parseS3Error(xml: string, httpStatus?: number): string {
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
function formatS3Error(response: NodeResponse, body: string, operation: string): string {
  const errMsg = parseS3Error(body, response.status)
  let extra = ""
  if (response.status === 405 && response.headers?.["allow"]) {
    extra = `（服务器允许的方法: ${response.headers["allow"]}）`
  }
  return `${operation}: ${errMsg}${extra}`
}

// ========== AWS Signature V4 签名实现 ==========

/**
 * 构建 AWS Signature V4 Authorization header
 *
 * 签名流程:
 *   CanonicalRequest → StringToSign → Signature → Authorization header
 */
function signRequest(
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

// ========== NodeResponse 兼容接口 ==========

/**
 * Node http/https 响应的兼容接口（模拟浏览器 Response）
 *
 * S3Client 内部所有调用方（tryHeadBucket/tryListObjects/upload/uploadBuffer/
 * download/list/delete）均通过鸭子类型访问 .ok/.status/.text()/.arrayBuffer()，
 * 定义此接口后这些调用方零改动。
 */
interface NodeResponse {
  ok: boolean
  status: number
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
  /** 响应头（Node http 中 key 全小写） */
  headers?: Record<string, string>
}

// ========== S3Client 类 ==========

export class S3Client {
  private config: S3Config

  constructor(config: S3Config) {
    this.config = { ...config }
    // 确保 endpoint 不包含协议前缀
    this.config.endpoint = this.normalizeEndpoint(config.endpoint)
  }

  // ========== 公开 API ==========

  /**
   * 测试连接
   *
   * 先尝试 HeadBucket，若失败则回退为 ListObjects（OpenList/Alist 等代理通常不支持 HEAD）
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // 第一步：尝试 HeadBucket
      const headResult = await this.tryHeadBucket()
      if (headResult.success) return headResult

      // 第二步：降级为 ListObjects（OpenList 等代理通常只支持 GET/PUT）
      const listResult = await this.tryListObjects()
      if (listResult.success) {
        return { success: true, message: "S3 连接成功（ListObjects 验证）" }
      }

      // 两个都失败，返回 HeadBucket 的详细错误
      return {
        success: false,
        message: `${headResult.message}（ListObjects 也失败: ${listResult.message}）`,
      }
    } catch (err: any) {
      return { success: false, message: `连接失败: ${err.message}` }
    }
  }

  /** HeadBucket 测试 */
  private async tryHeadBucket(): Promise<{ success: boolean; message: string }> {
    try {
      const protocol = this.config.useSSL ? "https" : "http"
      const url = this.config.pathStyle
        ? `${protocol}://${this.config.endpoint}/${this.config.bucket}`
        : `${protocol}://${this.config.bucket}.${this.config.endpoint}`
      // 签名时 URI 必须与 URL 的路径部分一致：path-style → /bucket, virtual-host → /
      const uri = this.config.pathStyle ? `/${this.config.bucket}` : "/"

      const response = await this.request("HEAD", uri, "", url, null)

      if (response.ok || response.status === 200) {
        return { success: true, message: "S3 连接成功" }
      }

      if (response.status === 403) {
        return { success: false, message: "认证失败 (403)，请检查 Access Key 和 Secret Key" }
      }
      if (response.status === 404) {
        return { success: false, message: `存储桶 "${this.config.bucket}" 不存在 (404)` }
      }
      return { success: false, message: `HeadBucket 失败 (HTTP ${response.status})` }
    } catch (err: any) {
      return { success: false, message: `HeadBucket 异常: ${err.message}` }
    }
  }

  /** ListObjects 测试（HeadBucket 不可用时的降级方案） */
  private async tryListObjects(): Promise<{ success: boolean; message: string }> {
    try {
      const prefix = this.config.prefix || ""
      const url = this.buildUrl("", `?prefix=${encodeURIComponent(prefix)}&max-keys=1`)
      // 签名用 buildUri("")：path-style → /bucket/, virtual-host → /
      const uri = this.buildUri("")
      const response = await this.request(
        "GET", uri, `prefix=${encodeURIComponent(prefix)}&max-keys=1`, url, null,
      )

      if (response.ok) {
        return { success: true, message: "S3 连接成功" }
      }

      const body = await response.text()
      if (response.status === 403) {
        const errMsg = parseS3Error(body, response.status)
        return { success: false, message: `认证失败: ${errMsg}，请检查密钥是否正确` }
      }
      return { success: false, message: `ListObjects 失败 (HTTP ${response.status})` }
    } catch (err: any) {
      return { success: false, message: `ListObjects 异常: ${err.message}` }
    }
  }

  /** 直接上传 Buffer 内容到 S3（跳过本地文件读写） */
  async uploadBuffer(buffer: Buffer, key: string): Promise<void> {
    const url = this.buildUrl(key)
    const response = await this.request("PUT", this.buildUri(key), "", url, buffer)

    if (!response.ok) {
      const body = await response.text()
      throw new Error(formatS3Error(response, body, "S3 上传失败"))
    }
  }

  /** 下载文件到本地 */
  async download(key: string, localPath: string): Promise<void> {
    const { fs, path } = requireFsPath()
    const url = this.buildUrl(key)
    const response = await this.request("GET", this.buildUri(key), "", url, null)

    if (!response.ok) {
      const body = await response.text()
      throw new Error(formatS3Error(response, body, "S3 下载失败"))
    }

    const buffer = await response.arrayBuffer()
    await fs.mkdir(path.dirname(localPath), { recursive: true })
    await fs.writeFile(localPath, Buffer.from(buffer))
  }

  /** 列举指定前缀的文件 */
  async list(prefix: string): Promise<S3FileInfo[]> {
    const url = this.buildUrl("", `?prefix=${encodeURIComponent(prefix)}&max-keys=100`)
    const uri = this.buildUri("")

    const response = await this.request("GET", uri, `prefix=${encodeURIComponent(prefix)}&max-keys=100`, url, null)

    if (!response.ok) {
      const body = await response.text()
      throw new Error(formatS3Error(response, body, "S3 列举文件失败"))
    }

    return parseListObjectsXml(await response.text())
  }

  /** 删除文件 */
  async delete(key: string): Promise<void> {
    const url = this.buildUrl(key)
    const response = await this.request("DELETE", this.buildUri(key), "", url, null)

    if (!response.ok && response.status !== 204) {
      const body = await response.text()
      throw new Error(formatS3Error(response, body, "S3 删除失败"))
    }
  }

  // ========== 私有方法 ==========

  /** 构建请求 URL */
  private buildUrl(key: string, queryString = ""): string {
    const safeKey = key.replace(/^\/+/, "")
    const protocol = this.config.useSSL ? "https" : "http"
    if (this.config.pathStyle) {
      const encodedKey = safeKey.split("/").map(encodeURIComponent).join("/")
      const qs = queryString ? queryString : ""
      return `${protocol}://${this.config.endpoint}/${this.config.bucket}/${encodedKey}${qs}`
    }
    const encodedKey = safeKey.split("/").map(encodeURIComponent).join("/")
    const qs = queryString ? queryString : ""
    return `${protocol}://${this.config.bucket}.${this.config.endpoint}/${encodedKey}${qs}`
  }

  /** 构建请求 URI (用于签名) */
  private buildUri(key: string): string {
    const safeKey = key.replace(/^\/+/, "")
    if (this.config.pathStyle) {
      return `/${this.config.bucket}/${safeKey}`.replace(/\/+/g, "/")
    }
    return `/${safeKey}`.replace(/\/+/g, "/")
  }

  /** 执行带 AWS SigV4 签名的 HTTP 请求（使用 Node.js http/https 模块，绕过浏览器 Mixed Content 限制） */
  private async request(
    method: string,
    uri: string,
    queryString: string,
    url: string,
    body: Buffer | null,
  ): Promise<NodeResponse> {
    const amzDateStr = amzDate()
    const dateStampStr = dateStamp()
    // 无 body 的请求使用 UNSIGNED-PAYLOAD（许多 S3 兼容服务不认空体 SHA256）
    const payloadHashValue = body === null ? "UNSIGNED-PAYLOAD" : payloadHash(body)

    // SigV4 canonical request 要求查询参数按字母序排列
    const sortedQuery = sortQueryString(queryString)
    const sortedUrl = sortedQuery ? url.replace(/\?.*$/, `?${sortedQuery}`) : url

    const parsedUrl = new URL(sortedUrl)
    const hostname = parsedUrl.host

    // 构建签名所需的 headers（key 必须全小写，与 signedHeaders 一致）
    const headers: Record<string, string> = {
      "host": hostname,
      "x-amz-content-sha256": payloadHashValue,
      "x-amz-date": amzDateStr,
    }

    const signedHeaders = "host;x-amz-content-sha256;x-amz-date"

    const authorization = signRequest(
      method, uri, sortedQuery,
      headers, signedHeaders, payloadHashValue,
      this.config.accessKey, this.config.secretKey,
      this.config.region, amzDateStr, dateStampStr,
    )

    const reqHeaders: Record<string, string> = {
      "Authorization": authorization,
      "x-amz-content-sha256": payloadHashValue,
      "x-amz-date": amzDateStr,
      "Host": hostname,
    }

    if (body) {
      reqHeaders["Content-Type"] = "application/octet-stream"
      reqHeaders["Content-Length"] = String(body.length)
    }

    const { http, https } = requireHttp()
    const transport = parsedUrl.protocol === "https:" ? https : http

    const options: any = {
      method: method.toUpperCase(),
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: reqHeaders,
    }

    // HTTPS 自签名证书支持（MinIO/Ceph/OpenList 等 S3 兼容服务常用自签名证书）
    if (parsedUrl.protocol === "https:") {
      options.rejectUnauthorized = false
    }

    return new Promise<NodeResponse>((resolve, reject) => {
      const doRequest = (reqTransport: any, reqOptions: any, currentUrl: string, redirectCount: number) => {
        if (redirectCount > 5) {
          reject(new Error("S3 请求失败: 重定向次数过多（超过 5 次），请检查 endpoint 配置"))
          return
        }
        const req = reqTransport.request(reqOptions, (res: any) => {
          const method = reqOptions.method.toUpperCase()
          const isRedirect = res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 ||
            res.statusCode === 307 || res.statusCode === 308

          // 仅对 GET/HEAD 跟随重定向（PUT/DELETE 重定向后签名失效，应报错而非盲从）
          if (isRedirect && res.headers.location && (method === "GET" || method === "HEAD")) {
            res.resume() // 消费掉当前响应体
            const redirectUrl = new URL(res.headers.location, currentUrl)
            console.warn(`[S3] 重定向 ${res.statusCode}: ${currentUrl} → ${redirectUrl.href}`)
            const nextTransport = redirectUrl.protocol === "https:" ? https : http
            const redirectOptions: any = {
              method: reqOptions.method,
              hostname: redirectUrl.hostname,
              port: redirectUrl.port || (redirectUrl.protocol === "https:" ? 443 : 80),
              path: redirectUrl.pathname + redirectUrl.search,
              headers: reqOptions.headers,
            }
            if (redirectUrl.protocol === "https:") {
              redirectOptions.rejectUnauthorized = false
            }
            doRequest(nextTransport, redirectOptions, redirectUrl.href, redirectCount + 1)
            return
          }

          // PUT/DELETE 收到重定向但不跟随 — 记录诊断信息
          if (isRedirect && res.headers.location) {
            console.warn(`[S3] ${method} 收到重定向 ${res.statusCode} → ${res.headers.location}（PUT/DELETE 不跟随重定向，签名会失效）`)
          }

          const chunks: Buffer[] = []
          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk)
          })
          res.on("end", () => {
            const responseBody = Buffer.concat(chunks)
            const ok = res.statusCode >= 200 && res.statusCode < 300
            if (!ok) {
              const allowHeader = res.headers["allow"] ? ` (Allow: ${res.headers["allow"]})` : ""
              const bodyPreview = responseBody.toString("utf-8").slice(0, 300)
              console.warn(`[S3] 请求失败 ${method} ${currentUrl} → HTTP ${res.statusCode}${allowHeader}`)
              if (bodyPreview) {
                console.warn(`[S3] 响应体: ${bodyPreview}`)
              }
            }
            resolve({
              ok,
              status: res.statusCode,
              text: async () => responseBody.toString("utf-8"),
              arrayBuffer: async () => {
                const ab = new ArrayBuffer(responseBody.length)
                new Uint8Array(ab).set(responseBody)
                return ab
              },
              headers: res.headers,
            })
          })
        })

        // 30 秒超时保护
        // 上传请求 120s 超时（大文件上传 + 服务端处理），其他请求 30s
        const timeoutMs = body ? 120000 : 30000
        req.setTimeout(timeoutMs, () => {
          req.destroy(new Error(`请求超时（${timeoutMs / 1000}s）`))
        })

        req.on("error", (err: any) => {
          reject(new Error(`S3 请求失败: ${err.message}`))
        })

        if (body) {
          req.write(body)
        }
        req.end()
      }

      doRequest(transport, options, sortedUrl, 0)
    })
  }

  /** 标准化 endpoint（确保不包含协议前缀） */
  private normalizeEndpoint(endpoint: string): string {
    return endpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "")
  }
}
