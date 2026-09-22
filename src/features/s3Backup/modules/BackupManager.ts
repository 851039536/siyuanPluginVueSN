/**
 * 统一备份管理器
 *
 * 支持两种备份模式：
 * 1. 归档扫描（getWorkspaceFiles）— 复用 scanBackupDir 规则，供 S3 上传本地备份归档
 * 2. ZIP 流式打包（performFullBackup）— 供本地压缩备份使用
 * 扫描实现（scanBackupDir/scanDirectory/SKIP_DIRS）拆分至 backupScanner.ts，此处仅委托调用。
 */
import type {
  IncrementalFileEntry,
  LocalBackupInfo,
} from "../types"
import JSZip from "jszip"
import {
  getNodeCrypto,
  getNodeModules,
  getNodeStream,
} from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import {
  BackupError,
  DEFAULT_BACKUP_DIR,
  MSG_DESKTOP_ONLY,
} from "../types"
import {
  createLazyReadStream,
  isArchiveFile,
  makeBackupTimestamp,
} from "../utils"
import {
  DATE_DIR_RE,
  scanBackupDir as scanBackupDirImpl,
  scanDirectory as scanDirectoryImpl,
  SKIP_DIRS,
} from "./backupScanner"

// ========== 类型定义 ==========

export interface BackupProgress {
  phase: "scanning" | "packing" | "compressing" | "saving" | "uploading" | "downloading"
  currentFile: string
  filesProcessed: number
  totalFiles: number
  percent: number
}

export interface BackupResult {
  success: boolean
  fileName: string
  filePath: string
  size: number
  totalFiles: number
  /** 打包时因无法读取而被跳过的文件数 */
  skippedCount: number
}

interface BackupInfo {
  timestamp: number
  backupTime: string
  version: string
  workspaceRoot: string
  workspaceDataPath: string
  backupDir: string
  totalFiles: number
  /** 打包时因无法读取而被跳过的文件相对路径列表 */
  skippedFiles: string[]
}

export interface BackupOptions {
  /** 是否按日期创建子文件夹（默认 false） */
  useDateFolder?: boolean
  onProgress?: (progress: BackupProgress) => void
}

/** 上传候选文件（增量扫描条目的路径投影，避免与 IncrementalFileEntry 字段双写） */
export type WorkspaceFile = Pick<IncrementalFileEntry, "fullPath" | "relativePath">

// ========== 工具函数 ==========

/** 生成备份文件名（含可选的 data-YYYYMMDD 日期子文件夹前缀） */
function buildBackupFileName(now: Date, useDateFolder = false): string {
  const ts = makeBackupTimestamp(now) // "YYYYMMDD-HHmmss"
  const datePart = ts.slice(0, 8)
  const prefix = useDateFolder ? `${datePart}/` : ""
  return `data-${prefix}${ts}.zip`
}

/** 将备份结果转换为本地列表展示条目（消除调用方对 BackupResult → LocalBackupInfo 的手工字段映射） */
export function toLocalBackupInfo(result: BackupResult, time?: string): LocalBackupInfo {
  return {
    name: result.fileName,
    path: result.filePath,
    time: time || new Date().toLocaleString(),
    size: result.size,
  }
}

/** 本地 ZIP 压缩级别（DEFLATE 默认档） */
const COMPRESSION_LEVEL = 6

// ========== BackupManager ==========

export class BackupManager {
  private workspaceRoot: string
  private fs: any
  /** 原始 fs 模块（createReadStream/createWriteStream 用） */
  private fsRaw: any
  private path: any

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot

    const node = getNodeModules()
    if (!node) {
      throw new TypeError(MSG_DESKTOP_ONLY)
    }
    this.fs = node.fs.promises
    this.fsRaw = node.fs
    this.path = node.path
  }

  private _customBackupDir = DEFAULT_BACKUP_DIR

  get backupDir(): string {
    return this.path.join(this.workspaceRoot, this._customBackupDir)
  }

  setBackupDir(dir: string): void {
    this._customBackupDir = dir || DEFAULT_BACKUP_DIR
  }

  /** 数据目录路径（本地 ZIP 备份/扫描的对象），即 {workspaceRoot}/data */
  get dataPath(): string {
    return this.path.join(this.workspaceRoot, "data")
  }

  /** 更新工作区根目录 */
  updateWorkspacePaths(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
  }

  // ========== 文件扫描（S3 上传 / 增量） ==========

  /**
   * 收集 data-backup/ 目录中的备份归档列表（供 S3 上传使用）
   * 复用 scanBackupDir 的归档识别规则（顶层归档 + data-YYYYMMDD 一层），
   * 只上传本地备份已打包的归档文件；目录不存在时返回空列表
   */
  async getWorkspaceFiles(
    onProgress?: (progress: BackupProgress) => void,
  ): Promise<WorkspaceFile[]> {
    onProgress?.({
      phase: "scanning",
      currentFile: "",
      filesProcessed: 0,
      totalFiles: 0,
      percent: 0,
    })

    const archives = await this.scanBackupDir()
    const files = archives.map((a) => ({
      fullPath: a.path,
      relativePath: a.name,
    }))

    onProgress?.({
      phase: "scanning",
      currentFile: "",
      filesProcessed: files.length,
      totalFiles: files.length,
      percent: 100,
    })

    return files
  }

  /**
   * 扫描 {workspaceRoot}/data 目录中的原始文件（供 S3 增量备份使用）
   * 返回含 mtime/size 的完整条目，供 manifest 对比
   */
  async scanDataFiles(
    onProgress?: (progress: BackupProgress) => void,
  ): Promise<IncrementalFileEntry[]> {
    await this.validatePath(this.dataPath)

    const files: IncrementalFileEntry[] = []

    onProgress?.({
      phase: "scanning",
      currentFile: "",
      filesProcessed: 0,
      totalFiles: 0,
      percent: 0,
    })

    await scanDirectoryImpl(this.scannerDeps(), this.dataPath, "", new Set(SKIP_DIRS), files)

    onProgress?.({
      phase: "scanning",
      currentFile: "",
      filesProcessed: files.length,
      totalFiles: files.length,
      percent: 100,
    })

    return files
  }

  // ========== 本地 ZIP 模式：全量打包备份 ==========

  async performFullBackup(options: BackupOptions = {}): Promise<BackupResult> {
    const {
      useDateFolder = false,
      onProgress,
    } = options

    // 统一时间基准：backup-info.json 与文件名/日期子文件夹同源，避免打包耗时导致跨秒/跨日撕裂
    const now = new Date()

    // 本地 ZIP 备份扫描 data/ 子目录，打包到 data-backup/；
    // S3 上传 getWorkspaceFiles() 收集 data-backup/ 中的归档文件上传到云端。
    const backupSourcePath = this.dataPath
    await this.validatePath(backupSourcePath)

    const skipDirs = new Set(SKIP_DIRS)
    const zip = new JSZip()

    // 阶段1：扫描文件
    onProgress?.({
      phase: "scanning",
      currentFile: "",
      filesProcessed: 0,
      totalFiles: 0,
      percent: 0,
    })

    const allFiles: IncrementalFileEntry[] = []
    await scanDirectoryImpl(this.scannerDeps(), backupSourcePath, "", skipDirs, allFiles)

    const totalFiles = allFiles.length
    // 空数据目录多为路径配置错误，拒绝产出空 ZIP 占用备份保留槽位
    if (totalFiles === 0) {
      throw new BackupError("dataEmpty", backupSourcePath)
    }

    // 阶段2：登记文件（流式输入：仅探测可访问性并挂载惰性读取流，内容在压缩阶段逐个消费）
    const skippedFiles: string[] = []
    // 登记本批次全部惰性读取流：压缩中断时统一销毁，避免底层 fd 泄漏
    const lazyStreams: { destroy: (err?: Error) => void }[] = []
    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i]
      onProgress?.({
        phase: "packing",
        currentFile: file.relativePath,
        filesProcessed: i + 1,
        totalFiles,
        percent: Math.round(((i + 1) / totalFiles) * 70),
      })
      try {
        // 预探测可访问性：无法访问的文件跳过并记录（压缩阶段的残余流错误会使整次备份失败，
        // 对备份工具而言“响亮失败”优于静默丢数据）
        await this.fs.access(file.fullPath)
        const lazy = createLazyReadStream(this.fsRaw, file.fullPath)
        lazyStreams.push(lazy)
        zip.file(file.relativePath, lazy)
      } catch (err) {
        skippedFiles.push(file.relativePath)
        console.warn(`无法读取文件: ${file.fullPath}`, err)
      }
    }

    const backupInfo: BackupInfo = {
      timestamp: now.getTime(),
      backupTime: now.toISOString(),
      version: "2.0",
      workspaceRoot: this.workspaceRoot,
      workspaceDataPath: backupSourcePath,
      backupDir: this.backupDir,
      totalFiles,
      skippedFiles,
    }

    return this.finalizeAndSaveBackup(zip, backupInfo, useDateFolder, now, onProgress, lazyStreams)
  }

  /** 压缩并流式写盘保存备份（公共逻辑）；lazyStreams 供压缩中断时统一销毁 */
  private async finalizeAndSaveBackup(
    zip: JSZip,
    backupInfo: BackupInfo,
    useDateFolder: boolean,
    now: Date,
    onProgress?: (progress: BackupProgress) => void,
    lazyStreams: { destroy: (err?: Error) => void }[] = [],
  ): Promise<BackupResult> {
    const { totalFiles } = backupInfo
    zip.file("backup-info.json", JSON.stringify(backupInfo, null, 2))

    // 阶段3：压缩（generateNodeStream 流式写盘，避免整包 Buffer 驻留内存）
    onProgress?.({
      phase: "compressing",
      currentFile: "",
      filesProcessed: totalFiles,
      totalFiles,
      percent: 75,
    })

    const fileName = buildBackupFileName(now, useDateFolder)
    const zipFilePath = this.path.join(this.backupDir, fileName)
    // recursive: true 自动创建中间目录（包括日期子文件夹）
    await this.fs.mkdir(this.path.dirname(zipFilePath), { recursive: true })

    try {
      await new Promise<void>((resolve, reject) => {
        const output = this.fsRaw.createWriteStream(zipFilePath)
        // pipeline：任一端出错即同时销毁上下游并回调统一错误，避免句柄泄漏
        // （旧实现 .pipe(output) 在源流出错时不销毁 output，Windows 下 unlink 必失败）
        const streamMod = getNodeStream()
        if (!streamMod) {
          reject(new TypeError(MSG_DESKTOP_ONLY))
          return
        }
        streamMod.stream.pipeline(
          zip.generateNodeStream(
            {
              type: "nodebuffer",
              streamFiles: true,
              compression: "DEFLATE",
              compressionOptions: { level: COMPRESSION_LEVEL },
            },
            (metadata) => {
              onProgress?.({
                phase: "compressing",
                currentFile: metadata.currentFile ?? "",
                filesProcessed: totalFiles,
                totalFiles,
                percent: 75 + Math.round(metadata.percent * 0.2),
              })
            },
          ),
          output,
          (err: NodeJS.ErrnoException | null) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          },
        )
      })
    } catch (err) {
      // 压缩中断：统一销毁全部惰性读取流（防止底层 fd 泄漏），再清理半成品 ZIP
      for (const lazy of lazyStreams) {
        try { lazy.destroy() } catch { /* 忽略单个流销毁失败 */ }
      }
      await this.cleanupFailedZip(zipFilePath)
      throw err
    }

    // 阶段4：保存完成
    onProgress?.({
      phase: "saving",
      currentFile: "",
      filesProcessed: totalFiles,
      totalFiles,
      percent: 95,
    })

    const stats = await this.fs.stat(zipFilePath)

    onProgress?.({
      phase: "saving",
      currentFile: "",
      filesProcessed: totalFiles,
      totalFiles,
      percent: 100,
    })

    return {
      success: true,
      fileName,
      filePath: zipFilePath,
      size: stats.size,
      totalFiles,
      skippedCount: backupInfo.skippedFiles.length,
    }
  }

  /**
   * 清理压缩失败的半成品 ZIP
   * unlink 失败（防病毒软件/索引服务短暂占用等）时降级为改名 .part，
   * 确保损坏包不会被 isArchiveFile 识别为有效归档而进入备份列表与上传队列
   */
  private async cleanupFailedZip(zipFilePath: string): Promise<void> {
    try {
      await this.fs.unlink(zipFilePath)
    } catch {
      try {
        await this.fs.rename(zipFilePath, `${zipFilePath}.part`)
      } catch (renameErr: unknown) {
        console.warn(`清理失败半成品备份失败: ${zipFilePath}`, getErrorMessage(renameErr))
      }
    }
  }

  // ========== 本地备份文件管理 ==========

  async deleteBackupFile(backupFilePath: string): Promise<void> {
    // 防护：本方法只应删除扫描所得的备份归档，拒绝任意路径误删
    if (!isArchiveFile(backupFilePath)) {
      throw new BackupError("refuseNonArchive", backupFilePath)
    }
    await this.fs.unlink(backupFilePath)

    // useDateFolder 场景：删除后若插件自建的日期子目录已空则一并清理
    const parentDir = this.path.dirname(backupFilePath)
    if (DATE_DIR_RE.test(this.path.basename(parentDir))) {
      try {
        const rest = await this.fs.readdir(parentDir)
        if (rest.length === 0) {
          await this.fs.rmdir(parentDir)
        }
      } catch {
        // 目录清理失败不影响删除结果
      }
    }
  }

  /** 扫描本地备份目录，收集归档文件（实现拆分至 backupScanner.ts，此处仅委托） */
  scanBackupDir(): Promise<LocalBackupInfo[]> {
    return scanBackupDirImpl(this.scannerDeps(), this.backupDir)
  }

  /** 扫描依赖快照（fs.promises 与 path 注入 backupScanner） */
  private scannerDeps() {
    return {
      fs: this.fs,
      path: this.path,
    }
  }

  // ========== 文件校验 ==========

  /**
   * 计算文件的 SHA-256 校验值
   * 流式读取，不阻塞 UI，支持大文件
   */
  async computeFileHash(filePath: string): Promise<string> {
    const cryptoMod = getNodeCrypto()
    if (!cryptoMod) {
      throw new TypeError(MSG_DESKTOP_ONLY)
    }
    const hash = cryptoMod.crypto.createHash("sha256")
    return new Promise((resolve, reject) => {
      const stream = this.fsRaw.createReadStream(filePath)
      stream.on("data", (chunk: Buffer) => hash.update(chunk))
      stream.once("end", () => resolve(hash.digest("hex")))
      stream.once("error", (err: Error) => {
        // 显式销毁，确保错误路径立即释放文件句柄
        stream.destroy()
        reject(err)
      })
    })
  }

  // ========== 私有方法 ==========

  private async validatePath(p: string) {
    try {
      await this.fs.access(p)
    } catch {
      throw new BackupError("dirNotFound", p)
    }
  }
}
