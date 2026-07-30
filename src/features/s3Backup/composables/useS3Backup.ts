/**
 * S3 备份功能的共享状态与操作逻辑
 *
 * 提供响应式的 S3 配置、备份状态、备份列表等状态，
 * 以及连接测试、备份、恢复、列举、删除等操作方法。
 * 仅被 index.vue 使用（S3ConfigForm 通过 props 接收 testConnection）。
 */
import { computed, ref } from "vue"
import type { S3Config, S3FileInfo } from "../types"
import { DEFAULT_S3_CONFIG, DEFAULT_S3_PREFIX, INCREMENTAL_SUBDIR } from "../types"
import { S3Client } from "../types/s3Client"
import type { BackupProgress } from "../modules/BackupManager"
import { getErrorMessage } from "@/utils/stringUtils"

export function useS3Backup(i18n: Record<string, string> = {}) {
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

  // 阶段标签：i18n 键与 BackupProgress.phase 同名（scanning/packing/compressing/saving/uploading），缺失时回退 phase 原值
  const phaseLabel = computed(() => {
    return i18n[backupProgress.value.phase] || backupProgress.value.phase
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
    } catch (err: unknown) {
      return { success: false, message: `连接测试异常: ${getErrorMessage(err)}` }
    }
  }

  /** 保存并应用 S3 配置（表单保存场景，配置已校验） */
  function applyConfig(config: S3Config): void {
    s3Config.value = { ...config }
    isConfigured.value = true
    initClient(config)
  }

  /** 加载已保存的配置（仅在 endpoint 有效时应用） */
  function loadConfig(config: S3Config): void {
    if (config && config.endpoint) {
      applyConfig(config)
    }
  }

  /** 下载 S3 备份文件 */
  async function downloadBackup(s3Key: string, localPath: string): Promise<void> {
    if (!s3Client) { throw new Error("S3 客户端未初始化") }
    await s3Client.download(s3Key, localPath)
  }

  /** 直接上传文件内容到 S3（跳过本地打包，用于逐文件上传模式；onProgress 上报字节级发送进度） */
  async function uploadFileContent(buffer: Buffer, key: string, onProgress?: (sent: number, total: number) => void): Promise<void> {
    if (!s3Client) { throw new Error("S3 客户端未初始化") }
    await s3Client.uploadBuffer(buffer, key, onProgress)
  }

  /** 读取 S3 对象文本内容（404 返回 null，供增量清单读取使用） */
  async function getObjectText(key: string): Promise<string | null> {
    if (!s3Client) { throw new Error("S3 客户端未初始化") }
    return s3Client.getObjectText(key)
  }

  /** 删除 S3 对象；syncList 为 true 时同步从 backupList 移除（云端列表删除场景） */
  async function deleteObject(key: string, syncList = false): Promise<void> {
    if (!s3Client) { throw new Error("S3 客户端未初始化") }
    await s3Client.delete(key)
    if (syncList) {
      backupList.value = backupList.value.filter((f) => f.key !== key)
    }
  }

  /** 获取 S3 列举前缀（统一默认值，消除 listBackups/listExistingKeys 重复构造） */
  function getListPrefix(): string {
    return s3Config.value.prefix || DEFAULT_S3_PREFIX
  }

  /** 从 S3 拉取文件列表（消除 listBackups/listExistingKeys 重复的 list 调用和 backupList 赋值） */
  async function fetchBackupList(): Promise<S3FileInfo[]> {
    if (!s3Client) { throw new Error("S3 客户端未初始化") }
    const all = await s3Client.list(getListPrefix())
    // 过滤增量备份的小文件与清单，避免污染云端备份列表与去重集合；
    // 同时过滤文件夹占位对象（0 字节，如 S3 Browser 的 ThisIsAnEmptyFolderInTheS3Bucket）与目录标记键（以 / 结尾）
    const files = all.filter((f) =>
      !f.key.includes(`/${INCREMENTAL_SUBDIR}/`)
      && !f.key.endsWith("/")
      && f.size > 0,
    )
    backupList.value = files
    return files
  }

  /** 列举 S3 备份文件（失败不抛异常，返回空数组；供 UI 刷新列表使用） */
  async function listBackups(): Promise<S3FileInfo[]> {
    isLoading.value = true
    try {
      return await fetchBackupList()
    } catch (_err: unknown) {
      backupList.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }

  /** 获取 S3 已有 Key 集合（失败抛异常，供去重判断使用） */
  async function listExistingKeys(): Promise<Set<string>> {
    const files = await fetchBackupList()
    return new Set(files.map((f) => f.key))
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
    applyConfig,
    uploadFileContent,
    getObjectText,
    deleteObject,
    listBackups,
    listExistingKeys,
    downloadBackup,
    loadConfig,
  }
}
