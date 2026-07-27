/**
 * S3 增量备份编排逻辑
 *
 * 备份流程：下载云端 manifest → 扫描 data/ → diff 对比 → 并发上传变更文件
 * → 清理已删除文件 → 上传新 manifest。
 * 还原流程：下载云端 manifest → 按清单并发下载全部文件到本地还原文件夹（不触碰 data/）。
 * manifest 以 S3 为唯一事实源；失败文件不写入新 manifest，下次自动重传（幂等）。
 * 依赖注入方式接入 index.vue，不接触其他 composable 的内部状态。
 */
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import type { BackupManager, BackupProgress } from "../modules/BackupManager"
import type { BackupLog, BackupManifest, IncrementalFileEntry } from "../types"
import { LARGE_FILE_WARN_SIZE } from "../types"
import { buildIncrementalKey, buildManifestKey, diffManifest, getHostname } from "../utils"

/** 上传并发数（S3 客户端无内建并发管理，固定小并发防止请求风暴） */
const UPLOAD_CONCURRENCY = 4

/** 单文件上传最大重试次数（不含首次尝试） */
const UPLOAD_MAX_RETRIES = 2

/** 依赖注入：全部来自 index.vue 已有的状态与方法 */
export interface IncrementalBackupDeps {
  getBackupManager: () => BackupManager | null
  uploadFileContent: (buffer: Buffer, key: string) => Promise<void>
  getObjectText: (key: string) => Promise<string | null>
  deleteObject: (key: string) => Promise<void>
  downloadObject: (key: string, localPath: string) => Promise<void>
  backupProgress: Ref<BackupProgress>
  addLog: (entry: Omit<BackupLog, "id" | "time" | "hostname">) => void
  i18n: Record<string, string>
}

/** 增量备份结果统计 */
export interface IncrementalResult {
  uploaded: number
  skipped: number
  deleted: number
  failed: number
}

/** 增量还原结果统计 */
export interface IncrementalRestoreResult {
  downloaded: number
  failed: number
  targetDir: string
}

/** 简易并发池：以固定并发数执行任务列表 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      await worker(item)
    }
  })
  await Promise.all(lanes)
}

export function useIncrementalBackup(deps: IncrementalBackupDeps) {
  const { backupProgress, addLog, i18n } = deps

  /** 下载并解析云端 manifest（404 → null 首次备份；解析失败按首次处理并记警告日志） */
  async function loadRemoteManifest(manifestKey: string): Promise<BackupManifest | null> {
    const text = await deps.getObjectText(manifestKey)
    if (text === null) { return null }
    try {
      const parsed = JSON.parse(text) as BackupManifest
      if (!parsed || typeof parsed.files !== "object" || parsed.files === null) {
        throw new TypeError("manifest 缺少 files 字段")
      }
      return parsed
    } catch (err: unknown) {
      console.warn("[S3增量] 清单解析失败，按首次备份处理:", getErrorMessage(err))
      addLog({
        type: "s3Incremental",
        action: i18n.s3Incremental,
        fileName: "manifest.json",
        success: false,
        message: i18n.incrementalManifestCorrupt,
      })
      return null
    }
  }

  /** 带重试的单文件上传，成功返回 true */
  async function uploadWithRetry(file: IncrementalFileEntry, key: string): Promise<boolean> {
    const node = getNodeModules()
    if (!node) { return false }
    for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
      try {
        const content = await node.fs.promises.readFile(file.fullPath)
        await deps.uploadFileContent(content, key)
        return true
      } catch (err: unknown) {
        if (attempt === UPLOAD_MAX_RETRIES) {
          console.warn(`[S3增量] 上传失败（已重试 ${UPLOAD_MAX_RETRIES} 次）: ${file.relativePath}`, getErrorMessage(err))
          return false
        }
      }
    }
    return false
  }

  /**
   * 执行增量备份
   * @param prefix S3 目录前缀（s3Config.prefix）
   * @param subPrefix S3 上传子路径（s3SubPrefix）
   * @throws 致命错误（扫描失败 / manifest 下载网络错误）由调用方统一提示
   */
  async function performIncrementalBackup(prefix: string, subPrefix: string): Promise<IncrementalResult> {
    const backupManager = deps.getBackupManager()
    if (!backupManager) {
      throw new Error("backupManager 未初始化")
    }

    const manifestKey = buildManifestKey(prefix, subPrefix)

    // 1. 下载旧 manifest（404 视为首次备份）
    const oldManifest = await loadRemoteManifest(manifestKey)
    if (!oldManifest) {
      showMessage(i18n.incrementalFirstRun, 3000, "info")
    }

    // 2. 扫描 data/ 原始文件
    const scanned = await backupManager.scanDataFiles((p) => {
      backupProgress.value = { ...p }
    })

    // 3. 空扫描守卫：防止把全部远端文件误判为已删除
    if (scanned.length === 0) {
      addLog({
        type: "s3Incremental",
        action: i18n.s3Incremental,
        fileName: "",
        success: false,
        message: i18n.incrementalEmptyScan,
      })
      throw new Error(i18n.incrementalEmptyScan)
    }

    // 4. diff 对比
    const diff = diffManifest(scanned, oldManifest)

    // 5. 并发上传新增/变更文件
    const totalTasks = diff.toUpload.length + diff.toDelete.length
    let processed = 0
    let uploaded = 0
    let failed = 0
    // 新 manifest 从旧清单的未变更条目起步，仅写入本次成功上传的条目（幂等保证）
    const newFiles: BackupManifest["files"] = {}
    if (oldManifest) {
      for (const file of scanned) {
        const old = oldManifest.files[file.relativePath]
        if (old && old.mtime === file.mtime && old.size === file.size) {
          newFiles[file.relativePath] = old
        }
      }
    }

    await runWithConcurrency(diff.toUpload, UPLOAD_CONCURRENCY, async (file) => {
      if (file.size > LARGE_FILE_WARN_SIZE) {
        console.warn(`[S3增量] 大文件整体读入内存上传: ${file.relativePath}（${file.size} 字节）`)
      }
      backupProgress.value = {
        phase: "uploading",
        currentFile: file.relativePath,
        filesProcessed: processed + 1,
        totalFiles: totalTasks,
        percent: totalTasks > 0 ? Math.round((processed / totalTasks) * 100) : 100,
      }
      const ok = await uploadWithRetry(file, buildIncrementalKey(prefix, subPrefix, file.relativePath))
      if (ok) {
        newFiles[file.relativePath] = { mtime: file.mtime, size: file.size }
        uploaded++
      } else {
        failed++
      }
      processed++
    })

    // 6. 清理本地已删除的远端文件（失败仅警告不中断，条目保留在旧清单外自然消失）
    let deleted = 0
    for (const relativePath of diff.toDelete) {
      backupProgress.value = {
        phase: "uploading",
        currentFile: relativePath,
        filesProcessed: processed + 1,
        totalFiles: totalTasks,
        percent: totalTasks > 0 ? Math.round((processed / totalTasks) * 100) : 100,
      }
      try {
        await deps.deleteObject(buildIncrementalKey(prefix, subPrefix, relativePath))
        deleted++
      } catch (err: unknown) {
        // 删除失败：条目不在新 manifest 中，仅残留孤儿对象，不影响后续备份正确性
        console.warn(`[S3增量] 删除远端文件失败: ${relativePath}`, getErrorMessage(err))
      }
      processed++
    }

    // 7. 上传新 manifest（部分失败也上传，失败文件缺席 → 下次自动重传）
    const newManifest: BackupManifest = {
      version: oldManifest?.version ?? 1,
      createdAt: new Date().toISOString(),
      hostname: getHostname(),
      files: newFiles,
    }
    await deps.uploadFileContent(
      Buffer.from(JSON.stringify(newManifest), "utf-8"),
      manifestKey,
    )

    backupProgress.value = {
      phase: "uploading",
      currentFile: "",
      filesProcessed: totalTasks,
      totalFiles: totalTasks,
      percent: 100,
    }

    // 8. 结果上报：日志 + 消息
    const result: IncrementalResult = { uploaded, skipped: diff.unchangedCount, deleted, failed }
    let message = (i18n.incrementalResult || "")
      .replace("{uploaded}", String(uploaded))
      .replace("{skipped}", String(diff.unchangedCount))
      .replace("{deleted}", String(deleted))
    if (failed > 0) {
      message += (i18n.incrementalResultFailed || "").replace("{failed}", String(failed))
    }
    addLog({
      type: "s3Incremental",
      action: i18n.s3Incremental,
      fileName: uploaded > 0 ? `${uploaded} 个文件` : "",
      success: failed === 0,
      message,
    })
    showMessage(message, failed > 0 ? 5000 : 3000, failed > 0 ? "error" : "info")

    return result
  }

  /**
   * 执行增量还原：按云端 manifest 并发下载全部文件到本地还原文件夹
   * @param prefix S3 目录前缀（s3Config.prefix）
   * @param subPrefix S3 上传子路径（s3SubPrefix）
   * @param targetDir 还原目标目录（绝对路径，下载保持 relativePath 目录结构）
   * @throws 云端无 manifest / 解析失败 / Node 环境不可用时抛错，由调用方统一提示
   */
  async function performIncrementalRestore(
    prefix: string,
    subPrefix: string,
    targetDir: string,
  ): Promise<IncrementalRestoreResult> {
    const node = getNodeModules()
    if (!node) {
      throw new Error("无法访问文件系统，请使用桌面版思源笔记")
    }

    // 1. 下载 manifest（还原场景下无清单/解析失败均为致命错误）
    const manifestKey = buildManifestKey(prefix, subPrefix)
    const text = await deps.getObjectText(manifestKey)
    if (text === null) {
      throw new Error(i18n.incrementalNoManifest)
    }
    let manifest: BackupManifest
    try {
      manifest = JSON.parse(text) as BackupManifest
      if (!manifest || typeof manifest.files !== "object" || manifest.files === null) {
        throw new TypeError("manifest 缺少 files 字段")
      }
    } catch (err: unknown) {
      throw new Error(`${i18n.incrementalManifestCorrupt}: ${getErrorMessage(err)}`)
    }

    // 2. 并发下载（复用备份的并发池与重试次数；download 内部自动创建中间目录）
    const relativePaths = Object.keys(manifest.files)
    const totalFiles = relativePaths.length
    let processed = 0
    let downloaded = 0
    let failed = 0

    await runWithConcurrency(relativePaths, UPLOAD_CONCURRENCY, async (relativePath) => {
      backupProgress.value = {
        phase: "downloading",
        currentFile: relativePath,
        filesProcessed: processed + 1,
        totalFiles,
        percent: totalFiles > 0 ? Math.round((processed / totalFiles) * 100) : 100,
      }
      const key = buildIncrementalKey(prefix, subPrefix, relativePath)
      const localPath = node.path.join(targetDir, ...relativePath.split("/"))
      let ok = false
      for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
        try {
          await deps.downloadObject(key, localPath)
          ok = true
          break
        } catch (err: unknown) {
          if (attempt === UPLOAD_MAX_RETRIES) {
            console.warn(`[S3增量] 下载失败（已重试 ${UPLOAD_MAX_RETRIES} 次）: ${relativePath}`, getErrorMessage(err))
          }
        }
      }
      if (ok) { downloaded++ } else { failed++ }
      processed++
    })

    backupProgress.value = {
      phase: "downloading",
      currentFile: "",
      filesProcessed: totalFiles,
      totalFiles,
      percent: 100,
    }

    // 3. 结果上报：日志 + 消息（type 复用既有 s3Download）
    let message = (i18n.incrementalRestoreResult || "")
      .replace("{downloaded}", String(downloaded))
      .replace("{path}", targetDir)
    if (failed > 0) {
      message += (i18n.incrementalRestoreFailed || "").replace("{failed}", String(failed))
    }
    addLog({
      type: "s3Download",
      action: i18n.incrementalRestore,
      fileName: downloaded > 0 ? `${downloaded} 个文件` : "",
      success: failed === 0,
      message,
    })
    showMessage(message, failed > 0 ? 5000 : 4000, failed > 0 ? "error" : "info")

    return { downloaded, failed, targetDir }
  }

  return { performIncrementalBackup, performIncrementalRestore }
}
