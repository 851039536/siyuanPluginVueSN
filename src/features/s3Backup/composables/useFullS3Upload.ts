/**
 * S3 全量上传编排 composable
 *
 * 上传 data-backup/ 中的备份 ZIP（或本次刚生成的 ZIP）到 S3：
 * 列举云端已有对象做防重（全 key 精确匹配 + basename 尾部匹配兜底）→ 有界并发上传（单文件失败重试后继续）
 * → 上传与哈希并行执行 → 记录校验值与上传来源设备名（仅实际上传成功的文件）。
 * 日期子文件夹的 key 只取日期部分（YYYYMMDD），与本地 ZIP 目录语义一致。
 * 依赖注入方式接入 index.vue，不接触其他 composable 的内部状态。
 */
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import type { BackupManager, BackupProgress, BackupResult, WorkspaceFile } from "../modules/BackupManager"
import type { BackupLog } from "../types"
import { FULL_UPLOAD_CONCURRENCY, MSG_DESKTOP_ONLY } from "../types"
import { getBaseName, makeBackupTimestamp, runWithConcurrency, withRetry } from "../utils"

/** 依赖注入：全部来自 index.vue 已有的状态与方法 */
export interface FullS3UploadDeps {
  getBackupManager: () => BackupManager | null
  isConfigured: Ref<boolean>
  /** 上传 key 构建（由编排层单点提供，与手动上传共用同一规则） */
  buildUploadKey: (relativePath: string, dateStamp?: string) => string
  listExistingKeys: () => Promise<Set<string>>
  /** 大文件感知上传磁盘文件（>100MB 自动分片；onProgress 按文件总字节上报，供进度条流动） */
  uploadFileSmart: (filePath: string, key: string, onProgress?: (sent: number, total: number) => void) => Promise<void>
  backupProgress: Ref<BackupProgress>
  addLog: (entry: Omit<BackupLog, "id" | "time" | "hostname">) => void
  /** 保存校验值（persistNow=false 仅更新内存不落盘，供批量循环使用） */
  saveChecksum: (fileName: string, filePath: string, fileSize: number, checksum: string, persistNow?: boolean) => Promise<void>
  /** 将内存中的校验值列表统一落盘（批量场景循环结束后调用一次） */
  persistChecksums: () => Promise<void>
  /** 批量记录上传来源设备名（仅实际上传成功的文件） */
  recordUploadHosts: (fileNames: string[]) => Promise<void>
  refreshBackupList: () => Promise<void>
  i18n: Record<string, string>
}

export function useFullS3Upload(deps: FullS3UploadDeps) {
  const { backupProgress, addLog, i18n } = deps

  /** S3 备份
   * @param latestZip 若提供则只上传该 ZIP 文件（用于本地+S3 同时备份场景，避免重复上传历史备份）
   */
  async function performS3Backup(latestZip?: BackupResult | null): Promise<void> {
    const backupManager = deps.getBackupManager()
    if (!backupManager) { return }

    if (!deps.isConfigured.value) {
      throw new Error(i18n.s3NotConfigured)
    }

    let files: WorkspaceFile[]
    if (latestZip) {
      // A4 修复：仅上传刚生成的 ZIP 文件，避免每次重复上传 data-backup/ 中的全部历史备份
      files = [{ fullPath: latestZip.filePath, relativePath: latestZip.fileName }]
    } else {
      try {
        files = await backupManager.getWorkspaceFiles((p) => {
          backupProgress.value = { ...p }
        })
      } catch (err: unknown) {
        // 扫描失败：记录失败日志后再抛出，避免整次上传在日志中不留痕迹
        addLog({
          type: "s3Upload",
          action: i18n.s3Upload,
          fileName: "",
          success: false,
          message: getErrorMessage(err),
        })
        throw err
      }
    }

    if (files.length === 0) {
      showMessage(i18n.noFilesToBackup, 3000, "info")
      return
    }

    // 日期段取当日（作为 key 中备份文件自身日期缺失时的回退值）
    const dateStamp = makeBackupTimestamp().slice(0, 8)
    const node = getNodeModules()
    if (!node) {
      throw new Error(MSG_DESKTOP_ONLY)
    }
    const fs = node.fs.promises

    // 去重优化：上传前先获取 S3 已有文件列表，已存在的文件跳过上传
    let existingKeys = new Set<string>()
    // basename 兜底集合：兼容历史时间戳目录下的旧对象（key 布局与当前规则不同）
    let existingBaseNames = new Set<string>()
    // fetchBackupList 成功时已同步更新 backupList，无需备份结束后再次拉取
    let listFailed = false
    try {
      existingKeys = await deps.listExistingKeys()
      existingBaseNames = new Set([...existingKeys].map((k) => getBaseName(k)))
    } catch (err: unknown) {
      listFailed = true
      console.warn("[S3备份] 无法获取 S3 文件列表，将上传全部文件:", err)
    }

    let skippedCount = 0
    let uploadedCount = 0
    let failedCount = 0 // 读取失败 + 上传失败
    let processedCount = 0 // 已处理文件数（含跳过 + 上传 + 失败）
    const uploadedNames: string[] = [] // 实际上传成功的文件名（hostMap 只记录这些）

    // try/catch/finally 兜底：worker 意外抛错时记录失败日志，且保住已成功文件的校验值落盘
    try {
      await runWithConcurrency(files, FULL_UPLOAD_CONCURRENCY, async (file) => {
        const s3Key = deps.buildUploadKey(file.relativePath, dateStamp)

        // 去重：全 key 精确匹配，或 basename 已存在（历史目录布局兜底）即跳过
        if (existingKeys.has(s3Key) || existingBaseNames.has(getBaseName(file.relativePath))) {
          skippedCount++
          processedCount++
          backupProgress.value = {
            phase: "uploading",
            currentFile: `${file.relativePath} (已跳过)`,
            filesProcessed: processedCount,
            totalFiles: files.length,
            percent: Math.round((processedCount / files.length) * 100),
          }
          return
        }

        backupProgress.value = {
          phase: "uploading",
          currentFile: file.relativePath,
          filesProcessed: processedCount,
          totalFiles: files.length,
          percent: Math.round((processedCount / files.length) * 100),
        }

        // 先 stat 获取大小（校验值记录用）并兜底文件缺失；大文件分片与否由共享层 uploadFileSmart 内部判定
        let fileSize = 0
        try {
          const stats = await fs.stat(file.fullPath)
          fileSize = stats.size
        } catch (readErr: unknown) {
          console.warn(`跳过无法读取的文件: ${file.relativePath}`, getErrorMessage(readErr))
          failedCount++
          processedCount++
          return
        }

        // 本 worker 已上报的最大百分比（并发 worker 间共享 processedCount 会造成读值竞态，用本地值去重）
        let lastReportedPercent = -1
        // 上传（带重试，复用 utils.withRetry）与哈希并行执行；上传为磁盘路径流式/分片，不整体 readFile 驻留内存
        const [uploadResult, hashResult] = await Promise.allSettled([
          withRetry(
            // 字节级进度：单文件内发送比例折算到总进度（否则单大 ZIP 上传全程 0% 直跳 100%）
            () => deps.uploadFileSmart(file.fullPath, s3Key, (sent, total) => {
              const percent = Math.round(((processedCount + sent / total) / files.length) * 100)
              if (percent !== lastReportedPercent) { // 整数百分比变化才更新，避免高频响应式触发
                lastReportedPercent = percent
                backupProgress.value = { ...backupProgress.value, percent }
              }
            }),
            `上传失败: ${file.relativePath}`,
          ),
          backupManager.computeFileHash(file.fullPath),
        ])

        // withRetry 内部已吞异常并记录警告日志，此处只判返回值（rejected 分支为防御性保留）
        if (uploadResult.status === "rejected" || uploadResult.value === false) {
          failedCount++
          processedCount++
          return
        }

        // 上传成功：保存校验值（哈希失败仅告警，不阻断）
        if (hashResult.status === "fulfilled") {
          await deps.saveChecksum(file.relativePath, file.fullPath, fileSize, hashResult.value, false)
        } else {
          console.warn("计算校验值失败:", file.relativePath, getErrorMessage(hashResult.reason))
        }
        uploadedNames.push(file.relativePath)
        uploadedCount++
        processedCount++
      })
    } catch (err: unknown) {
      // 防御性兜底：worker 意外异常时记录失败日志再抛出，交由上层统一提示
      addLog({
        type: "s3Upload",
        action: i18n.s3Upload,
        fileName: "",
        success: false,
        message: getErrorMessage(err),
      })
      throw err
    } finally {
      // 批量统一落盘校验值（O(N) 写入 → O(1)）；零上传时跳过无意义写入
      // 落盘失败仅告警，避免掩盖循环内的原始上传错误
      if (uploadedCount > 0) {
        await deps.persistChecksums().catch((persistErr: unknown) => {
          console.warn("校验值落盘失败:", getErrorMessage(persistErr))
        })
      }
    }

    backupProgress.value = {
      phase: "uploading",
      currentFile: "",
      filesProcessed: processedCount,
      totalFiles: files.length,
      percent: 100,
    }

    // 构建结果消息
    let msg: string
    let msgType: "info" | "error" = "info"
    if (uploadedCount > 0) {
      msg = i18n.s3UploadResult.replace("{uploaded}", String(uploadedCount)).replace("{skipped}", String(skippedCount))
    } else {
      msg = i18n.allFilesExist.replace("{skipped}", String(skippedCount))
    }
    if (failedCount > 0) {
      msg += i18n.s3UploadFailedPart.replace("{failed}", String(failedCount))
      msgType = "error"
    }
    showMessage(msg, 3000, msgType)

    addLog({
      type: "s3Upload",
      action: i18n.s3Upload,
      // 日志文件名："N 个文件"（多文件时）
      fileName: uploadedCount > 1 ? i18n.filesCount.replace("{count}", String(uploadedCount)) : uploadedNames[0],
      success: failedCount === 0,
      message: msg,
    })

    // 仅记录实际上传成功的文件，避免覆盖其他设备的上传来源标记
    await deps.recordUploadHosts(uploadedNames)

    // 列表已在去重检查时刷新；仅当去重列举失败时兜底刷新一次
    if (listFailed) {
      await deps.refreshBackupList()
    }
  }

  return { performS3Backup }
}
