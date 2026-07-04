/**
 * S3 兼容存储客户端
 *
 * 使用 AWS Signature V4 签名算法，通过 Node.js crypto 模块直接签名 HTTP 请求。
 * 不依赖任何外部 SDK，支持所有 S3 兼容存储（MinIO、Ceph、LocalStack 等）。
 *
 * 支持操作：HeadBucket(测试连接)、PutObject(上传)、GetObject(下载)、
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
  if (typeof body === "string") return sha256Hex(body)
  return sha256Hex(body)
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

/** 解析 S3 错误响应 XML */
function parseS3Error(xml: string): string {
  const codeMatch = /<Code>(.*?)<\/Code>/.exec(xml)
  const msgMatch = /<Message>(.*?)<\/Message>/.exec(xml)
  const code = codeMatch ? codeMatch[1] : "Unknown"
  const msg = msgMatch ? msgMatch[1] : xml
  return `${code}: ${msg}`
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
  payload: Buffer | string | null,
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

  const payloadHashValue = payloadHash(payload)

  const canonicalRequest = [
    method.toUpperCase(),
    uri,
    queryString,
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHashValue,
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

// ========== S3Client 类 ==========

export class S3Client {
  private config: S3Config

  constructor(config: S3Config) {
    this.config = { ...config }
    // 确保 endpoint 不包含协议前缀
    this.config.endpoint = this.normalizeEndpoint(config.endpoint)
  }

  /** 更新配置（用于连接测试） */
  updateConfig(config: S3Config): void {
    this.config = { ...config }
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

      const response = await this.request("HEAD", "/", "", url, null)

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
      const response = await this.request(
        "GET", "/", `prefix=${encodeURIComponent(prefix)}&max-keys=1`, url, null,
      )

      if (response.ok) {
        return { success: true, message: "S3 连接成功" }
      }

      const body = await response.text()
      if (response.status === 403) {
        const errMsg = parseS3Error(body)
        return { success: false, message: `认证失败: ${errMsg}，请检查密钥是否正确` }
      }
      return { success: false, message: `ListObjects 失败 (HTTP ${response.status})` }
    } catch (err: any) {
      return { success: false, message: `ListObjects 异常: ${err.message}` }
    }
  }

  /** 上传文件 */
  async upload(localPath: string, key: string, onProgress?: (percent: number) => void): Promise<void> {
    const { fs } = requireFsPath()
    const fileBuffer = await fs.readFile(localPath)

    onProgress?.(30)

    const url = this.buildUrl(key)
    const response = await this.request("PUT", this.buildUri(key), "", url, fileBuffer)

    if (!response.ok) {
      const body = await response.text()
      const errMsg = parseS3Error(body)
      throw new Error(`S3 上传失败: ${errMsg}`)
    }

    onProgress?.(100)
  }

  /** 下载文件到本地 */
  async download(key: string, localPath: string): Promise<void> {
    const { fs, path } = requireFsPath()
    const url = this.buildUrl(key)
    const response = await this.request("GET", this.buildUri(key), "", url, null)

    if (!response.ok) {
      const body = await response.text()
      const errMsg = parseS3Error(body)
      throw new Error(`S3 下载失败: ${errMsg}`)
    }

    const buffer = await response.arrayBuffer()
    await fs.mkdir(path.dirname(localPath), { recursive: true })
    await fs.writeFile(localPath, Buffer.from(buffer))
  }

  /** 列举指定前缀的文件 */
  async list(prefix: string): Promise<S3FileInfo[]> {
    const url = this.buildUrl("", `?prefix=${encodeURIComponent(prefix)}&max-keys=100`)

    const response = await this.request("GET", "/", `prefix=${encodeURIComponent(prefix)}&max-keys=100`, url, null)

    if (!response.ok) {
      const body = await response.text()
      const errMsg = parseS3Error(body)
      throw new Error(`S3 列举文件失败: ${errMsg}`)
    }

    return parseListObjectsXml(await response.text())
  }

  /** 删除文件 */
  async delete(key: string): Promise<void> {
    const url = this.buildUrl(key)
    const response = await this.request("DELETE", this.buildUri(key), "", url, null)

    if (!response.ok && response.status !== 204) {
      const body = await response.text()
      const errMsg = parseS3Error(body)
      throw new Error(`S3 删除失败: ${errMsg}`)
    }
  }

  // ========== 私有方法 ==========

  /** 构建请求 URL */
  private buildUrl(key: string, queryString = ""): string {
    const protocol = this.config.useSSL ? "https" : "http"
    if (this.config.pathStyle) {
      const encodedKey = key.split("/").map(encodeURIComponent).join("/")
      const qs = queryString ? queryString : ""
      return `${protocol}://${this.config.endpoint}/${this.config.bucket}/${encodedKey}${qs}`
    }
    const encodedKey = key.split("/").map(encodeURIComponent).join("/")
    const qs = queryString ? queryString : ""
    return `${protocol}://${this.config.bucket}.${this.config.endpoint}/${encodedKey}${qs}`
  }

  /** 构建请求 URI (用于签名) */
  private buildUri(key: string): string {
    if (this.config.pathStyle) {
      return `/${this.config.bucket}/${key}`.replace(/\/+/g, "/")
    }
    return `/${key}`.replace(/\/+/g, "/")
  }

  /** 执行带 AWS SigV4 签名的 HTTP 请求 */
  private async request(
    method: string,
    uri: string,
    queryString: string,
    url: string,
    body: Buffer | null,
  ): Promise<Response> {
    const amzDateStr = amzDate()
    const dateStampStr = dateStamp()
    const payloadHashValue = payloadHash(body)

    const hostname = new URL(url).host

    // 构建签名所需的 headers
    const headers: Record<string, string> = {
      "Host": hostname,
      "x-amz-content-sha256": payloadHashValue,
      "x-amz-date": amzDateStr,
    }

    const signedHeaders = "host;x-amz-content-sha256;x-amz-date"

    const authorization = signRequest(
      method, uri, queryString,
      headers, signedHeaders, body,
      this.config.accessKey, this.config.secretKey,
      this.config.region, amzDateStr, dateStampStr,
    )

    const fetchHeaders: Record<string, string> = {
      "Authorization": authorization,
      "x-amz-content-sha256": payloadHashValue,
      "x-amz-date": amzDateStr,
      "Host": hostname,
    }

    if (body) {
      fetchHeaders["Content-Type"] = "application/octet-stream"
      fetchHeaders["Content-Length"] = String(body.length)
    }

    try {
      // Convert Buffer to Uint8Array for fetch BodyInit compatibility
      const fetchBody: BodyInit | undefined = body
        ? new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
        : undefined
      return await fetch(url, {
        method: method.toUpperCase(),
        headers: fetchHeaders,
        body: fetchBody,
      })
    } catch (err: any) {
      throw new Error(`S3 请求失败: ${err.message}`)
    }
  }

  /** 标准化 endpoint（确保不包含协议前缀） */
  private normalizeEndpoint(endpoint: string): string {
    return endpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "")
  }
}
