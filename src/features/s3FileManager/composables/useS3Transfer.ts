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
import { pickDirectory, pickFiles, getPathsFromFiles } from "@/utils/electronDialog"
import { getErrorMessage } from "@/utils/stringUtils"
import { useStatusBarTask } from "@/features/statusBar/composables/useStatusBarTask"
import type { FileOpLog, S3Entry, S3FileManagerI18n } from "../types"
import { TRANSFER_CONCURRENCY, TRANSFER_MAX_RETRIES } from "../types"
import { buildFailDetail, nameFromKey } from "../utils"

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

  /** 更新进度（整数百分比变化才触发响应式，避免高频更新；fraction 为全部进行中任务的字节分数之和） */
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

  /** 单个上传任务：本地绝对路径 → 目标 key（含展示名） */
  interface UploadTask {
    path: string
    key: string
    name: string
  }

  /** 核心并发上传：读 Buffer → 带字节进度上传 → 汇总日志与状态栏上报 */
  async function runUpload(tasks: UploadTask[], summaryName: string): Promise<void> {
    if (transferring.value || tasks.length === 0) { return }
    // 诊断日志：输出本批上传的完整目标 key，用于排查落点异常（后端非标准 prefix 行为取证）
    console.info("[S3文件管理] 上传目标 key:", tasks.map((t) => t.key))
    const client = deps.requireClient()
    const node = getNodeModules()
    if (!node) {
      showMessage(i18n.desktopOnly, 3000, "error")
      return
    }
    const { fs } = node

    transferring.value = true
    const failed: string[] = []
    let done = 0
    let uploadedBytes = 0
    /** 进行中任务的字节分数（key → 0~1）：求和后参与百分比，避免并发交替上报导致进度回退 */
    const fractions = new Map<string, number>()
    try {
      // 预先 stat 全部任务：大文件警告仅汇总弹一次，尺寸复用于上传字节统计
      const sizeMap = new Map<string, number>()
      for (const task of tasks) {
        try {
          sizeMap.set(task.key, (await fs.promises.stat(task.path)).size)
        } catch {
          // stat 失败交给 worker 的 readFile 自然失败并计入 failed
        }
      }
      const largeNames = tasks.filter((t) => (sizeMap.get(t.key) ?? 0) > LARGE_FILE_WARN_SIZE).map((t) => t.name)
      if (largeNames.length > 0) {
        // 大文件警告："存在超过 100MB 的大文件，上传时将整包驻留内存"（超过 3 个只显示数量）
        const summary = largeNames.length > 3 ? `${largeNames.length} ${i18n.itemsUnit}` : largeNames.join(", ")
        showMessage(`${i18n.largeFileWarn}: ${summary}`, 4000, "info")
      }

      /** 上报当前聚合进度（done + 全部进行中任务分数之和） */
      const reportUpload = (currentFile: string): void => {
        let fractionSum = 0
        for (const f of fractions.values()) { fractionSum += f }
        reportProgress(i18n.statusUploading, currentFile, done, tasks.length, fractionSum)
      }

      await runWithConcurrency(tasks, TRANSFER_CONCURRENCY, async (task) => {
        try {
          const buffer = await fs.promises.readFile(task.path)
          fractions.set(task.key, 0)
          reportUpload(task.name)
          await withRetries(() => client.uploadBuffer(buffer, task.key, (sent, total) => {
            fractions.set(task.key, sent / Math.max(total, 1))
            reportUpload(task.name)
          }))
          uploadedBytes += sizeMap.get(task.key) ?? buffer.length
        } catch (err) {
          console.warn("[S3文件管理] 上传失败:", task.path, getErrorMessage(err))
          failed.push(task.name)
        }
        fractions.delete(task.key)
        done++
        reportUpload(task.name)
      })

      const success = failed.length === 0
      deps.addLog({
        type: "upload", action: i18n.actionUpload,
        fileName: tasks.length === 1 ? tasks[0].name : summaryName,
        itemCount: tasks.length, fileSize: uploadedBytes,
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

  /** 递归收集目录下全部文件的绝对路径 */
  async function collectDirFiles(
    fs: typeof import("node:fs"),
    pathMod: typeof import("node:path"),
    dir: string,
  ): Promise<string[]> {
    const result: string[] = []
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    for (const ent of entries) {
      const full = pathMod.join(dir, ent.name)
      if (ent.isDirectory()) {
        result.push(...await collectDirFiles(fs, pathMod, full))
      } else if (ent.isFile()) {
        result.push(full)
      }
    }
    return result
  }

  /** 选择本地文件并上传到当前目录（重名确认覆盖；大文件仅警告不阻断） */
  async function uploadFiles(): Promise<void> {
    if (transferring.value) { return }
    deps.requireClient()
    // 入口固化目标前缀：选择对话框期间的目录切换不应改变本批上传落点
    const destPrefix = deps.currentPrefix.value
    const paths = await pickFiles(i18n.pickUploadFiles)
    if (!paths || paths.length === 0) { return }

    const node = getNodeModules()
    if (!node) {
      showMessage(i18n.desktopOnly, 3000, "error")
      return
    }
    const { path } = node

    // 重名覆盖确认
    const existingNames = new Set(deps.getEntries().filter((e) => !e.isFolder).map((e) => e.name))
    const conflicts = paths.map((p) => path.basename(p)).filter((name) => existingNames.has(name))
    if (conflicts.length > 0) {
      // 覆盖确认："以下文件已存在，继续上传将覆盖："
      if (!confirm(`${i18n.overwriteConfirm}\n${conflicts.join("\n")}`)) { return }
    }

    const tasks: UploadTask[] = paths.map((p) => {
      const name = path.basename(p)
      return { path: p, name, key: `${destPrefix}${name}` }
    })
    await runUpload(tasks, `${paths.length} ${i18n.itemsUnit}`)
  }

  /** 拖入的文件/文件夹上传到当前目录（文件夹递归保持相对结构；重名确认覆盖） */
  async function uploadDropped(files: File[]): Promise<void> {
    if (transferring.value || files.length === 0) { return }
    deps.requireClient()
    // 入口固化目标前缀：任务构建期间含多次 await（stat/递归收集），期间切换目录不应改变本批上传落点
    const destPrefix = deps.currentPrefix.value
    const node = getNodeModules()
    if (!node) {
      showMessage(i18n.desktopOnly, 3000, "error")
      return
    }
    const { fs, path } = node
    const paths = getPathsFromFiles(files)
    if (paths.length === 0) {
      // 取不到磁盘路径（非桌面版或 Electron 受限）
      showMessage(i18n.desktopOnly, 3000, "error")
      return
    }

    // 展开：文件直接上传；目录递归收集并保持相对结构（顶层目录名作为前缀段）
    const tasks: UploadTask[] = []
    const topLevelNames: string[] = []
    for (const p of paths) {
      let stat
      try {
        stat = await fs.promises.stat(p)
      } catch {
        continue
      }
      const baseName = path.basename(p)
      topLevelNames.push(baseName)
      if (stat.isDirectory()) {
        const collected = await collectDirFiles(fs, path, p)
        for (const filePath of collected) {
          const rel = filePath.slice(p.length + 1).split(path.sep).join("/")
          tasks.push({ path: filePath, name: path.basename(filePath), key: `${destPrefix}${baseName}/${rel}` })
        }
      } else {
        tasks.push({ path: p, name: baseName, key: `${destPrefix}${baseName}` })
      }
    }
    if (tasks.length === 0) { return }

    // 重名覆盖确认（基于顶层名比对现有条目）
    const existingNames = new Set(deps.getEntries().map((e) => e.name))
    const conflicts = topLevelNames.filter((name) => existingNames.has(name))
    if (conflicts.length > 0) {
      // 覆盖确认："以下文件已存在，继续上传将覆盖："
      if (!confirm(`${i18n.overwriteConfirm}\n${conflicts.join("\n")}`)) { return }
    }

    await runUpload(tasks, `${tasks.length} ${i18n.itemsUnit}`)
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
        const displayName = nameFromKey(task.key)
        try {
          reportProgress(i18n.statusDownloading, displayName, done, tasks.length, 0)
          await withRetries(() => client.download(task.key, task.dest))
        } catch (err) {
          console.warn("[S3文件管理] 下载失败:", task.key, getErrorMessage(err))
          failed.push(task.key)
        }
        done++
        reportProgress(i18n.statusDownloading, displayName, done, tasks.length, 0)
      })

      const success = failed.length === 0
      deps.addLog({
        type: "download", action: i18n.actionDownload,
        fileName: entries.length === 1 ? entries[0].name : `${entries.length} ${i18n.itemsUnit}`,
        itemCount: tasks.length,
        success,
        message: success ? destDir : `${failed.length} ${i18n.logFailed}`,
        detail: buildFailDetail(failed),
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
    uploadDropped,
    downloadEntries,
  }
}
