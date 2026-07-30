/**
 * 统一备份管理器
 *
 * 支持两种备份模式：
 * 1. 归档扫描（getWorkspaceFiles）— 复用 scanBackupDir 规则，供 S3 上传本地备份归档
 * 2. ZIP 流式打包（performFullBackup）— 供本地压缩备份使用
 * 增量扫描（scanDataFiles）与 ZIP 打包共用统一的 scanDirectory() 实现。
 */
import JSZip from "jszip"
import { getNodeModules, getNodeCrypto } from "@/utils/nodeModules"
import { makeBackupTimestamp, isArchiveFile, createLazyReadStream } from "../utils"
import { DEFAULT_BACKUP_DIR, MSG_DESKTOP_ONLY } from "../types"
import type { LocalBackupInfo, IncrementalFileEntry } from "../types"

// ========== 模块常量 ==========

/** 扫描时始终跳过的目录（思源临时目录/回收站） */
const SKIP_DIRS = ["temp", ".recycle"] as const

/** 插件生成的日期子文件夹命名规则（useDateFolder 开启时的 data-YYYYMMDD 目录） */
const DATE_DIR_RE = /^data-\d{8}$/

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
  compressionLevel?: number
  excludeDirs?: string[]
  /** 是否按日期创建子文件夹（默认 false）*/
  useDateFolder?: boolean
  onProgress?: (progress: BackupProgress) => void
}

export interface WorkspaceFile {
  fullPath: string
  relativePath: string
}

// ========== 工具函数 ==========

/** 生成备份文件名（含可选的 data-YYYYMMDD 日期子文件夹前缀） */
function buildBackupFileName(now: Date, useDateFolder = false): string {
  const ts = makeBackupTimestamp(now) // "YYYYMMDD-HHmmss"
  const datePart = ts.slice(0, 8)
  const prefix = useDateFolder ? `${datePart}/` : ""
  return `data-${prefix}${ts}.zip`
}

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
    const files = archives.map((a) => ({ fullPath: a.path, relativePath: a.name }))

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

    await this.scanDirectory(this.dataPath, "", new Set(SKIP_DIRS), files)

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
      compressionLevel = 6,
      excludeDirs = [],
      useDateFolder = false,
      onProgress,
    } = options

    // 统一时间基准：backup-info.json 与文件名/日期子文件夹同源，避免打包耗时导致跨秒/跨日撕裂
    const now = new Date()

    // 本地 ZIP 备份扫描 data/ 子目录，打包到 data-backup/；
    // S3 上传 getWorkspaceFiles() 收集 data-backup/ 中的归档文件上传到云端。
    const backupSourcePath = this.dataPath
    await this.validatePath(backupSourcePath)

    const skipDirs = new Set([...SKIP_DIRS, ...excludeDirs])
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
    await this.scanDirectory(backupSourcePath, "", skipDirs, allFiles)

    const totalFiles = allFiles.length
    // 空数据目录多为路径配置错误，拒绝产出空 ZIP 占用备份保留槽位
    if (totalFiles === 0) {
      throw new Error(`数据目录为空，已取消备份: ${backupSourcePath}`)
    }

    // 阶段2：登记文件（流式输入：仅探测可读性并挂载惰性读取流，内容在压缩阶段逐个消费）
    const skippedFiles: string[] = []
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
        // 预探测可读性：无法打开的文件跳过并记录（压缩阶段的残余流错误会使整次备份失败，
        // 对备份工具而言“响亮失败”优于静默丢数据）
        const handle = await this.fs.open(file.fullPath, "r")
        await handle.close()
        zip.file(file.relativePath, createLazyReadStream(this.fsRaw, file.fullPath))
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

    return this.finalizeAndSaveBackup(zip, backupInfo, compressionLevel, useDateFolder, now, onProgress)
  }

  /** 压缩并流式写盘保存备份（公共逻辑） */
  private async finalizeAndSaveBackup(
    zip: JSZip,
    backupInfo: BackupInfo,
    compressionLevel: number,
    useDateFolder: boolean,
    now: Date,
    onProgress?: (progress: BackupProgress) => void,
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
        output.on("error", reject)
        output.on("finish", () => resolve())
        zip.generateNodeStream(
          {
            type: "nodebuffer",
            streamFiles: true,
            compression: "DEFLATE",
            compressionOptions: { level: compressionLevel },
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
        )
          .on("error", reject)
          .pipe(output)
      })
    } catch (err) {
      // 生成失败时清理半成品 ZIP，避免残留损坏文件被当作有效备份
      try { await this.fs.unlink(zipFilePath) } catch { /* 忽略清理失败 */ }
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

  // ========== 本地备份文件管理 ==========

  async deleteBackupFile(backupFilePath: string): Promise<void> {
    // 防护：本方法只应删除扫描所得的备份归档，拒绝任意路径误删
    if (!isArchiveFile(backupFilePath)) {
      throw new Error(`拒绝删除非归档文件: ${backupFilePath}`)
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

  /**
   * 扫描本地备份目录，收集归档文件
   * - 顶层归档 + 插件日期子文件夹（data-YYYYMMDD）内一层归档（useDateFolder 场景）
   * - 子目录条目 name 为 "子目录/文件名" 相对形式
   * - 按修改时间倒序（新的在前），供列表展示与保留数清理使用
   */
  async scanBackupDir(): Promise<LocalBackupInfo[]> {
    const collected: { name: string; path: string; mtimeMs: number; size: number }[] = []

    /** 收集单个归档文件的元信息（无法读取的文件静默跳过） */
    const collect = async (name: string, filePath: string): Promise<void> => {
      try {
        const stats = await this.fs.stat(filePath)
        collected.push({ name, path: filePath, mtimeMs: stats.mtime.getTime(), size: stats.size })
      } catch {
        // 跳过无法读取的文件
      }
    }

    let entries
    try {
      entries = await this.fs.readdir(this.backupDir, { withFileTypes: true })
    } catch {
      return []
    }

    for (const entry of entries) {
      if (entry.isFile() && isArchiveFile(entry.name)) {
        await collect(entry.name, this.path.join(this.backupDir, entry.name))
      } else if (entry.isDirectory() && DATE_DIR_RE.test(entry.name)) {
        // 仅递归插件自建的日期子文件夹一层，避免把用户嵌套目录卷入列表与清理
        const subDir = this.path.join(this.backupDir, entry.name)
        let subFiles: string[] = []
        try {
          subFiles = await this.fs.readdir(subDir)
        } catch {
          continue
        }
        for (const f of subFiles) {
          if (isArchiveFile(f)) {
            await collect(`${entry.name}/${f}`, this.path.join(subDir, f))
          }
        }
      }
    }

    // 按 mtime 倒序（原文件名排序在混合命名下不保证时间顺序）
    collected.sort((a, b) => b.mtimeMs - a.mtimeMs)

    return collected.map((f) => ({
      name: f.name,
      path: f.path,
      time: new Date(f.mtimeMs).toLocaleString(),
      size: f.size,
      timestamp: f.mtimeMs,
    }))
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
      throw new Error(`目录不存在: ${p}`)
    }
  }

  /**
   * 统一递归扫描目录
   * - 跳过 skipDirs 中指定的目录
   * - 收集所有文件的完整路径和相对路径
   */
  private async scanDirectory(
    dirPath: string,
    zipPath: string,
    skipDirs: Set<string>,
    result: IncrementalFileEntry[],
  ) {
    let entries
    try {
      entries = await this.fs.readdir(dirPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = this.path.join(dirPath, entry.name)
      const relativePath = zipPath ? `${zipPath}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) { continue }
        await this.scanDirectory(fullPath, relativePath, skipDirs, result)
      } else if (entry.isFile()) {
        try {
          const stats = await this.fs.stat(fullPath)
          result.push({
            fullPath,
            relativePath,
            mtime: stats.mtime.getTime(),
            size: stats.size,
          })
        } catch {
          // 跳过无法读取的文件
        }
      }
    }
  }
}
