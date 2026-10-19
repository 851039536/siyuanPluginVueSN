/**
 * S3 文件管理器客户端配置管理 composable
 *
 * 维护 S3 连接配置与客户端实例：启动加载（解密凭证）、应用配置、
 * 连接测试。配置的保存/导入由自包含的 FmConfigDialog 直接操作存储槽完成。
 */
import { ref } from "vue"
import type { S3Config } from "@/utils/s3/types"
import { DEFAULT_S3_CONFIG } from "@/utils/s3/types"
import { S3Client } from "@/utils/s3/s3Client"
import { decryptSetting } from "@/utils/settingsCrypto"
import type { S3FileManagerI18n } from "../types"
import type { S3FileManagerStorage } from "../types/storage"

export function useS3FmClient(deps: { storage: S3FileManagerStorage; i18n: S3FileManagerI18n }) {
  const s3Config = ref<S3Config>({ ...DEFAULT_S3_CONFIG })
  const isConfigured = ref(false)

  let client: S3Client | null = null

  /** 应用配置并重建客户端实例 */
  function applyConfig(config: S3Config): void {
    s3Config.value = { ...config }
    isConfigured.value = true
    client = new S3Client(config)
  }

  /** 获取已初始化的客户端，未配置时抛错（文案进入 UI 错误提示） */
  function requireClient(): S3Client {
    if (!client) { throw new Error(deps.i18n.clientNotInitialized) }
    return client
  }

  /**
   * 启动加载持久化配置（凭证解密；关键字段齐备才应用）。
   * 存储读取与解密均在各自实现内收敛失败（返回 null / 原值），无异常路径可捕获。
   */
  async function loadConfig(): Promise<void> {
    const saved = await deps.storage.config.loadOrDefault()
    const decrypted: S3Config = {
      ...saved,
      accessKey: await decryptSetting(saved.accessKey),
      secretKey: await decryptSetting(saved.secretKey),
    }
    if (decrypted.endpoint && decrypted.bucket && decrypted.accessKey && decrypted.secretKey) {
      applyConfig(decrypted)
    } else {
      s3Config.value = decrypted
      isConfigured.value = false
      client = null
    }
  }

  /** 归一化的根前缀（空串或以 / 结尾），作为文件管理器的浏览根 */
  function getRootPrefix(): string {
    // 先 trim 再去前导斜杠：粘贴 " /a/ " 这类带空格的值时，先 replace 会因首字符是空格而不命中
    const p = s3Config.value.prefix.trim().replace(/^\/+/, "")
    if (!p) { return "" }
    return p.endsWith("/") ? p : `${p}/`
  }

  return {
    s3Config,
    isConfigured,
    applyConfig,
    requireClient,
    loadConfig,
    getRootPrefix,
  }
}
