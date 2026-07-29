/**
 * S3 全量上传编排 composable
 *
 * 上传 data-backup/ 中的备份 ZIP（或本次刚生成的 ZIP）到 S3：
 * 列举云端已有对象做防重（全 key 精确匹配 + basename 尾部匹配兜底）→ 逐文件读取上传
 * → 记录校验值与上传来源设备名（仅实际上传成功的文件）。
 * 日期子文件夹的 key 只取日期部分（YYYYMMDD），与本地 ZIP 目录语义一致。
 * 依赖注入方式接入 index.vue，不接触其他 composable 的内部状态。
 */
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import type { BackupManager, BackupProgress, BackupResult, WorkspaceFile } from "../modules/BackupManager"
import type { BackupLog, S3Config } from "../types"
import { buildS3Key, getBaseName, makeBackupTimestamp } from "../utils"

/** 依赖注入：全部来自 index.vue 已有的状态与方法 */
export interface FullS3UploadDeps {
  getBackupManager: () => BackupManager | null
  isConfigured: Ref<boolean>
  s3Config: Ref<S3Config>
  s3SubPrefix: Ref<string>
  useDateFolder: Ref<boolean>
  listExistingKeys: () => Promise<Set<string>>
  uploadFileContent: (buffer: Buffer, key: string) => Promise<void>
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

  /**
   * 构建 S3 对象 key（复用 utils.buildS3Key，日期子文件夹由 useDateFolder 控制）
   * datePath 只取时间戳的日期部分（YYYYMMDD），与本地 ZIP 的日期目录语义对齐；
   * 完整时间戳会导致每次备份 key 必不同，全 key 去重永不命中（历史 bug）。
   */
  function makeS3Key(relativePath: string, timestamp: string): string {
    const datePath = deps.useDateFolder.value ? timestamp.slice(0, 8) : ""
    return buildS3Key(deps.s3Config.value.prefix, deps.s3SubPrefix.value, relativePath, datePath)
  }

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
      files = await backupManager.getWorkspaceFiles((p) => {
        backupProgress.value = { ...p }
      })
    }

    if (files.length === 0) {
      showMessage(i18n.noFilesToBackup, 3000, "info")
      return
    }

    const timestamp = makeBackupTimestamp()
    const node = getNodeModules()
    if (!node) {
      throw new Error("无法访问文件系统，请使用桌面版思源笔记")
    }
    const fs = node.fs.promises

    // 去重优化：上传前先获取 S3 已有文件列表，已存在的文件跳过上传
    let existingKeys: Set<string> = new Set()
    // basename 兜底集合：兼容历史时间戳目录下的旧对象（key 布局与当前规则不同）
    let existingBaseNames: Set<string> = new Set()
    // fetchBackupList 成功时已同步更新 backupList，无需备份结束后再次拉取
    let listFailed = false
    try {
      existingKeys = await deps.listExistingKeys()
      existingBaseNames = new Set([...existingKeys].map((k) => getBaseName(k)))
      console.log(`[S3备份] 去重检查：S3 已有 ${existingKeys.size} 个文件`)
      if (existingKeys.size > 0 && files.length > 0) {
        // 打印前 3 个已有 key 和前 3 个待上传 key 供诊断对比
        const sampleExisting = [...existingKeys].slice(0, 3)
        const sampleNew: string[] = []
        for (let i = 0; i < Math.min(3, files.length); i++) {
          sampleNew.push(makeS3Key(files[i].relativePath, timestamp))
        }
        console.log("[S3备份] S3 已有 key 示例:", sampleExisting)
        console.log("[S3备份] 待上传 key 示例:", sampleNew)
      }
    } catch (err: unknown) {
      listFailed = true
      console.warn("[S3备份] 无法获取 S3 文件列表，将上传全部文件:", err)
    }

    let skippedCount = 0
    let uploadedCount = 0
    let processedCount = 0 // 已处理文件数（含跳过 + 上传）
    const uploadedNames: string[] = [] // 实际上传成功的文件名（hostMap 只记录这些）

    // try/finally 兜底：即使中途上传抛错，也保住已成功文件的校验值落盘
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const s3Key = makeS3Key(file.relativePath, timestamp)

        // 去重：全 key 精确匹配，或 basename 已存在（历史目录布局兜底）即跳过
        if (existingKeys.has(s3Key) || existingBaseNames.has(getBaseName(file.relativePath))) {
          skippedCount++
          processedCount++
          console.log(`[S3备份] 跳过已存在: ${s3Key}`)
          backupProgress.value = {
            phase: "uploading",
            currentFile: `${file.relativePath} (已跳过)`,
            filesProcessed: processedCount,
            totalFiles: files.length,
            percent: Math.round((processedCount / files.length) * 100),
          }
          continue
        }

        backupProgress.value = {
          phase: "uploading",
          currentFile: file.relativePath,
          filesProcessed: processedCount + 1,
          totalFiles: files.length,
          percent: Math.round((processedCount / files.length) * 100),
        }

        let content
        try {
          content = await fs.readFile(file.fullPath)
        } catch (readErr: unknown) {
          console.warn(`跳过无法读取的文件: ${file.relativePath}`, getErrorMessage(readErr))
          processedCount++
          continue
        }
        await deps.uploadFileContent(content, s3Key)
        // 上传成功后计算并保存校验值（仅更新内存，循环结束后统一落盘）
        try {
          const hash = await backupManager.computeFileHash(file.fullPath)
          await deps.saveChecksum(file.relativePath, file.fullPath, content.length, hash, false)
        } catch (hashErr: unknown) {
          console.warn("计算校验值失败:", file.relativePath, getErrorMessage(hashErr))
        }
        uploadedNames.push(file.relativePath)
        uploadedCount++
        processedCount++
      }
    } finally {
      // 批量循环统一落盘校验值（O(N) 写入 → O(1)）；零上传时跳过无意义写入
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
    let msg = `${i18n.backupSuccess || "备份上传成功"}: 上传 ${uploadedCount} 个文件`
    if (skippedCount > 0) {
      msg += `，跳过 ${skippedCount} 个已存在文件`
    }
    showMessage(msg, 3000, "info")

    addLog({
      type: "s3Upload",
      action: i18n.s3Upload || "S3 上传",
      // 日志文件名："N 个文件"（多文件时）
      fileName: uploadedCount > 1 ? i18n.filesCount.replace("{count}", String(uploadedCount)) : (files[0]?.relativePath || ""),
      success: true,
      message: skippedCount > 0 ? `跳过 ${skippedCount}` : undefined,
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
