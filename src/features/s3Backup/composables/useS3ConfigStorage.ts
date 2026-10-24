/**
 * S3 配置持久化 composable
 *
 * 统一 S3 配置的读取解密与保存加密，存储键与 enc: 格式保持不变；
 * 保存结果以判别对象返回，供配置 Tab 做面板内联反馈。
 */
import type { S3Config } from "../types"
import { getErrorMessage } from "@/utils/stringUtils"
import { decryptSetting, encryptSettingStrict } from "@/utils/settingsCrypto"
import { getS3BackupInstance } from "../instance"

export interface SaveS3ConfigResult {
  success: boolean
  /** 失败时的技术原因（展示层负责拼接 i18n 前缀） */
  error?: string
}

export interface S3ConfigStorageDeps {
  /** 加载后应用（仅 endpoint 有效时生效，保持既有语义） */
  loadConfig: (config: S3Config) => void
  /** 保存成功后应用 */
  applyConfig: (config: S3Config) => void
  /** 保存成功后刷新云端列表 */
  refreshBackupList: () => Promise<void>
}

export function useS3ConfigStorage(deps: S3ConfigStorageDeps) {
  /** 读取并解密已保存配置；失败仅告警，不阻断面板初始化 */
  async function loadS3Config(): Promise<void> {
    const instance = getS3BackupInstance()
    if (!instance) { return }
    try {
      const saved = await instance.getStorage().s3Config.load()
      if (!saved) { return }
      deps.loadConfig({
        ...saved,
        accessKey: await decryptSetting(saved.accessKey),
        secretKey: await decryptSetting(saved.secretKey),
      })
    } catch (err: unknown) {
      console.error("[S3备份] 加载 S3 配置失败:", err)
    }
  }

  /**
   * 加密并保存配置；先落盘成功再应用，避免失败时污染当前运行时配置。
   * PluginStorage.save 会吞掉异常并返回 false，必须检查返回值。
   */
  async function saveS3Config(config: S3Config): Promise<SaveS3ConfigResult> {
    const instance = getS3BackupInstance()
    if (!instance) {
      return { success: false }
    }
    try {
      const encrypted: S3Config = {
        ...config,
        accessKey: await encryptSettingStrict(config.accessKey),
        secretKey: await encryptSettingStrict(config.secretKey),
      }
      const saved = await instance.getStorage().s3Config.save(encrypted)
      if (!saved) {
        return { success: false }
      }
      deps.applyConfig(config)
      void deps.refreshBackupList()
      return { success: true }
    } catch (err: unknown) {
      console.error("[S3备份] 保存 S3 配置失败:", err)
      return { success: false, error: getErrorMessage(err) }
    }
  }

  return { loadS3Config, saveS3Config }
}
