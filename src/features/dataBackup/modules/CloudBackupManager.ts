/**
 * 云备份管理器
 * 支持：七牛云、阿里云 OSS、腾讯云 COS
 *
 * 认证流程均为客户端直传模式：
 *   1. 使用 AccessKey/SecretKey 在客户端生成签名
 *   2. 通过 REST API 直接上传/下载/列举文件
 */
import type { BackupProgress } from "./BackupManager"
import { getNodeModules } from "@/utils/nodeModules"
import { PluginStorage } from "@/utils/pluginStorage"

// ========== 类型定义 ==========

export type CloudProviderType = "qiniu" | "alibaba" | "tencent"

export interface CloudProviderConfig {
  type: CloudProviderType
  /** 七牛: AccessKey | 阿里: AccessKeyId | 腾讯: SecretId */
  accessKey: string
  /** 七牛: SecretKey | 阿里: AccessKeySecret | 腾讯: SecretKey */
  secretKey: string
  /** 七牛: Bucket | 阿里: Bucket | 腾讯: Bucket */
  bucket: string
  /** 七牛: 上传域名 (如 https://up.qiniup.com) | 阿里: Endpoint | 腾讯: 可不填 */
  endpoint?: string
  /** 七牛: 可不填 | 阿里: Region (如 oss-cn-hangzhou) | 腾讯: Region (如 ap-guangzhou) */
  region?: string
  /** 备份文件在云端的目录前缀 */
  prefix?: string
}

export interface CloudFileInfo {
  name: string
  key: string
  size: number
  lastModified: string
}

export interface CloudUploadOptions {
  onProgress?: (progress: BackupProgress) => void
}

export interface CloudTestResult {
  success: boolean
  message: string
}

// ========== 公共 Provider 基类 ==========

/** 各云厂商 Provider 的公共接口 */
interface CloudProvider {
  upload: (localPath: string, cloudKey: string, options?: CloudUploadOptions) => Promise<void>
  download: (cloudKey: string, localPath: string) => Promise<void>
  list: (prefix: string) => Promise<CloudFileInfo[]>
  delete: (cloudKey: string) => Promise<void>
  test: () => Promise<CloudTestResult>
}

/** Provider 工厂签名 */
type ProviderFactory = (config: CloudProviderConfig) => CloudProvider

// ========== 公共工具方法 ==========

function requireCrypto() {
  const node = getNodeModules()
  if (!node) throw new TypeError("签名需要 Node.js 环境")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node:crypto")
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function requireFsPath() {
  const node = getNodeModules()
  if (!node) throw new TypeError("无法访问文件系统，请使用桌面版思源笔记")
  return {
    fs: node.fs.promises,
    path: node.path,
  }
}

// ========== 七牛云 Provider ==========

class QiniuProvider implements CloudProvider {
  private config: CloudProviderConfig

  constructor(config: CloudProviderConfig) {
    this.config = config
  }

  private generateUploadToken(key: string): string {
    const putPolicy = {
      scope: `${this.config.bucket}:${key}`,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    }
    const encodedPolicy = base64UrlEncode(JSON.stringify(putPolicy))
    const crypto = requireCrypto()
    const sign = crypto.createHmac("sha1", this.config.secretKey).update(encodedPolicy).digest("base64")
    const encodedSign = base64UrlEncode(sign)
    return `${this.config.accessKey}:${encodedSign}:${encodedPolicy}`
  }

  async upload(localPath: string, cloudKey: string, options?: CloudUploadOptions): Promise<void> {
    const { fs } = requireFsPath()
    const fileBuffer = await fs.readFile(localPath)
    const token = this.generateUploadToken(cloudKey)

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 0,
      totalFiles: 1,
      percent: 50,
    })

    const uploadDomain = this.config.endpoint || "https://up.qiniup.com"
    const response = await fetch(
      `${uploadDomain}/putb64/${fileBuffer.length}/key/${base64UrlEncode(cloudKey)}`,
      {
        method: "POST",
        headers: {
          "Authorization": `UpToken ${token}`,
          "Content-Type": "application/octet-stream",
        },
        body: fileBuffer,
      },
    )

    if (!response.ok) {
      throw new Error(`七牛上传失败: ${response.status} ${await response.text()}`)
    }

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 1,
      totalFiles: 1,
      percent: 100,
    })
  }

  async download(cloudKey: string, localPath: string): Promise<void> {
    const {
      fs,
      path,
    } = requireFsPath()
    const downloadUrl = this.getDownloadUrl(cloudKey)
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`七牛下载失败: ${response.status}`)
    }
    const buffer = await response.arrayBuffer()
    await fs.mkdir(path.dirname(localPath), { recursive: true })
    await fs.writeFile(localPath, Buffer.from(buffer))
  }

  async list(prefix: string): Promise<CloudFileInfo[]> {
    const url = `https://rsf.qiniuapi.com/list?bucket=${this.config.bucket}&prefix=${prefix}&limit=100`
    const crypto = requireCrypto()
    const sign = crypto.createHmac("sha1", this.config.secretKey).update(`GET\n${new URL(url).pathname}`).digest("base64")
    const encodedSign = base64UrlEncode(sign)

    const response = await fetch(url, {
      headers: {
        Authorization: `Qiniu ${this.config.accessKey}:${encodedSign}`,
      },
    })
    if (!response.ok) {
      throw new Error(`七牛列举文件失败: ${response.status}`)
    }
    const data = await response.json()
    return (data.items || []).map((item: any) => ({
      name: item.key.split("/").pop(),
      key: item.key,
      size: item.fsize,
      lastModified: new Date(item.putTime / 10000).toISOString(),
    }))
  }

  async delete(cloudKey: string): Promise<void> {
    const encodedKey = base64UrlEncode(cloudKey)
    const url = `https://rs.qiniuapi.com/delete/${base64UrlEncode(this.config.bucket)}/${encodedKey}`
    const crypto = requireCrypto()
    const sign = crypto.createHmac("sha1", this.config.secretKey).update(`POST\n${new URL(url).pathname}`).digest("base64")
    const encodedSign = base64UrlEncode(sign)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Qiniu ${this.config.accessKey}:${encodedSign}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
    if (!response.ok) {
      throw new Error(`七牛删除失败: ${response.status}`)
    }
  }

  async test(): Promise<CloudTestResult> {
    try {
      await this.list(this.config.prefix || "siyuan-backup/")
      return {
        success: true,
        message: "七牛云连接成功",
      }
    } catch (err: any) {
      return {
        success: false,
        message: `七牛云连接失败: ${err.message}`,
      }
    }
  }

  private getDownloadUrl(key: string): string {
    const domain = this.config.endpoint || `https://${this.config.bucket}.qiniudn.com`
    return `${domain}/${key}`
  }
}

// ========== 阿里云 OSS Provider ==========

class AlibabaProvider implements CloudProvider {
  private config: CloudProviderConfig

  constructor(config: CloudProviderConfig) {
    this.config = config
  }

  private getHost(): string {
    const region = this.config.region || "oss-cn-hangzhou"
    return `${this.config.bucket}.${region}.aliyuncs.com`
  }

  private sign(stringToSign: string): string {
    const crypto = requireCrypto()
    return crypto.createHmac("sha1", this.config.secretKey).update(stringToSign).digest("base64")
  }

  async upload(localPath: string, cloudKey: string, options?: CloudUploadOptions): Promise<void> {
    const { fs } = requireFsPath()
    const fileBuffer = await fs.readFile(localPath)
    const host = this.getHost()
    const date = new Date().toUTCString()
    const contentType = "application/zip"

    const stringToSign = `PUT\n\n${contentType}\n${date}\n/${this.config.bucket}/${cloudKey}`
    const signature = this.sign(stringToSign)

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 0,
      totalFiles: 1,
      percent: 50,
    })

    const response = await fetch(`https://${host}/${cloudKey}`, {
      method: "PUT",
      headers: {
        "Authorization": `OSS ${this.config.accessKey}:${signature}`,
        "Content-Type": contentType,
        "Date": date,
        "Content-Length": fileBuffer.length.toString(),
      },
      body: fileBuffer,
    })

    if (!response.ok) {
      throw new Error(`阿里云 OSS 上传失败: ${response.status} ${await response.text()}`)
    }

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 1,
      totalFiles: 1,
      percent: 100,
    })
  }

  async download(cloudKey: string, localPath: string): Promise<void> {
    const {
      fs,
      path,
    } = requireFsPath()
    const host = this.getHost()
    const date = new Date().toUTCString()
    const stringToSign = `GET\n\n\n${date}\n/${this.config.bucket}/${cloudKey}`
    const signature = this.sign(stringToSign)

    const response = await fetch(`https://${host}/${cloudKey}`, {
      headers: {
        Authorization: `OSS ${this.config.accessKey}:${signature}`,
        Date: date,
      },
    })
    if (!response.ok) {
      throw new Error(`阿里云 OSS 下载失败: ${response.status}`)
    }
    const buffer = await response.arrayBuffer()
    await fs.mkdir(path.dirname(localPath), { recursive: true })
    await fs.writeFile(localPath, Buffer.from(buffer))
  }

  async list(prefix: string): Promise<CloudFileInfo[]> {
    const host = this.getHost()
    const date = new Date().toUTCString()
    const stringToSign = `GET\n\n\n${date}\n/${this.config.bucket}/`
    const signature = this.sign(stringToSign)

    const response = await fetch(`https://${host}/?prefix=${prefix}&max-keys=100`, {
      headers: {
        Authorization: `OSS ${this.config.accessKey}:${signature}`,
        Date: date,
      },
    })
    if (!response.ok) {
      throw new Error(`阿里云 OSS 列举失败: ${response.status}`)
    }
    return parseOssXmlResponse(await response.text())
  }

  async delete(cloudKey: string): Promise<void> {
    const host = this.getHost()
    const date = new Date().toUTCString()
    const stringToSign = `DELETE\n\n\n${date}\n/${this.config.bucket}/${cloudKey}`
    const signature = this.sign(stringToSign)

    const response = await fetch(`https://${host}/${cloudKey}`, {
      method: "DELETE",
      headers: {
        Authorization: `OSS ${this.config.accessKey}:${signature}`,
        Date: date,
      },
    })
    if (!response.ok && response.status !== 204) {
      throw new Error(`阿里云 OSS 删除失败: ${response.status}`)
    }
  }

  async test(): Promise<CloudTestResult> {
    try {
      await this.list(this.config.prefix || "siyuan-backup/")
      return {
        success: true,
        message: "阿里云 OSS 连接成功",
      }
    } catch (err: any) {
      return {
        success: false,
        message: `阿里云 OSS 连接失败: ${err.message}`,
      }
    }
  }
}

// ========== 腾讯云 COS Provider ==========

class TencentProvider implements CloudProvider {
  private config: CloudProviderConfig

  constructor(config: CloudProviderConfig) {
    this.config = config
  }

  private getHost(): string {
    const region = this.config.region || "ap-guangzhou"
    return `${this.config.bucket}.cos.${region}.myqcloud.com`
  }

  private getAuthorization(method: string, key: string, _date?: string, _contentType?: string): string {
    const crypto = requireCrypto()

    const startTime = Math.floor(Date.now() / 1000) - 60
    const endTime = startTime + 3600
    const keyTime = `${startTime};${endTime}`

    const signKey = crypto.createHmac("sha1", this.config.secretKey).update(keyTime).digest("hex")
    const httpString = `${method.toUpperCase()}\n/${key}\n\nhost=${this.getHost()}\n`
    const stringToSign = `sha1\n${keyTime}\n${crypto.createHash("sha1").update(httpString).digest("hex")}\n`
    const signature = crypto.createHmac("sha1", signKey).update(stringToSign).digest("hex")

    return [
      `q-sign-algorithm=sha1`,
      `q-ak=${this.config.accessKey}`,
      `q-sign-time=${keyTime}`,
      `q-key-time=${keyTime}`,
      `q-header-list=host`,
      `q-url-param-list=`,
      `q-signature=${signature}`,
    ].join("&")
  }

  async upload(localPath: string, cloudKey: string, options?: CloudUploadOptions): Promise<void> {
    const { fs } = requireFsPath()
    const fileBuffer = await fs.readFile(localPath)
    const host = this.getHost()
    const date = new Date().toUTCString()
    const contentType = "application/zip"
    const authorization = this.getAuthorization("put", cloudKey, date, contentType)

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 0,
      totalFiles: 1,
      percent: 50,
    })

    const response = await fetch(`https://${host}/${cloudKey}`, {
      method: "PUT",
      headers: {
        "Authorization": authorization,
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Date": date,
      },
      body: fileBuffer,
    })

    if (!response.ok) {
      throw new Error(`腾讯云 COS 上传失败: ${response.status} ${await response.text()}`)
    }

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 1,
      totalFiles: 1,
      percent: 100,
    })
  }

  async download(cloudKey: string, localPath: string): Promise<void> {
    const {
      fs,
      path,
    } = requireFsPath()
    const host = this.getHost()
    const date = new Date().toUTCString()
    const authorization = this.getAuthorization("get", cloudKey, date)

    const response = await fetch(`https://${host}/${cloudKey}`, {
      headers: {
        Authorization: authorization,
        Date: date,
      },
    })
    if (!response.ok) {
      throw new Error(`腾讯云 COS 下载失败: ${response.status}`)
    }
    const buffer = await response.arrayBuffer()
    await fs.mkdir(path.dirname(localPath), { recursive: true })
    await fs.writeFile(localPath, Buffer.from(buffer))
  }

  async list(prefix: string): Promise<CloudFileInfo[]> {
    const host = this.getHost()
    const date = new Date().toUTCString()
    const authorization = this.getAuthorization("get", "", date)

    const response = await fetch(`https://${host}/?prefix=${prefix}&max-keys=100`, {
      headers: {
        Authorization: authorization,
        Date: date,
      },
    })
    if (!response.ok) {
      throw new Error(`腾讯云 COS 列举失败: ${response.status}`)
    }
    return parseOssXmlResponse(await response.text())
  }

  async delete(cloudKey: string): Promise<void> {
    const host = this.getHost()
    const date = new Date().toUTCString()
    const authorization = this.getAuthorization("delete", cloudKey, date)

    const response = await fetch(`https://${host}/${cloudKey}`, {
      method: "DELETE",
      headers: {
        Authorization: authorization,
        Date: date,
      },
    })
    if (!response.ok && response.status !== 204) {
      throw new Error(`腾讯云 COS 删除失败: ${response.status}`)
    }
  }

  async test(): Promise<CloudTestResult> {
    try {
      await this.list(this.config.prefix || "siyuan-backup/")
      return {
        success: true,
        message: "腾讯云 COS 连接成功",
      }
    } catch (err: any) {
      return {
        success: false,
        message: `腾讯云 COS 连接失败: ${err.message}`,
      }
    }
  }
}

// ========== 公共 XML 解析（阿里云/腾讯云 通用） ==========

function parseOssXmlResponse(xml: string): CloudFileInfo[] {
  const results: CloudFileInfo[] = []
  const regex = /<Contents>\s*<Key>(.*?)<\/Key>\s*<LastModified>(.*?)<\/LastModified>\s*<Size>(.*?)<\/Size>\s*<\/Contents>/gs
  let match
  while ((match = regex.exec(xml)) !== null) {
    results.push({
      name: match[1].split("/").pop() || match[1],
      key: match[1],
      size: Number.parseInt(match[3], 10),
      lastModified: match[2],
    })
  }
  return results
}

// ========== Provider 注册表 ==========

const providerFactories: Record<CloudProviderType, ProviderFactory> = {
  qiniu: (cfg) => new QiniuProvider(cfg),
  alibaba: (cfg) => new AlibabaProvider(cfg),
  tencent: (cfg) => new TencentProvider(cfg),
}

// ========== CloudBackupManager ==========

export class CloudBackupManager {
  private config: CloudProviderConfig | null = null
  private storage: PluginStorage

  constructor(plugin: any) {
    this.storage = new PluginStorage(plugin)
  }

  /** 加载云备份配置 */
  async loadConfig(): Promise<CloudProviderConfig | null> {
    try {
      const data = await this.storage.load<CloudProviderConfig>("cloud-backup-config")
      if (data) {
        this.config = data
        return data
      }
    } catch (error) {
      console.error("加载云备份配置失败:", error)
    }
    return null
  }

  /**
   * 加载指定的云配置（用于多云切换场景）
   * @param configId 配置标识（如 "qiniu-main", "tencent-backup"）
   */
  async loadConfigById(configId: string): Promise<CloudProviderConfig | null> {
    try {
      const data = await this.storage.load<CloudProviderConfig>(`cloud-backup-config-${configId}`)
      return data || null
    } catch (error) {
      console.error(`加载云配置失败 (${configId}):`, error)
      return null
    }
  }

  /** 保存云备份配置 */
  async saveConfig(config: CloudProviderConfig): Promise<void> {
    this.config = config
    await this.storage.save("cloud-backup-config", config)
  }

  /**
   * 保存指定 ID 的云配置（用于多云管理）
   * @param configId 配置标识
   * @param config 云配置
   */
  async saveConfigById(configId: string, config: CloudProviderConfig): Promise<void> {
    await this.storage.save(`cloud-backup-config-${configId}`, config)
  }

  /** 列出所有已保存的云配置 ID */
  async listConfigIds(): Promise<string[]> {
    // 简化为返回已知 ID 列表，可根据实际存储扩展
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      const id = `cloud-${i}`
      const data = await this.storage.load<CloudProviderConfig>(`cloud-backup-config-${id}`)
      if (data) ids.push(id)
    }
    // 也包含默认配置
    if (this.config) ids.unshift("default")
    return ids
  }

  /** 测试云存储连接 */
  async testConnection(config?: CloudProviderConfig): Promise<CloudTestResult> {
    const cfg = config || this.config
    if (!cfg) {
      return {
        success: false,
        message: "未配置云存储",
      }
    }
    const provider = this.createProvider(cfg)
    return provider.test()
  }

  /**
   * 上传备份文件到云存储
   * @param localFilePath 本地文件路径
   * @param options 上传选项，可指定 cloudConfig 来覆盖默认配置
   */
  async upload(
    localFilePath: string,
    options?: CloudUploadOptions & { cloudConfig?: CloudProviderConfig },
  ): Promise<void> {
    const cfg = options?.cloudConfig || this.config
    if (!cfg) {
      throw new Error("未配置云存储")
    }

    const provider = this.createProvider(cfg)
    const { path } = requireFsPath()
    const fileName = path.basename(localFilePath)
    const prefix = cfg.prefix || "siyuan-backup/"
    const cloudKey = `${prefix}${fileName}`

    await provider.upload(localFilePath, cloudKey, options)
  }

  /** 从云存储下载备份文件 */
  async download(
    cloudKey: string,
    localFilePath: string,
    config?: CloudProviderConfig,
  ): Promise<void> {
    const cfg = config || this.config
    if (!cfg) {
      throw new Error("未配置云存储")
    }
    const provider = this.createProvider(cfg)
    await provider.download(cloudKey, localFilePath)
  }

  /** 列出云端备份文件 */
  async listBackups(config?: CloudProviderConfig): Promise<CloudFileInfo[]> {
    const cfg = config || this.config
    if (!cfg) return []
    const provider = this.createProvider(cfg)
    const prefix = cfg.prefix || "siyuan-backup/"
    return provider.list(prefix)
  }

  /** 删除云端备份文件 */
  async deleteBackup(cloudKey: string, config?: CloudProviderConfig): Promise<void> {
    const cfg = config || this.config
    if (!cfg) throw new Error("未配置云存储")
    const provider = this.createProvider(cfg)
    await provider.delete(cloudKey)
  }

  /** 获取当前配置 */
  get currentConfig(): CloudProviderConfig | null {
    return this.config
  }

  private createProvider(config: CloudProviderConfig): CloudProvider {
    const factory = providerFactories[config.type]
    if (!factory) {
      throw new Error(`不支持的云存储类型: ${config.type}`)
    }
    return factory(config)
  }
}
