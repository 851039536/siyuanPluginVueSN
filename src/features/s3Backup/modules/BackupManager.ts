/**
 * 统一备份管理器
 *
 * 支持两种备份模式：
 * 1. 文件扫描（getWorkspaceFiles）— 供 S3 逐文件上传使用
 * 2. ZIP 打包（performFullBackup）— 供本地压缩备份使用
 * 两者共用统一的 scanDirectory() 实现。
 */
import JSZip from "jszip"
import { getNodeModules } from "@/utils/nodeModules"
import { makeBackupTimestamp } from "../utils"
import { DEFAULT_BACKUP_DIR, MSG_DESKTOP_ONLY } from "../types"
import type { LocalBackupInfo, IncrementalFileEntry } from "../types"

// ========== 模块常量 ==========

/** 扫描时始终跳过的目录（思源临时目录/回收站） */
const SKIP_DIRS = ["temp", ".recycle"] as const

/** 本地备份列表识别的归档扩展名白名单 */
const ARCHIVE_EXTS = [".zip", ".7z", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".rar"]

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
}

interface BackupInfo {
  timestamp: number
  backupTime: string
  version: string
  workspaceRoot: string
  workspaceDataPath: string
  backupDir: string
  totalFiles: number
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

/** 缓存的 crypto/fs 模块引用（模块级单例，避免每次哈希计算重复 require） */
let _crypto: any = null
let _fsRaw: any = null

/** 获取 crypto/fs 模块（仅 Electron/Node.js 环境可用） */
function requireCryptoFs(): { crypto: any; fsRaw: any } {
  if (!_crypto || !_fsRaw) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _crypto = require("node:crypto")
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _fsRaw = require("node:fs")
    } catch {
      throw new Error("哈希计算需要 Node.js 环境，请使用桌面版思源笔记")
    }
  }
  return { crypto: _crypto, fsRaw: _fsRaw }
}

/** B11 修复：生成备份文件名，支持日期子文件夹 */
function formatTimestamp(now: Date, useDateFolder = false): string {
  const ts = makeBackupTimestamp(now) // "YYYYMMDD-HHmmss"
  const datePart = ts.slice(0, 8)
  const prefix = useDateFolder ? `${datePart}/` : ""
  return `data-${prefix}${ts}.zip`
}

// ========== BackupManager ==========

export class BackupManager {
  private workspaceRoot: string
  private fs: any
  private path: any

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot

    const node = getNodeModules()
    if (!node) {
      throw new TypeError(MSG_DESKTOP_ONLY)
    }
    this.fs = node.fs.promises
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

  // ========== 文件扫描（S3 上传 / 增量共用） ==========

  /**
   * 扫描 data-backup/ 目录中的备份文件列表（供 S3 上传使用）
   * 上传的是本地备份已打包的 ZIP 文件，而非 data/ 原始文件
   */
  async getWorkspaceFiles(
    onProgress?: (progress: BackupProgress) => void,
  ): Promise<WorkspaceFile[]> {
    return this.scanFiles(this.backupDir, onProgress)
  }

  /**
   * 扫描 {workspaceRoot}/data 目录中的原始文件（供 S3 增量备份使用）
   * 返回含 mtime/size 的完整条目，供 manifest 对比
   */
  async scanDataFiles(
    onProgress?: (progress: BackupProgress) => void,
  ): Promise<IncrementalFileEntry[]> {
    return this.scanFiles(this.dataPath, onProgress)
  }

  /** 统一扫描入口：校验根目录 → 上报起止进度 → 递归收集（消除两个公开方法的同构样板） */
  private async scanFiles(
    rootPath: string,
    onProgress?: (progress: BackupProgress) => void,
  ): Promise<IncrementalFileEntry[]> {
    await this.validatePath(rootPath)

    const files: IncrementalFileEntry[] = []

    onProgress?.({
      phase: "scanning",
      currentFile: "",
      filesProcessed: 0,
      totalFiles: 0,
      percent: 0,
    })

    await this.scanDirectory(rootPath, "", new Set(SKIP_DIRS), files, onProgress)

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

    // 本地 ZIP 备份扫描 data/ 子目录，打包到 data-backup/；
    // S3 上传 getWorkspaceFiles() 扫描 data-backup/ 中的 ZIP 文件上传到云端。
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

    const allFiles: { fullPath: string; relativePath: string; mtime: number; size: number }[] = []
    await this.scanDirectory(backupSourcePath, "", skipDirs, allFiles, onProgress)

    const totalFiles = allFiles.length

    // 阶段2：打包文件
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
        const content = await this.fs.readFile(file.fullPath)
        zip.file(file.relativePath, content)
      } catch (err) {
        console.warn(`无法读取文件: ${file.fullPath}`, err)
      }
    }

    const backupInfo: BackupInfo = {
      timestamp: Date.now(),
      backupTime: new Date().toISOString(),
      version: "2.0",
      workspaceRoot: this.workspaceRoot,
      workspaceDataPath: backupSourcePath,
      backupDir: this.backupDir,
      totalFiles,
    }

    return this.finalizeAndSaveBackup(zip, backupInfo, totalFiles, compressionLevel, useDateFolder, onProgress)
  }

  /** 压缩、保存备份（公共逻辑） */
  private async finalizeAndSaveBackup(
    zip: JSZip,
    backupInfo: BackupInfo,
    totalFiles: number,
    compressionLevel: number,
    useDateFolder: boolean,
    onProgress?: (progress: BackupProgress) => void,
  ): Promise<BackupResult> {
    zip.file("backup-info.json", JSON.stringify(backupInfo, null, 2))

    // 阶段3：压缩
    onProgress?.({
      phase: "compressing",
      currentFile: "",
      filesProcessed: totalFiles,
      totalFiles,
      percent: 75,
    })

    const zipBuffer = await zip.generateAsync(
      {
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: { level: compressionLevel },
      },
      (metadata) => {
        onProgress?.({
          phase: "compressing",
          currentFile: "",
          filesProcessed: totalFiles,
          totalFiles,
          percent: 75 + Math.round(metadata.percent * 0.2),
        })
      },
    )

    // 阶段4：保存文件
    onProgress?.({
      phase: "saving",
      currentFile: "",
      filesProcessed: totalFiles,
      totalFiles,
      percent: 95,
    })

    // A2 修复：支持按日期创建子文件夹
    const fileName = formatTimestamp(new Date(), useDateFolder)
    const zipFilePath = this.path.join(this.backupDir, fileName)
    // recursive: true 自动创建中间目录（包括日期子文件夹）
    await this.fs.mkdir(this.path.dirname(zipFilePath), { recursive: true })
    await this.fs.writeFile(zipFilePath, zipBuffer)

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
    }
  }

  // ========== 本地备份文件管理 ==========

  async deleteBackupFile(backupFilePath: string): Promise<void> {
    await this.fs.unlink(backupFilePath)
  }

  /**
   * 扫描本地备份目录，收集归档文件
   * - 顶层归档 + 插件日期子文件夹（data-YYYYMMDD）内一层归档（useDateFolder 场景）
   * - 子目录条目 name 为 "子目录/文件名" 相对形式
   * - 按修改时间倒序（新的在前），供列表展示与保留数清理使用
   */
  async scanBackupDir(): Promise<LocalBackupInfo[]> {
    const collected: { name: string; path: string; mtimeMs: number; size: number }[] = []

    try {
      await this.fs.access(this.backupDir)
    } catch {
      return []
    }

    const isArchive = (f: string): boolean =>
      ARCHIVE_EXTS.some((ext) => f.toLowerCase().endsWith(ext))

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
      if (entry.isFile() && isArchive(entry.name)) {
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
          if (isArchive(f)) {
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
    }))
  }

  // ========== 文件校验 ==========

  /**
   * 计算文件的 SHA-256 校验值
   * 流式读取，不阻塞 UI，支持大文件
   */
  async computeFileHash(filePath: string): Promise<string> {
    const { crypto, fsRaw } = requireCryptoFs()
    const hash = crypto.createHash("sha256")
    return new Promise((resolve, reject) => {
      let stream: any
      try {
        stream = fsRaw.createReadStream(filePath)
      } catch (err) {
        reject(err)
        return
      }
      stream.on("data", (chunk: Buffer) => hash.update(chunk))
      stream.on("end", () => resolve(hash.digest("hex")))
      stream.on("error", reject)
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
    result: { fullPath: string; relativePath: string; mtime?: number; size?: number }[],
    onProgress?: (progress: BackupProgress) => void,
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
        await this.scanDirectory(fullPath, relativePath, skipDirs, result, onProgress)
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
