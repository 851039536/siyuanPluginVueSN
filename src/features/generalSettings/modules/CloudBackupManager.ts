/**
 * 云备份管理器
 * 支持：七牛云、阿里云 OSS、腾讯云 COS
 *
 * 认证流程均为客户端直传模式：
 *   1. 使用 AccessKey/SecretKey 在客户端生成签名
 *   2. 通过 REST API 直接上传/下载/列举文件
 */
import type { BackupProgress } from "./BackupManager";

// ========== 类型定义 ==========

export type CloudProviderType = "qiniu" | "alibaba" | "tencent";

export interface CloudProviderConfig {
  type: CloudProviderType;
  /** 七牛: AccessKey | 阿里: AccessKeyId | 腾讯: SecretId */
  accessKey: string;
  /** 七牛: SecretKey | 阿里: AccessKeySecret | 腾讯: SecretKey */
  secretKey: string;
  /** 七牛: Bucket | 阿里: Bucket | 腾讯: Bucket */
  bucket: string;
  /** 七牛: 上传域名 (如 https://up.qiniup.com) | 阿里: Endpoint | 腾讯: 可不填 */
  endpoint?: string;
  /** 七牛: 可不填 | 阿里: Region (如 oss-cn-hangzhou) | 腾讯: Region (如 ap-guangzhou) */
  region?: string;
  /** 备份文件在云端的目录前缀 */
  prefix?: string;
}

export interface CloudFileInfo {
  name: string;
  key: string;
  size: number;
  lastModified: string;
}

export interface CloudUploadOptions {
  onProgress?: (progress: BackupProgress) => void;
}

export interface CloudTestResult {
  success: boolean;
  message: string;
}

// ========== 七牛云 Provider ==========

class QiniuProvider {
  private config: CloudProviderConfig;

  constructor(config: CloudProviderConfig) {
    this.config = config;
  }

  /**
   * 生成七牛上传凭证（简化版，适合小文件直传）
   * 生产环境建议由后端生成 token
   */
  private generateUploadToken(key: string): string {
    const putPolicy = {
      scope: `${this.config.bucket}:${key}`,
      deadline: Math.floor(Date.now() / 1000) + 3600,
    };
    const encodedPolicy = this.base64UrlEncode(JSON.stringify(putPolicy));
    const sign = this.hmacSha1(this.config.secretKey, encodedPolicy);
    const encodedSign = this.base64UrlEncode(sign);
    return `${this.config.accessKey}:${encodedSign}:${encodedPolicy}`;
  }

  async upload(localPath: string, cloudKey: string, options?: CloudUploadOptions): Promise<void> {
    const fs = window.require("fs").promises;
    const fileBuffer = await fs.readFile(localPath);
    const token = this.generateUploadToken(cloudKey);

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 0,
      totalFiles: 1,
      percent: 50,
    });

    const uploadDomain = this.config.endpoint || "https://up.qiniup.com";
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer]));
    formData.append("key", cloudKey);
    formData.append("token", token);

    const response = await fetch(`${uploadDomain}/putb64/${fileBuffer.length}/key/${this.base64UrlEncode(cloudKey)}`, {
      method: "POST",
      headers: {
        Authorization: `UpToken ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`七牛上传失败: ${response.status} ${await response.text()}`);
    }

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 1,
      totalFiles: 1,
      percent: 100,
    });
  }

  async download(cloudKey: string, localPath: string): Promise<void> {
    const fs = window.require("fs").promises;
    const path = window.require("path");
    // 七牛下载使用公开链接或私有链接
    const downloadUrl = this.getDownloadUrl(cloudKey);
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`七牛下载失败: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, Buffer.from(buffer));
  }

  async list(prefix: string): Promise<CloudFileInfo[]> {
    // 七牛列举文件需要 RSF API
    const url = `https://rsf.qiniuapi.com/list?bucket=${this.config.bucket}&prefix=${prefix}&limit=100`;
    const sign = this.hmacSha1(this.config.secretKey, `GET\n${new URL(url).path}`);
    const encodedSign = this.base64UrlEncode(sign);
    const response = await fetch(url, {
      headers: {
        Authorization: `Qiniu ${this.config.accessKey}:${encodedSign}`,
      },
    });
    if (!response.ok) {
      throw new Error(`七牛列举文件失败: ${response.status}`);
    }
    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      name: item.key.split("/").pop(),
      key: item.key,
      size: item.fsize,
      lastModified: new Date(item.putTime / 10000).toISOString(),
    }));
  }

  async delete(cloudKey: string): Promise<void> {
    const encodedKey = this.base64UrlEncode(cloudKey);
    const url = `https://rs.qiniuapi.com/delete/${this.base64UrlEncode(this.config.bucket)}/${encodedKey}`;
    const sign = this.hmacSha1(this.config.secretKey, `POST\n${new URL(url).path}`);
    const encodedSign = this.base64UrlEncode(sign);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Qiniu ${this.config.accessKey}:${encodedSign}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    if (!response.ok) {
      throw new Error(`七牛删除失败: ${response.status}`);
    }
  }

  async test(): Promise<CloudTestResult> {
    try {
      await this.list(this.config.prefix || "siyuan-backup/");
      return { success: true, message: "七牛云连接成功" };
    } catch (err: any) {
      return { success: false, message: `七牛云连接失败: ${err.message}` };
    }
  }

  private getDownloadUrl(key: string): string {
    const domain = this.config.endpoint || `https://${this.config.bucket}.qiniudn.com`;
    return `${domain}/${key}`;
  }

  private base64UrlEncode(str: string): string {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  private hmacSha1(key: string, data: string): string {
    // 简化的 HMAC-SHA1（Electron 环境使用 Node crypto）
    if (typeof window.require === "function") {
      const crypto = window.require("crypto");
      return crypto.createHmac("sha1", key).update(data).digest("base64");
    }
    throw new Error("HMAC-SHA1 需要 Node.js 环境");
  }
}

// ========== 阿里云 OSS Provider ==========

class AlibabaProvider {
  private config: CloudProviderConfig;

  constructor(config: CloudProviderConfig) {
    this.config = config;
  }

  async upload(localPath: string, cloudKey: string, options?: CloudUploadOptions): Promise<void> {
    const fs = window.require("fs").promises;
    const fileBuffer = await fs.readFile(localPath);
    const region = this.config.region || "oss-cn-hangzhou";
    const endpoint = this.config.endpoint || `${this.config.bucket}.${region}.aliyuncs.com`;
    const host = `${this.config.bucket}.${region}.aliyuncs.com`;
    const date = new Date().toUTCString();
    const contentType = "application/zip";

    const stringToSign = `PUT\n\n${contentType}\n${date}\n/${this.config.bucket}/${cloudKey}`;
    const signature = this.sign(stringToSign);

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 0,
      totalFiles: 1,
      percent: 50,
    });

    const response = await fetch(`https://${host}/${cloudKey}`, {
      method: "PUT",
      headers: {
        Authorization: `OSS ${this.config.accessKey}:${signature}`,
        "Content-Type": contentType,
        Date: date,
        "Content-Length": fileBuffer.length.toString(),
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`阿里云 OSS 上传失败: ${response.status} ${await response.text()}`);
    }

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 1,
      totalFiles: 1,
      percent: 100,
    });
  }

  async download(cloudKey: string, localPath: string): Promise<void> {
    const fs = window.require("fs").promises;
    const path = window.require("path");
    const region = this.config.region || "oss-cn-hangzhou";
    const host = `${this.config.bucket}.${region}.aliyuncs.com`;
    const date = new Date().toUTCString();
    const stringToSign = `GET\n\n\n${date}\n/${this.config.bucket}/${cloudKey}`;
    const signature = this.sign(stringToSign);

    const response = await fetch(`https://${host}/${cloudKey}`, {
      headers: {
        Authorization: `OSS ${this.config.accessKey}:${signature}`,
        Date: date,
      },
    });

    if (!response.ok) {
      throw new Error(`阿里云 OSS 下载失败: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, Buffer.from(buffer));
  }

  async list(prefix: string): Promise<CloudFileInfo[]> {
    const region = this.config.region || "oss-cn-hangzhou";
    const host = `${this.config.bucket}.${region}.aliyuncs.com`;
    const date = new Date().toUTCString();
    const stringToSign = `GET\n\n\n${date}\n/${this.config.bucket}/`;
    const signature = this.sign(stringToSign);

    const response = await fetch(`https://${host}/?prefix=${prefix}&max-keys=100`, {
      headers: {
        Authorization: `OSS ${this.config.accessKey}:${signature}`,
        Date: date,
      },
    });

    if (!response.ok) {
      throw new Error(`阿里云 OSS 列举失败: ${response.status}`);
    }

    const text = await response.text();
    return this.parseListResponse(text);
  }

  async delete(cloudKey: string): Promise<void> {
    const region = this.config.region || "oss-cn-hangzhou";
    const host = `${this.config.bucket}.${region}.aliyuncs.com`;
    const date = new Date().toUTCString();
    const stringToSign = `DELETE\n\n\n${date}\n/${this.config.bucket}/${cloudKey}`;
    const signature = this.sign(stringToSign);

    const response = await fetch(`https://${host}/${cloudKey}`, {
      method: "DELETE",
      headers: {
        Authorization: `OSS ${this.config.accessKey}:${signature}`,
        Date: date,
      },
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`阿里云 OSS 删除失败: ${response.status}`);
    }
  }

  async test(): Promise<CloudTestResult> {
    try {
      await this.list(this.config.prefix || "siyuan-backup/");
      return { success: true, message: "阿里云 OSS 连接成功" };
    } catch (err: any) {
      return { success: false, message: `阿里云 OSS 连接失败: ${err.message}` };
    }
  }

  private sign(stringToSign: string): string {
    if (typeof window.require === "function") {
      const crypto = window.require("crypto");
      return crypto.createHmac("sha1", this.config.secretKey).update(stringToSign).digest("base64");
    }
    throw new Error("签名需要 Node.js 环境");
  }

  private parseListResponse(xml: string): CloudFileInfo[] {
    const results: CloudFileInfo[] = [];
    const regex = /<Contents>\s*<Key>(.*?)<\/Key>\s*<LastModified>(.*?)<\/LastModified>\s*<Size>(.*?)<\/Size>\s*<\/Contents>/gs;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      results.push({
        name: match[1].split("/").pop(),
        key: match[1],
        size: Number.parseInt(match[3], 10),
        lastModified: match[2],
      });
    }
    return results;
  }
}

// ========== 腾讯云 COS Provider ==========

class TencentProvider {
  private config: CloudProviderConfig;

  constructor(config: CloudProviderConfig) {
    this.config = config;
  }

  async upload(localPath: string, cloudKey: string, options?: CloudUploadOptions): Promise<void> {
    const fs = window.require("fs").promises;
    const fileBuffer = await fs.readFile(localPath);
    const region = this.config.region || "ap-guangzhou";
    const host = `${this.config.bucket}.cos.${region}.myqcloud.com`;
    const date = this.getTimestamp();
    const contentType = "application/zip";

    const authorization = this.getAuthorization("put", cloudKey, date, contentType);

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 0,
      totalFiles: 1,
      percent: 50,
    });

    const response = await fetch(`https://${host}/${cloudKey}`, {
      method: "PUT",
      headers: {
        Authorization: authorization,
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        Date: date,
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      throw new Error(`腾讯云 COS 上传失败: ${response.status} ${await response.text()}`);
    }

    options?.onProgress?.({
      phase: "uploading",
      currentFile: cloudKey,
      filesProcessed: 1,
      totalFiles: 1,
      percent: 100,
    });
  }

  async download(cloudKey: string, localPath: string): Promise<void> {
    const fs = window.require("fs").promises;
    const path = window.require("path");
    const region = this.config.region || "ap-guangzhou";
    const host = `${this.config.bucket}.cos.${region}.myqcloud.com`;
    const date = this.getTimestamp();
    const authorization = this.getAuthorization("get", cloudKey, date);

    const response = await fetch(`https://${host}/${cloudKey}`, {
      headers: {
        Authorization: authorization,
        Date: date,
      },
    });

    if (!response.ok) {
      throw new Error(`腾讯云 COS 下载失败: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, Buffer.from(buffer));
  }

  async list(prefix: string): Promise<CloudFileInfo[]> {
    const region = this.config.region || "ap-guangzhou";
    const host = `${this.config.bucket}.cos.${region}.myqcloud.com`;
    const date = this.getTimestamp();
    const authorization = this.getAuthorization("get", "", date);

    const response = await fetch(`https://${host}/?prefix=${prefix}&max-keys=100`, {
      headers: {
        Authorization: authorization,
        Date: date,
      },
    });

    if (!response.ok) {
      throw new Error(`腾讯云 COS 列举失败: ${response.status}`);
    }

    const text = await response.text();
    return this.parseListResponse(text);
  }

  async delete(cloudKey: string): Promise<void> {
    const region = this.config.region || "ap-guangzhou";
    const host = `${this.config.bucket}.cos.${region}.myqcloud.com`;
    const date = this.getTimestamp();
    const authorization = this.getAuthorization("delete", cloudKey, date);

    const response = await fetch(`https://${host}/${cloudKey}`, {
      method: "DELETE",
      headers: {
        Authorization: authorization,
        Date: date,
      },
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`腾讯云 COS 删除失败: ${response.status}`);
    }
  }

  async test(): Promise<CloudTestResult> {
    try {
      await this.list(this.config.prefix || "siyuan-backup/");
      return { success: true, message: "腾讯云 COS 连接成功" };
    } catch (err: any) {
      return { success: false, message: `腾讯云 COS 连接失败: ${err.message}` };
    }
  }

  private getTimestamp(): string {
    return new Date().toUTCString();
  }

  private getAuthorization(method: string, key: string, date: string, contentType?: string): string {
    if (typeof window.require !== "function") {
      throw new Error("签名需要 Node.js 环境");
    }
    const crypto = window.require("crypto");
    const region = this.config.region || "ap-guangzhou";
    const service = "cos";
    const startTime = Math.floor(Date.now() / 1000) - 60;
    const endTime = startTime + 3600;
    const keyTime = `${startTime};${endTime}`;

    // 简化的 COS 签名
    const signKey = crypto.createHmac("sha1", this.config.secretKey).update(keyTime).digest("hex");
    const httpString = `${method.toUpperCase()}\n/${key}\n\nhost=${this.config.bucket}.cos.${region}.myqcloud.com\n`;
    const stringToSign = `sha1\n${keyTime}\n${crypto.createHash("sha1").update(httpString).digest("hex")}\n`;
    const signature = crypto.createHmac("sha1", signKey).update(stringToSign).digest("hex");

    return (
      `q-sign-algorithm=sha1&` +
      `q-ak=${this.config.accessKey}&` +
      `q-sign-time=${keyTime}&` +
      `q-key-time=${keyTime}&` +
      `q-header-list=host&` +
      `q-url-param-list=&` +
      `q-signature=${signature}`
    );
  }

  private parseListResponse(xml: string): CloudFileInfo[] {
    const results: CloudFileInfo[] = [];
    const regex = /<Contents>\s*<Key>(.*?)<\/Key>\s*<LastModified>(.*?)<\/LastModified>\s*<Size>(.*?)<\/Size>\s*<\/Contents>/gs;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      results.push({
        name: match[1].split("/").pop(),
        key: match[1],
        size: Number.parseInt(match[3], 10),
        lastModified: match[2],
      });
    }
    return results;
  }
}

// ========== CloudBackupManager ==========

import { PluginStorage } from "@/utils/pluginStorage";

export class CloudBackupManager {
  private config: CloudProviderConfig | null = null;
  private plugin: any;
  private storage: PluginStorage;

  constructor(plugin: any) {
    this.plugin = plugin;
    this.storage = new PluginStorage(plugin);
  }

  /**
   * 加载云备份配置
   */
  async loadConfig(): Promise<CloudProviderConfig | null> {
    try {
      const data = await this.storage.load<CloudProviderConfig>("cloud-backup-config");
      if (data) {
        this.config = data;
        return data;
      }
    } catch (error) {
      console.error("加载云备份配置失败:", error);
    }
    return null;
  }

  /**
   * 保存云备份配置
   */
  async saveConfig(config: CloudProviderConfig): Promise<void> {
    this.config = config;
    await this.storage.save("cloud-backup-config", config);
  }

  /**
   * 测试云存储连接
   */
  async testConnection(config?: CloudProviderConfig): Promise<CloudTestResult> {
    const cfg = config || this.config;
    if (!cfg) {
      return { success: false, message: "未配置云存储" };
    }
    const provider = this.createProvider(cfg);
    return provider.test();
  }

  /**
   * 上传备份文件到云存储
   */
  async upload(
    localFilePath: string,
    options?: CloudUploadOptions,
  ): Promise<void> {
    if (!this.config) {
      throw new Error("未配置云存储");
    }

    const provider = this.createProvider(this.config);
    const path = window.require("path");
    const fileName = path.basename(localFilePath);
    const prefix = this.config.prefix || "siyuan-backup/";
    const cloudKey = `${prefix}${fileName}`;

    await provider.upload(localFilePath, cloudKey, options);
  }

  /**
   * 从云存储下载备份文件
   */
  async download(cloudKey: string, localFilePath: string): Promise<void> {
    if (!this.config) {
      throw new Error("未配置云存储");
    }

    const provider = this.createProvider(this.config);
    await provider.download(cloudKey, localFilePath);
  }

  /**
   * 列出云端备份文件
   */
  async listBackups(): Promise<CloudFileInfo[]> {
    if (!this.config) {
      return [];
    }

    const provider = this.createProvider(this.config);
    const prefix = this.config.prefix || "siyuan-backup/";
    return provider.list(prefix);
  }

  /**
   * 删除云端备份文件
   */
  async deleteBackup(cloudKey: string): Promise<void> {
    if (!this.config) {
      throw new Error("未配置云存储");
    }

    const provider = this.createProvider(this.config);
    await provider.delete(cloudKey);
  }

  /**
   * 自动上传最新备份（供自动备份流程调用）
   */
  async autoUploadLatest(localFilePath: string): Promise<boolean> {
    try {
      await this.upload(localFilePath);
      return true;
    } catch (err) {
      console.error("自动云备份失败:", err);
      return false;
    }
  }

  private createProvider(config: CloudProviderConfig): QiniuProvider | AlibabaProvider | TencentProvider {
    switch (config.type) {
      case "qiniu":
        return new QiniuProvider(config);
      case "alibaba":
        return new AlibabaProvider(config);
      case "tencent":
        return new TencentProvider(config);
      default:
        throw new Error(`不支持的云存储类型: ${config.type}`);
    }
  }
}
