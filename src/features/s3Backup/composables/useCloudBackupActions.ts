/**
 * 云端备份列表操作 composable
 *
 * 提供云端备份文件的下载到本地备份目录与删除（确认 + 日志 + 消息提示）能力。
 * 依赖注入方式接入 index.vue，不接触其他 composable 的内部状态。
 *
 * 反馈通道约定：面板由 createModalVueApp 承载（遮罩 z-index 10000，见 @/utils/vueAppHelper），
 * 而思源全局 toast（#message）层级取自自增的 window.siyuan.zIndex（基准 10），
 * 面板打开期间 showMessage 会被遮罩完全盖住 —— 故关键结果必须同时写入面板内状态
 * （downloadingKey 按钮加载态 + lastDownloadResult 常驻结果），showMessage 仅作面板关闭后的补充。
 */
import type { Ref } from "vue"
import type {
  BackupLog,
  S3FileInfo,
} from "../types"
import type { TaskHandle } from "@/features/statusBar/composables/useStatusBarTask"
import { showMessage } from "siyuan"
import { ref } from "vue"
import { getNodeModules } from "@/utils/nodeModules"
import { MSG_DESKTOP_ONLY } from "../types"
import {
  localizeBackupError,
  resolveBackupDir,
  withRetry,
} from "../utils"

/** 面板内下载结果（面板打开时全局 toast 不可见，故需常驻展示） */
export interface DownloadResult {
  success: boolean
  text: string
}

/** 依赖注入：全部来自编排层已有的状态与方法 */
export interface CloudBackupActionsDeps {
  workspaceRoot: Ref<string>
  localBackupDir: Ref<string>
  downloadBackup: (s3Key: string, localPath: string) => Promise<void>
  deleteObject: (key: string, syncList?: boolean) => Promise<void>
  addLog: (entry: Omit<BackupLog, "id" | "time" | "hostname">) => void
  /** 状态栏任务句柄（下载期间在状态栏展示进度，面板隐藏时仍可见） */
  statusTask: TaskHandle
  i18n: Record<string, string>
}

export function useCloudBackupActions(deps: CloudBackupActionsDeps) {
  const {
    addLog,
    i18n,
    statusTask,
  } = deps

  /** 正在下载的云端对象 key（非空即全局互斥，驱动按钮 loading/禁用态） */
  const downloadingKey = ref<string | null>(null)
  /** 最近一次下载结果（常驻面板展示，成功/失败均写入） */
  const lastDownloadResult = ref<DownloadResult | null>(null)

  /** 下载云端对象到本地备份目录 */
  async function downloadToLocalDir(backup: S3FileInfo): Promise<void> {
    const node = getNodeModules()
    if (!node) { throw new Error(MSG_DESKTOP_ONLY) }
    const fs = node.fs.promises
    const pathModule = node.path

    const downloadDir = resolveBackupDir(deps.workspaceRoot.value, deps.localBackupDir.value)
    await fs.mkdir(downloadDir, { recursive: true })
    const localPath = pathModule.join(downloadDir, backup.name)

    // 单文件下载重试（与上传/删除共用同一重试语义与次数）
    const ok = await withRetry(
      () => deps.downloadBackup(backup.key, localPath),
      `下载失败: ${backup.name}`,
    )
    if (!ok) {
      throw new Error(`${i18n.downloadFailed}: ${backup.name}`)
    }
  }

  async function handleDownload(backup: S3FileInfo): Promise<void> {
    // 工作区未就绪时 resolveBackupDir 会拼出相对路径并写到进程 cwd，必须前置拦截
    if (!deps.workspaceRoot.value) {
      showMessage(i18n.noWorkspace, 3000, "info")
      lastDownloadResult.value = {
        success: false,
        text: i18n.noWorkspace,
      }
      return
    }
    // 全局互斥：同一时刻只允许一个下载任务
    if (downloadingKey.value !== null) { return }

    downloadingKey.value = backup.key
    lastDownloadResult.value = null
    statusTask.progress({
      label: i18n.downloading,
      percent: 0,
    })
    try {
      await downloadToLocalDir(backup)
      addLog({
        type: "s3Download",
        action: i18n.download,
        fileName: backup.name,
        success: true,
      })
      lastDownloadResult.value = {
        success: true,
        text: `${i18n.downloadSuccess}: ${backup.name}`,
      }
      statusTask.complete(i18n.downloadSuccess, backup.name)
      showMessage(i18n.downloadSuccess, 2000, "info")
    } catch (err: unknown) {
      const reason = localizeBackupError(err, i18n)
      addLog({
        type: "s3Download",
        action: i18n.download,
        fileName: backup.name,
        success: false,
        message: reason,
      })
      lastDownloadResult.value = {
        success: false,
        text: `${i18n.downloadFailed}: ${reason}`,
      }
      statusTask.fail(i18n.downloadFailed)
      showMessage(`${i18n.downloadFailed}: ${reason}`, 5000, "error")
    } finally {
      downloadingKey.value = null
    }
  }

  async function handleDelete(backup: S3FileInfo): Promise<void> {
    const confirmed = confirm(i18n.confirmDeleteBackup)
    if (!confirmed) { return }

    try {
      // syncList: 删除成功后同步从云端列表移除
      await deps.deleteObject(backup.key, true)
      addLog({
        type: "s3Delete",
        action: i18n.deleteBackup,
        fileName: backup.name,
        success: true,
      })
      showMessage(i18n.deleteSuccessBackup, 2000, "info")
    } catch (err: unknown) {
      const reason = localizeBackupError(err, i18n)
      addLog({
        type: "s3Delete",
        action: i18n.deleteBackup,
        fileName: backup.name,
        success: false,
        message: reason,
      })
      showMessage(`${i18n.deleteFailed}: ${reason}`, 5000, "error")
    }
  }

  return {
    handleDownload,
    handleDelete,
    downloadingKey,
    lastDownloadResult,
  }
}
