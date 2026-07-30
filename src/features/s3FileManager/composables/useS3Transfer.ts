/**
 * S3 文件管理器上传/下载 composable
 *
 * 上传：Electron 多选文件 → 读 Buffer → 带字节进度上传（重名确认覆盖、大文件警告）。
 * 下载：选择目标目录 → 流式写盘（文件夹递归保持相对结构）。
 * 进度经面板内进度条 + 状态栏任务双通道上报，整数百分比变化才更新响应式。
 */
import { ref } from "vue"
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import type { S3Client } from "@/utils/s3/s3Client"
import { runWithConcurrency } from "@/utils/s3/concurrency"
import { LARGE_FILE_WARN_SIZE } from "@/utils/s3/types"
import { getNodeModules } from "@/utils/nodeModules"
import { pickDirectory, pickFiles } from "@/utils/electronDialog"
import { getErrorMessage } from "@/utils/stringUtils"
import { useStatusBarTask } from "@/features/statusBar/composables/useStatusBarTask"
import type { FileOpLog, S3Entry, S3FileManagerI18n } from "../types"
import { TRANSFER_CONCURRENCY, TRANSFER_MAX_RETRIES, MAX_LOG_DETAIL_FILES } from "../types"

/** 传输进度状态 */
export interface TransferProgress {
  label: string
  currentFile: string
  done: number
  total: number
  percent: number
}

export function useS3Transfer(deps: {
  requireClient: () => S3Client
  i18n: S3FileManagerI18n
  currentPrefix: Ref<string>
  getEntries: () => S3Entry[]
  addLog: (entry: Omit<FileOpLog, "id" | "time" | "hostname">) => void
  /** 传输完成后回调：失效缓存 + 刷新当前目录（下载不改远端可不刷新，由实现决定） */
  afterMutation: () => Promise<void>
}) {
  const { i18n } = deps

  const transferring = ref(false)
  const transferProgress = ref<TransferProgress | null>(null)

  const statusTask = useStatusBarTask("s3-file-manager", "mdi:folder-network")

  /** 更新进度（整数百分比变化才触发响应式，避免高频更新） */
  function reportProgress(label: string, currentFile: string, done: number, total: number, fraction: number): void {
    const percent = Math.round(((done + fraction) / Math.max(total, 1)) * 100)
    const prev = transferProgress.value
    if (prev && prev.percent === percent && prev.currentFile === currentFile) { return }
    transferProgress.value = { label, currentFile, done, total, percent }
    statusTask.progress({ label, percent })
  }

  /** 带重试执行单个传输任务 */
  async function withRetries(task: () => Promise<void>): Promise<void> {
    for (let attempt = 0; attempt <= TRANSFER_MAX_RETRIES; attempt++) {
      try {
        await task()
        return
      } catch (err) {
        if (attempt === TRANSFER_MAX_RETRIES) { throw err }
      }
    }
  }

  // ========== 上传 ==========

  /** 选择本地文件并上传到当前目录（重名确认覆盖；大文件仅警告不阻断） */
  async function uploadFiles(): Promise<void> {
    if (transferring.value) { return }
    const client = deps.requireClient()
    const paths = await pickFiles(i18n.pickUploadFiles)
    if (!paths || paths.length === 0) { return }

    const node = getNodeModules()
    if (!node) {
      showMessage(i18n.desktopOnly, 3000, "error")
      return
    }
    const { fs, path } = node

    // 重名覆盖确认
    const existingNames = new Set(deps.getEntries().filter((e) => !e.isFolder).map((e) => e.name))
    const conflicts = paths.map((p) => path.basename(p)).filter((name) => existingNames.has(name))
    if (conflicts.length > 0) {
      // 覆盖确认："以下文件已存在，继续上传将覆盖："
      if (!confirm(`${i18n.overwriteConfirm}\n${conflicts.join("\n")}`)) { return }
    }

    transferring.value = true
    const failed: string[] = []
    let done = 0
    let uploadedBytes = 0
    try {
      await runWithConcurrency(paths, TRANSFER_CONCURRENCY, async (filePath) => {
        const name = path.basename(filePath)
        const key = `${deps.currentPrefix.value}${name}`
        try {
          const stat = await fs.promises.stat(filePath)
          if (stat.size > LARGE_FILE_WARN_SIZE) {
            // 大文件警告："存在超过 100MB 的大文件，上传时将整包驻留内存"
            showMessage(`${i18n.largeFileWarn}: ${name}`, 4000, "info")
          }
          const buffer = await fs.promises.readFile(filePath)
          reportProgress(i18n.statusUploading, name, done, paths.length, 0)
          await withRetries(() => client.uploadBuffer(buffer, key, (sent, total) => {
            reportProgress(i18n.statusUploading, name, done, paths.length, sent / Math.max(total, 1))
          }))
          uploadedBytes += stat.size
        } catch (err) {
          console.warn("[S3文件管理] 上传失败:", filePath, getErrorMessage(err))
          failed.push(name)
        }
        done++
        reportProgress(i18n.statusUploading, name, done, paths.length, 0)
      })

      const success = failed.length === 0
      deps.addLog({
        type: "upload", action: i18n.actionUpload,
        fileName: paths.length === 1 ? path.basename(paths[0]) : `${paths.length} ${i18n.itemsUnit}`,
        itemCount: paths.length, fileSize: uploadedBytes,
        success,
        message: success ? undefined : `${failed.length} ${i18n.logFailed}: ${failed.join(", ")}`,
      })
      if (success) {
        statusTask.complete(i18n.uploadSuccess)
        showMessage(i18n.uploadSuccess, 2000, "info")
      } else {
        statusTask.fail(i18n.uploadFailed)
        showMessage(`${i18n.uploadFailed}: ${failed.join(", ")}`, 5000, "error")
      }
    } finally {
      transferring.value = false
      transferProgress.value = null
      await deps.afterMutation()
    }
  }

  // ========== 下载 ==========

  /** 收集下载任务：文件 → 目录/名称；文件夹 → 递归列举并保持相对结构 */
  async function collectDownloadTasks(entries: S3Entry[], destDir: string, pathMod: { join: (...parts: string[]) => string }): Promise<{ key: string; dest: string }[]> {
    const client = deps.requireClient()
    const tasks: { key: string; dest: string }[] = []
    for (const entry of entries) {
      if (!entry.isFolder) {
        tasks.push({ key: entry.key, dest: pathMod.join(destDir, entry.name) })
        continue
      }
      const all = await client.list(entry.key)
      for (const f of all) {
        // 跳过文件夹占位对象（key 以 / 结尾）
        if (f.key.endsWith("/")) { continue }
        const relative = f.key.slice(entry.key.length)
        tasks.push({ key: f.key, dest: pathMod.join(destDir, entry.name, ...relative.split("/")) })
      }
    }
    return tasks
  }

  /** 下载选中条目到本地目录（流式写盘，文件夹递归） */
  async function downloadEntries(entries: S3Entry[]): Promise<void> {
    if (transferring.value || entries.length === 0) { return }
    const client = deps.requireClient()
    const node = getNodeModules()
    if (!node) {
      showMessage(i18n.desktopOnly, 3000, "error")
      return
    }
    const destDir = await pickDirectory(i18n.pickDownloadDir)
    if (!destDir) { return }

    transferring.value = true
    const failed: string[] = []
    let done = 0
    try {
      const tasks = await collectDownloadTasks(entries, destDir, node.path)
      await runWithConcurrency(tasks, TRANSFER_CONCURRENCY, async (task) => {
        try {
          reportProgress(i18n.statusDownloading, task.key, done, tasks.length, 0)
          await withRetries(() => client.download(task.key, task.dest))
        } catch (err) {
          console.warn("[S3文件管理] 下载失败:", task.key, getErrorMessage(err))
          failed.push(task.key)
        }
        done++
        reportProgress(i18n.statusDownloading, task.key, done, tasks.length, 0)
      })

      const success = failed.length === 0
      deps.addLog({
        type: "download", action: i18n.actionDownload,
        fileName: entries.length === 1 ? entries[0].name : `${entries.length} ${i18n.itemsUnit}`,
        itemCount: tasks.length,
        success,
        message: success ? destDir : `${failed.length} ${i18n.logFailed}`,
        detail: failed.length > 0 ? { failed: failed.slice(0, MAX_LOG_DETAIL_FILES), omitted: Math.max(0, failed.length - MAX_LOG_DETAIL_FILES) } : undefined,
      })
      if (success) {
        statusTask.complete(i18n.downloadSuccess)
        showMessage(`${i18n.downloadSuccess}: ${destDir}`, 3000, "info")
      } else {
        statusTask.fail(i18n.downloadFailed)
        showMessage(`${i18n.downloadFailed} (${failed.length})`, 5000, "error")
      }
    } catch (err) {
      statusTask.fail(i18n.downloadFailed)
      showMessage(`${i18n.downloadFailed}: ${getErrorMessage(err)}`, 5000, "error")
    } finally {
      transferring.value = false
      transferProgress.value = null
    }
  }

  return {
    transferring,
    transferProgress,
    uploadFiles,
    downloadEntries,
  }
}
