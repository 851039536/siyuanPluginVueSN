/**
 * S3 兼容存储客户端（共享层）
 *
 * 使用 AWS Signature V4 签名算法，通过 Node.js http/https 模块直接签名并发送请求。
 * 不依赖任何外部 SDK，支持所有 S3 兼容存储（MinIO、Ceph、LocalStack 等）。
 * 签名/XML 解析等纯函数实现位于 ./s3Protocol；目录列举/复制等扩展操作位于 ./s3ObjectOps。
 * 从 s3Backup/types/s3Client.ts 提升，供多个功能模块共用。
 *
 * 支持操作：HeadBucket(测试连接)、PutObject(上传Buffer)、GetObject(流式下载/读文本)、
 * ListObjects(自动翻页列举)、DeleteObject(删除)
 */
import type { S3Config, S3FileInfo } from "./types"
import { DEFAULT_UPLOAD_TIMEOUT_SEC, MSG_DESKTOP_ONLY } from "./types"
import { getNodeModules, getNodeHttp } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import {
  sha256Hex, amzDate, dateStamp, sortQueryString, signRequest,
  parseListObjectsXml, parseS3Error, formatS3Error, writeBodyInChunks,
} from "./s3Protocol"
import type { NodeResponse } from "./s3Protocol"

// ========== 模块常量 ==========

/** ListObjects 自动翻页的防御性上限（100 页 × 1000 = 10 万对象） */
export const MAX_LIST_PAGES = 100

// ========== 工具函数 ==========

/** 获取 fs/path 模块（fs 为 promises API，fsRaw 供 createWriteStream 流式写盘用） */
function requireFsPath() {
  const node = getNodeModules()
  if (!node) throw new Error(MSG_DESKTOP_ONLY)
  return {
    fs: node.fs.promises,
    fsRaw: node.fs,
    path: node.path,
  }
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
    } catch (err: unknown) {
      return { success: false, message: `连接失败: ${getErrorMessage(err)}` }
    }
  }

  /** HeadBucket 测试 */
  private async tryHeadBucket(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.request("HEAD", this.buildUri(""), "", this.buildUrl(""), null)

      if (response.ok) {
        return { success: true, message: "S3 连接成功" }
      }

      if (response.status === 403) {
        return { success: false, message: "认证失败 (403)，请检查 Access Key 和 Secret Key" }
      }
      if (response.status === 404) {
        return { success: false, message: `存储桶 "${this.config.bucket}" 不存在 (404)` }
      }
      return { success: false, message: `HeadBucket 失败 (HTTP ${response.status})` }
    } catch (err: unknown) {
      return { success: false, message: `HeadBucket 异常: ${getErrorMessage(err)}` }
    }
  }

  /** ListObjects 测试（HeadBucket 不可用时的降级方案） */
  private async tryListObjects(): Promise<{ success: boolean; message: string }> {
    try {
      const prefix = this.config.prefix || ""
      const query = `prefix=${encodeURIComponent(prefix)}&max-keys=1`
      // 签名用 buildUri("")：path-style → /bucket/, virtual-host → /
      const response = await this.request("GET", this.buildUri(""), query, this.buildUrl(""), null)

      if (response.ok) {
        return { success: true, message: "S3 连接成功" }
      }

      const body = await response.text()
      if (response.status === 403) {
        const errMsg = parseS3Error(body, response.status)
        return { success: false, message: `认证失败: ${errMsg}，请检查密钥是否正确` }
      }
      return { success: false, message: `ListObjects 失败 (HTTP ${response.status})` }
    } catch (err: unknown) {
      return { success: false, message: `ListObjects 异常: ${getErrorMessage(err)}` }
    }
  }

  /**
   * 直接上传 Buffer 内容到 S3（跳过本地文件读写；onProgress 上报字节级发送进度）
   * 已知限制：整包 Buffer 驻留内存；流式上传需 UNSIGNED-PAYLOAD 签名 + 调用方哈希计算重构，留待后续优化
   */
  async uploadBuffer(buffer: Buffer, key: string, onProgress?: (sent: number, total: number) => void): Promise<void> {
    const url = this.buildUrl(key)
    const response = await this.request("PUT", this.buildUri(key), "", url, buffer, onProgress)

    if (!response.ok) {
      const body = await response.text()
      throw new Error(formatS3Error(response, body, "S3 上传失败"))
    }
  }

  /** 下载文件到本地（响应体流式写盘，避免大备份整包驻留内存） */
  async download(key: string, localPath: string): Promise<void> {
    const { fs, path } = requireFsPath()
    await fs.mkdir(path.dirname(localPath), { recursive: true })

    const url = this.buildUrl(key)
    const response = await this.request("GET", this.buildUri(key), "", url, null, undefined, localPath)

    if (!response.ok) {
      const body = await response.text()
      throw new Error(formatS3Error(response, body, "S3 下载失败"))
    }
  }

  /** 读取对象文本内容（404 返回 null，供增量清单等小文件读取使用） */
  async getObjectText(key: string): Promise<string | null> {
    const url = this.buildUrl(key)
    const response = await this.request("GET", this.buildUri(key), "", url, null)

    if (response.status === 404) { return null }
    if (!response.ok) {
      const body = await response.text()
      throw new Error(formatS3Error(response, body, "S3 读取对象失败"))
    }

    return response.text()
  }

  /** 列举指定前缀的全部文件（IsTruncated 时按 marker 自动翻页） */
  async list(prefix: string): Promise<S3FileInfo[]> {
    const all: S3FileInfo[] = []
    let marker = ""

    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      let query = `prefix=${encodeURIComponent(prefix)}&max-keys=1000`
      if (marker) {
        query += `&marker=${encodeURIComponent(marker)}`
      }

      const response = await this.request("GET", this.buildUri(""), query, this.buildUrl(""), null)
      if (!response.ok) {
        const body = await response.text()
        throw new Error(formatS3Error(response, body, "S3 列举文件失败"))
      }

      const { files, isTruncated, nextMarker } = parseListObjectsXml(await response.text())
      all.push(...files)

      if (!isTruncated || !nextMarker) {
        return all
      }
      marker = nextMarker
    }

    console.warn(`[S3] 列举超过 ${MAX_LIST_PAGES} 页上限，返回已收集的 ${all.length} 条（结果可能不完整）`)
    return all
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

  // ========== 扩展操作委托入口 ==========

  /**
   * 受控请求入口（供 ./s3ObjectOps 的扩展操作使用，避免主类膨胀突破行数阈值）
   * extraHeaders 的 key 会转小写并加入 SigV4 签名头集合
   */
  sendRequest(
    method: string,
    key: string,
    queryString: string,
    opts?: { body?: Buffer | null; extraHeaders?: Record<string, string> },
  ): Promise<NodeResponse> {
    return this.request(
      method, this.buildUri(key), queryString, this.buildUrl(key),
      opts?.body ?? null, undefined, undefined, opts?.extraHeaders,
    )
  }

  /**
   * 构建 x-amz-copy-source 头的值（/bucket/编码后的key）
   * 编码必须与 buildUri 完全一致（RFC 3986 分段编码），否则中文/空格 key 触发 403 SignatureDoesNotMatch
   */
  encodeCopySource(key: string): string {
    return `/${this.config.bucket}/${this.encodeKeyPath(this.normKey(key))}`
  }

  // ========== 私有方法 ==========

  /** 标准化 S3 key：去除首部斜杠 */
  private normKey(key: string): string {
    return key.replace(/^\/+/, "")
  }

  /** 构建请求 URL（不含查询串；查询串以 request() 的 queryString 参数为单一来源统一拼接） */
  private buildUrl(key: string): string {
    const safeKey = this.normKey(key)
    const protocol = this.config.useSSL ? "https" : "http"
    const encodedKey = this.encodeKeyPath(safeKey)
    const host = this.config.pathStyle
      ? `${this.config.endpoint}/${this.config.bucket}`
      : `${this.config.bucket}.${this.config.endpoint}`
    return `${protocol}://${host}/${encodedKey}`
  }

  /**
   * 按 SigV4 规则编码对象 key 路径（RFC 3986，保留段间 /）
   * encodeURIComponent 遗漏的 !'()* 一并补编，与 AWS SDK 的 uriEscapePath 行为一致
   */
  private encodeKeyPath(key: string): string {
    return key
      .split("/")
      .map((seg) => encodeURIComponent(seg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
      .join("/")
  }

  /**
   * 构建请求 URI (用于签名)
   * 必须与 buildUrl 的路径编码完全一致：canonical URI 与线上请求 path 编码不一致时，
   * 含中文/空格的 key 会触发 403 SignatureDoesNotMatch（纯 ASCII key 编码前后相同故不受影响）
   */
  private buildUri(key: string): string {
    const encodedKey = this.encodeKeyPath(this.normKey(key))
    if (this.config.pathStyle) {
      return `/${this.config.bucket}/${encodedKey}`.replace(/\/+/g, "/")
    }
    return `/${encodedKey}`.replace(/\/+/g, "/")
  }

  /**
   * 执行带 AWS SigV4 签名的 HTTP 请求（使用 Node.js http/https 模块，绕过浏览器 Mixed Content 限制）
   * @param saveToPath 提供时 2xx 响应体直接流式写入该本地文件（错误响应仍缓冲以解析错误 XML）
   * @param extraHeaders 额外请求头（key 转小写后进入 SigV4 签名头集合，如 x-amz-copy-source）
   */
  private async request(
    method: string,
    uri: string,
    queryString: string,
    url: string,
    body: Buffer | null,
    onProgress?: (sent: number, total: number) => void,
    saveToPath?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<NodeResponse> {
    const now = new Date()
    const amzDateStr = amzDate(now)
    const dateStampStr = dateStamp(now)
    // 无 body 的请求使用 UNSIGNED-PAYLOAD（许多 S3 兼容服务不认空体 SHA256）
    const payloadHashValue = body === null ? "UNSIGNED-PAYLOAD" : sha256Hex(body)

    // SigV4 canonical request 要求查询参数按字母序排列；
    // 查询串以 queryString 参数为单一来源拼接，不依赖传入 url 是否已带查询
    const sortedQuery = sortQueryString(queryString)
    const baseUrl = url.replace(/\?.*$/, "")
    const sortedUrl = sortedQuery ? `${baseUrl}?${sortedQuery}` : baseUrl

    const parsedUrl = new URL(sortedUrl)
    const hostname = parsedUrl.host

    // 构建签名所需的 headers（key 必须全小写，与 signedHeaders 一致）
    const headers: Record<string, string> = {
      "host": hostname,
      "x-amz-content-sha256": payloadHashValue,
      "x-amz-date": amzDateStr,
    }
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        headers[k.toLowerCase()] = v
      }
    }

    // signedHeaders 按字母序（SigV4 强制要求），额外头一并进入签名
    const signedHeaders = Object.keys(headers).sort().join(";")

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
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        reqHeaders[k.toLowerCase()] = v
      }
    }

    if (body) {
      reqHeaders["Content-Type"] = "application/octet-stream"
      reqHeaders["Content-Length"] = String(body.length)
    }

    const node = getNodeHttp()
    if (!node) {
      throw new Error(MSG_DESKTOP_ONLY)
    }
    const { http, https } = node
    const transport = parsedUrl.protocol === "https:" ? https : http

    const options: any = {
      method: method.toUpperCase(),
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: reqHeaders,
    }

    // HTTPS 证书校验：仅允许自签名时跳过（MinIO/Ceph/OpenList 等自建服务常用自签名证书；
    // 旧持久化配置缺 allowSelfSigned 字段时视为允许，保持向后兼容）
    const allowSelfSigned = this.config.allowSelfSigned !== false
    if (parsedUrl.protocol === "https:" && allowSelfSigned) {
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
              // Host 必须指向重定向目标主机；跨主机后 SigV4 签名（含 host）随之失效属预期，
              // 服务端会返回 403 SignatureDoesNotMatch，此时错误信息可正确诊断
              headers: { ...reqOptions.headers, Host: redirectUrl.host },
            }
            if (redirectUrl.protocol === "https:" && allowSelfSigned) {
              redirectOptions.rejectUnauthorized = false
            }
            doRequest(nextTransport, redirectOptions, redirectUrl.href, redirectCount + 1)
            return
          }

          // PUT/DELETE 收到重定向但不跟随 — 记录诊断信息
          if (isRedirect && res.headers.location) {
            console.warn(`[S3] ${method} 收到重定向 ${res.statusCode} → ${res.headers.location}（PUT/DELETE 不跟随重定向，签名会失效）`)
          }

          const ok = res.statusCode >= 200 && res.statusCode < 300

          // 流式下载：2xx 响应体直接写盘，不经内存缓冲（错误响应走下方缓冲逻辑以解析错误 XML）
          if (ok && saveToPath) {
            const { fs, fsRaw } = requireFsPath()
            const output = fsRaw.createWriteStream(saveToPath)
            let settled = false
            const fail = (err: Error) => {
              if (settled) return
              settled = true
              // 清理半成品文件，避免残留损坏文件被当作有效备份
              output.destroy()
              fs.unlink(saveToPath).catch(() => { /* 忽略清理失败 */ })
              reject(new Error(`S3 下载写盘失败: ${err.message}`))
            }
            res.on("error", fail)
            output.on("error", fail)
            output.on("finish", () => {
              if (settled) return
              settled = true
              resolve({
                ok: true,
                status: res.statusCode,
                text: async () => "",
                headers: res.headers,
              })
            })
            res.pipe(output)
            return
          }

          const chunks: Buffer[] = []
          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk)
          })
          res.on("error", (err: Error) => {
            reject(new Error(`S3 响应读取失败: ${err.message}`))
          })
          res.on("end", () => {
            const responseBody = Buffer.concat(chunks)
            // if (!ok) {
            //   const allowHeader = res.headers["allow"] ? ` (Allow: ${res.headers["allow"]})` : ""
            //   const bodyPreview = responseBody.toString("utf-8").slice(0, 300)
            //   console.warn(`[S3] 请求失败 ${method} ${currentUrl} → HTTP ${res.statusCode}${allowHeader}`)
            //   if (bodyPreview) {
            //     console.warn(`[S3] 响应体: ${bodyPreview}`)
            //   }
            // }
            resolve({
              ok,
              status: res.statusCode,
              text: async () => responseBody.toString("utf-8"),
              headers: res.headers,
            })
          })
        })

        // 上传请求超时可配置（默认 240s，大文件上传 + 服务端处理；旧配置缺字段时回退默认值），其他请求 30s
        const uploadTimeoutSec = this.config.uploadTimeoutSec > 0 ? this.config.uploadTimeoutSec : DEFAULT_UPLOAD_TIMEOUT_SEC
        const timeoutMs = body ? uploadTimeoutSec * 1000 : 30000
        req.setTimeout(timeoutMs, () => {
          req.destroy(new Error(`请求超时（${timeoutMs / 1000}s）`))
        })

        req.on("error", (err: any) => {
          reject(new Error(`S3 请求失败: ${err.message}`))
        })

        if (body && onProgress) {
          // 分块写入以上报字节进度（整体 req.write 无进度回调）；writeNext 内部负责 req.end()
          writeBodyInChunks(req, body, onProgress)
        } else {
          if (body) {
            req.write(body)
          }
          req.end()
        }
      }

      doRequest(transport, options, sortedUrl, 0)
    })
  }

  /** 标准化 endpoint（确保不包含协议前缀） */
  private normalizeEndpoint(endpoint: string): string {
    return endpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "")
  }
}
