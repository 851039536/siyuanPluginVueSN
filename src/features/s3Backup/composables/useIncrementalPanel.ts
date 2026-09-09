/**
 * S3 增量面板 composable
 *
 * 承载增量备份/还原的手动触发入口与实验 Tab 专属状态：
 * 互斥运行标志、云端清单信息加载投影、还原目录记录与打开。
 * 核心流程复用 useIncrementalBackup，本层仅做 UI 编排与守卫，
 * 依赖由 useBackupOrchestrator 注入（isAnyTaskRunning 以 getter 形式惰性求值避免 TDZ）。
 */
import { ref } from "vue"
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import { openFolderInExplorer } from "@/utils/electronDialog"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import type { TaskHandle } from "@/features/statusBar/composables/useStatusBarTask"
import { useIncrementalBackup } from "./useIncrementalBackup"
import { buildManifestKey, makeBackupTimestamp, parseManifest } from "../utils"
import { DEFAULT_BACKUP_DIR, MSG_DESKTOP_ONLY } from "../types"
import type { BackupLog, S3Config } from "../types"
import type { BackupManager, BackupProgress } from "../modules/BackupManager"

/** 云端清单信息投影（实验 Tab 状态卡展示用三字段） */
export interface IncrementalManifestInfo {
  /** 清单内文件条目数 */
  fileCount: number
  /** 清单生成时间（ISO 字符串） */
  createdAt: string
  /** 生成设备主机名 */
  hostname: string
}

/** 依赖注入：全部来自 useBackupOrchestrator 已有的状态与方法 */
export interface IncrementalPanelDeps {
  i18n: Record<string, string>
  addLog: (entry: Omit<BackupLog, "id" | "time" | "hostname">) => void
  getBackupManager: () => BackupManager | null
  uploadFileSmart: (filePath: string, key: string) => Promise<void>
  uploadFileContent: (buffer: Buffer, key: string) => Promise<void>
  getObjectText: (key: string) => Promise<string | null>
  deleteObject: (key: string) => Promise<void>
  downloadObject: (key: string, localPath: string) => Promise<void>
  isConfigured: Ref<boolean>
  s3Config: Ref<S3Config>
  s3SubPrefix: Ref<string>
  workspaceRoot: Ref<string>
  localBackupDir: Ref<string>
  backupProgress: Ref<BackupProgress>
  statusTask: TaskHandle
  /** 惰性求值的互斥守卫：定义在编排层（依赖本层运行标志），避免构造期 TDZ */
  isAnyTaskRunning: () => boolean
  ensureWorkspaceReady: () => Promise<boolean>
}

export function useIncrementalPanel(deps: IncrementalPanelDeps) {
  const { i18n, addLog, backupProgress } = deps

  // ========== 运行状态（互斥标志由编排层 isAnyTaskRunning 聚合） ==========

  const isIncrementalRunning = ref(false)
  const isIncrementalRestoring = ref(false)
  /** 最近一次增量还原的目标目录（内存态，驱动「打开还原目录」按钮显隐） */
  const lastRestoreDir = ref("")

  // ========== 云端清单信息 ==========

  const manifestInfo = ref<IncrementalManifestInfo | null>(null)
  const isLoadingManifest = ref(false)
  /** 加载失败标记（与「暂无清单」区分展示） */
  const manifestLoadFailed = ref(false)

  // ========== 核心流程接线（useIncrementalBackup） ==========

  const { performIncrementalBackup, performIncrementalRestore } = useIncrementalBackup({
    getBackupManager: deps.getBackupManager,
    uploadFileSmart: deps.uploadFileSmart,
    uploadFileContent: deps.uploadFileContent,
    getObjectText: deps.getObjectText,
    deleteObject: deps.deleteObject,
    downloadObject: deps.downloadObject,
    backupProgress,
    addLog: (entry) => addLog(entry),
    i18n,
  })

  /** 执行增量备份（传入当前 S3 前缀与子路径），未配置 S3 时抛错由调用方提示 */
  async function runIncrementalBackup(): Promise<void> {
    if (!deps.isConfigured.value) {
      throw new Error(i18n.s3NotConfigured)
    }
    await performIncrementalBackup(deps.s3Config.value.prefix, deps.s3SubPrefix.value)
  }

  // ========== 手动触发入口（从备份 Tab 迁入实验 Tab） ==========

  /** 独立增量备份按钮（不依赖模式开关，单独触发一次增量上传） */
  async function triggerIncrementalOnly(): Promise<void> {
    if (deps.isAnyTaskRunning() || !deps.getBackupManager()) { return }
    // 进入即置位：目录对话框挂起期间也纳入互斥范围，防止自动备份 tick 穿透空窗并发执行
    isIncrementalRunning.value = true
    try {
      if (!(await deps.ensureWorkspaceReady())) { return }
      await runIncrementalBackup()
      // 状态栏："备份完成"
      deps.statusTask.complete(i18n.statusBackupDone)
    } catch (err: unknown) {
      // 状态栏："备份失败"
      deps.statusTask.fail(i18n.statusBackupFailed)
      showMessage(`${i18n.incrementalBackup}: ${getErrorMessage(err)}`, 5000, "error")
    } finally {
      isIncrementalRunning.value = false
    }
  }

  /** 增量还原：按云端 manifest 下载全部文件到本地备份目录下的时间戳还原文件夹 */
  async function triggerIncrementalRestore(): Promise<void> {
    if (deps.isAnyTaskRunning() || !deps.workspaceRoot.value) { return }
    if (!deps.isConfigured.value) {
      showMessage(i18n.s3NotConfigured, 3000, "error")
      return
    }
    const node = getNodeModules()
    if (!node) {
      // 非桌面环境显式提示，不再静默返回
      showMessage(MSG_DESKTOP_ONLY, 3000, "error")
      return
    }
    const confirmed = confirm(i18n.confirmIncrementalRestore)
    if (!confirmed) { return }
    isIncrementalRestoring.value = true
    try {
      const targetDir = node.path.join(
        deps.workspaceRoot.value,
        deps.localBackupDir.value || DEFAULT_BACKUP_DIR,
        `incremental-restore-${makeBackupTimestamp()}`,
      )
      await performIncrementalRestore(deps.s3Config.value.prefix, deps.s3SubPrefix.value, targetDir)
      // 记录还原目录：实验 Tab 据此显示「打开还原目录」按钮
      lastRestoreDir.value = targetDir
      // 状态栏："还原完成"
      deps.statusTask.complete(i18n.statusRestoreDone)
    } catch (err: unknown) {
      // 状态栏："还原失败"
      deps.statusTask.fail(i18n.statusRestoreFailed)
      showMessage(`${i18n.incrementalRestore}: ${getErrorMessage(err)}`, 5000, "error")
    } finally {
      isIncrementalRestoring.value = false
    }
  }

  // ========== 清单信息加载与还原目录打开 ==========

  /** 加载云端清单并投影为三字段信息（未配置 S3 时不加载；失败置空并标记，UI 展示对应状态文案） */
  async function refreshIncrementalManifest(): Promise<void> {
    if (!deps.isConfigured.value || isLoadingManifest.value) { return }
    isLoadingManifest.value = true
    manifestLoadFailed.value = false
    try {
      const manifestKey = buildManifestKey(deps.s3Config.value.prefix, deps.s3SubPrefix.value)
      const text = await deps.getObjectText(manifestKey)
      if (text === null) {
        // 云端尚无清单（从未执行过增量备份）
        manifestInfo.value = null
        return
      }
      const manifest = parseManifest(text)
      manifestInfo.value = {
        fileCount: Object.keys(manifest.files).length,
        createdAt: manifest.createdAt,
        hostname: manifest.hostname,
      }
    } catch (err: unknown) {
      // 网络/解析失败：置空并标记失败态，仅控制台留痕不打断用户
      console.warn("[S3增量] 清单信息加载失败:", getErrorMessage(err))
      manifestInfo.value = null
      manifestLoadFailed.value = true
    } finally {
      isLoadingManifest.value = false
    }
  }

  /** 打开最近一次增量还原的目标目录（打不开时兜底提示完整路径供手动访问） */
  async function openRestoreFolder(): Promise<void> {
    if (!lastRestoreDir.value) { return }
    const opened = await openFolderInExplorer(lastRestoreDir.value)
    if (!opened) {
      showMessage(`${i18n.openRestoreFolderFailed}: ${lastRestoreDir.value}`, 4000, "info")
    }
  }

  return {
    // 状态
    isIncrementalRunning,
    isIncrementalRestoring,
    lastRestoreDir,
    manifestInfo,
    isLoadingManifest,
    manifestLoadFailed,
    // 方法
    runIncrementalBackup,
    triggerIncrementalOnly,
    triggerIncrementalRestore,
    refreshIncrementalManifest,
    openRestoreFolder,
  }
}

/** 增量面板聚合类型（供编排层解构与类型推导） */
export type IncrementalPanel = ReturnType<typeof useIncrementalPanel>
