/**
 * S3 备份功能的共享状态与操作逻辑
 *
 * 提供响应式的 S3 配置、备份状态、备份列表等状态，
 * 以及连接测试、备份、恢复、列举、删除等操作方法。
 * 被 index.vue 和子组件 S3ConfigForm.vue 共享使用。
 */
import { computed, ref } from "vue"
import type { S3Config, S3FileInfo } from "../types"
import { DEFAULT_S3_CONFIG } from "../types"
import { S3Client } from "../types/s3Client"

export function useS3Backup() {
  // ========== 状态 ==========

  const s3Config = ref<S3Config>({ ...DEFAULT_S3_CONFIG })
  const isConfigured = ref(false)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const isBackingUp = ref(false)
  const isLoading = ref(false)

  const backupProgress = ref({
    phase: "" as string,
    currentFile: "",
    filesProcessed: 0,
    totalFiles: 0,
    percent: 0,
  })

  const backupList = ref<S3FileInfo[]>([])
  const error = ref<string | null>(null)

  let s3Client: S3Client | null = null

  // ========== 计算属性 ==========

  const phaseLabel = computed(() => {
    const labels: Record<string, string> = {
      scanning: "扫描文件",
      uploading: "上传文件",
    }
    return labels[backupProgress.value.phase] || backupProgress.value.phase
  })

  // ========== 方法 ==========

  /** 初始化或更新 S3 客户端 */
  function initClient(config?: S3Config): S3Client {
    const cfg = config || s3Config.value
    s3Client = new S3Client(cfg)
    return s3Client
  }

  /** 测试 S3 连接 */
  async function testConnection(config?: S3Config): Promise<{ success: boolean; message: string }> {
    const cfg = config || s3Config.value
    isConnecting.value = true
    error.value = null

    try {
      const client = initClient(cfg)
      const result = await client.testConnection()
      isConnected.value = result.success
      return result
    } catch (err: any) {
      isConnected.value = false
      return { success: false, message: `连接测试异常: ${err.message}` }
    } finally {
      isConnecting.value = false
    }
  }

  /** 保存 S3 配置 */
  function saveConfig(config: S3Config): void {
    s3Config.value = { ...config }
    isConfigured.value = true
    isConnected.value = false // 重置连接状态，需要重新测试
    initClient(config)
  }

  /** 执行备份：本地打包 → S3 上传 */
  async function performBackup(
    localZipPath: string,
    s3Key: string,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    if (!s3Client) throw new Error("S3 客户端未初始化")

    isBackingUp.value = true
    error.value = null

    try {
      await s3Client.upload(localZipPath, s3Key, onProgress)
    } catch (err: any) {
      error.value = err.message
      throw err
    } finally {
      isBackingUp.value = false
    }
  }

  /** 直接上传文件内容到 S3（跳过本地打包，用于逐文件上传模式） */
  async function uploadFileContent(buffer: Buffer, key: string): Promise<void> {
    if (!s3Client) { throw new Error("S3 客户端未初始化") }
    await s3Client.uploadBuffer(buffer, key)
  }

  /** 列举 S3 备份文件 */
  async function listBackups(): Promise<S3FileInfo[]> {
    if (!s3Client) throw new Error("S3 客户端未初始化")

    isLoading.value = true
    error.value = null

    try {
      const prefix = s3Config.value.prefix || "siyuan-backup/"
      const files = await s3Client.list(prefix)
      backupList.value = files
      return files
    } catch (err: any) {
      error.value = err.message
      backupList.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }

  /** 下载 S3 备份文件 */
  async function downloadBackup(s3Key: string, localPath: string): Promise<void> {
    if (!s3Client) throw new Error("S3 客户端未初始化")
    error.value = null

    try {
      await s3Client.download(s3Key, localPath)
    } catch (err: any) {
      error.value = err.message
      throw err
    }
  }

  /** 删除 S3 备份文件 */
  async function deleteBackup(s3Key: string): Promise<void> {
    if (!s3Client) throw new Error("S3 客户端未初始化")
    error.value = null

    try {
      await s3Client.delete(s3Key)
      backupList.value = backupList.value.filter((f) => f.key !== s3Key)
    } catch (err: any) {
      error.value = err.message
      throw err
    }
  }

  /** 加载已保存的配置 */
  function loadConfig(config: S3Config): void {
    if (config && config.endpoint) {
      s3Config.value = { ...config }
      isConfigured.value = true
      initClient(config)
    }
  }

  return {
    // 状态
    s3Config,
    isConfigured,
    isConnected,
    isConnecting,
    isBackingUp,
    isLoading,
    backupProgress,
    backupList,
    error,
    // 计算属性
    phaseLabel,
    // 方法
    initClient,
    testConnection,
    saveConfig,
    performBackup,
    uploadFileContent,
    listBackups,
    downloadBackup,
    deleteBackup,
    loadConfig,
  }
}
