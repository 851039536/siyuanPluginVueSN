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
import type { BackupProgress } from "../modules/BackupManager"

export function useS3Backup() {
  // ========== 状态 ==========

  const s3Config = ref<S3Config>({ ...DEFAULT_S3_CONFIG })
  const isConfigured = ref(false)
  const isBackingUp = ref(false)
  const isLoading = ref(false)

  const backupProgress = ref<BackupProgress>({
    phase: "scanning",
    currentFile: "",
    filesProcessed: 0,
    totalFiles: 0,
    percent: 0,
  })

  const backupList = ref<S3FileInfo[]>([])

  let s3Client: S3Client | null = null

  // ========== 计算属性 ==========

  const phaseLabel = computed(() => {
    const labels: Record<string, string> = {
      scanning: "扫描文件",
      packing: "打包文件",
      compressing: "压缩数据",
      saving: "保存备份",
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

    try {
      const client = initClient(cfg)
      return await client.testConnection()
    } catch (err: any) {
      return { success: false, message: `连接测试异常: ${err.message}` }
    }
  }

  /** 保存 S3 配置 */
  function saveConfig(config: S3Config): void {
    s3Config.value = { ...config }
    isConfigured.value = true
    initClient(config)
  }

  /** 直接上传文件内容到 S3（跳过本地打包，用于逐文件上传模式） */
  async function uploadFileContent(buffer: Buffer, key: string): Promise<void> {
    if (!s3Client) { throw new Error("S3 客户端未初始化") }
    await s3Client.uploadBuffer(buffer, key)
  }

  /** 列举 S3 备份文件（失败不抛异常，返回空数组；供 UI 刷新列表使用） */
  async function listBackups(): Promise<S3FileInfo[]> {
    if (!s3Client) { throw new Error("S3 客户端未初始化") }

    isLoading.value = true

    try {
      const prefix = s3Config.value.prefix || "siyuan-backup/"
      const files = await s3Client.list(prefix)
      backupList.value = files
      return files
    } catch (_err: any) {
      backupList.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }

  /** 获取 S3 已有 Key 集合（失败抛异常，供去重判断使用） */
  async function listExistingKeys(): Promise<Set<string>> {
    if (!s3Client) { throw new Error("S3 客户端未初始化") }
    const prefix = s3Config.value.prefix || "siyuan-backup/"
    const files = await s3Client.list(prefix)
    backupList.value = files
    return new Set(files.map((f) => f.key))
  }

  /** 下载 S3 备份文件 */
  async function downloadBackup(s3Key: string, localPath: string): Promise<void> {
    if (!s3Client) { throw new Error("S3 客户端未初始化") }
    await s3Client.download(s3Key, localPath)
  }

  /** 删除 S3 备份文件 */
  async function deleteBackup(s3Key: string): Promise<void> {
    if (!s3Client) { throw new Error("S3 客户端未初始化") }
    await s3Client.delete(s3Key)
    backupList.value = backupList.value.filter((f) => f.key !== s3Key)
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
    isBackingUp,
    isLoading,
    backupProgress,
    backupList,
    // 计算属性
    phaseLabel,
    // 方法
    testConnection,
    saveConfig,
    uploadFileContent,
    listBackups,
    listExistingKeys,
    downloadBackup,
    deleteBackup,
    loadConfig,
  }
}
