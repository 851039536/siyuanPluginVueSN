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

// ========== 类型定义 ==========

export interface BackupProgress {
  phase: "scanning" | "packing" | "compressing" | "saving" | "uploading"
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

export interface BackupInfo {
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

/** B11 修复：生成备份文件名，支持日期子文件夹 */
function formatTimestamp(now: Date, useDateFolder = false): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  const y = now.getFullYear()
  const datePart = `${y}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const prefix = useDateFolder ? `${datePart}/` : ""
  return `data-${prefix}${datePart}-${timePart}.zip`
}

// ========== BackupManager ==========

export class BackupManager {
  private workspaceRoot: string
  private fs: any
  private path: any

  constructor(_workspacePath: string, workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot

    const node = getNodeModules()
    if (!node) {
      throw new TypeError("无法访问文件系统，请使用桌面版思源笔记")
    }
    this.fs = node.fs.promises
    this.path = node.path
  }

  private _customBackupDir = "data-backup"

  get backupDir(): string {
    return this.path.join(this.workspaceRoot, this._customBackupDir)
  }

  setBackupDir(dir: string): void {
    this._customBackupDir = dir || "data-backup"
  }

  /** 数据目录路径（本地 ZIP 备份/扫描的对象），即 {workspaceRoot}/data */
  get dataPath(): string {
    return this.path.join(this.workspaceRoot, "data")
  }

  /** 更新工作区根目录（同时同步 workspacePath 字段以维持接口兼容） */
  updateWorkspacePaths(_workspacePath: string, workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
  }

  // ========== S3 模式：扫描文件列表（不打包） ==========

  /**
   * 扫描 data-backup/ 目录中的 ZIP 文件列表（供 S3 上传使用）
   * 上传的是本地备份已打包的 ZIP 文件，而非 data/ 原始文件
   */
  async getWorkspaceFiles(
    onProgress?: (progress: BackupProgress) => void,
  ): Promise<WorkspaceFile[]> {
    await this.validatePath(this.backupDir)

    const skipDirs = new Set(["temp", ".recycle"])
    const files: WorkspaceFile[] = []

    onProgress?.({
      phase: "scanning",
      currentFile: "",
      filesProcessed: 0,
      totalFiles: 0,
      percent: 0,
    })

    await this.scanDirectory(this.backupDir, "", skipDirs, files, onProgress)

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

    const skipDirs = new Set(["temp", ".recycle", ...excludeDirs])
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

  async scanBackupDir(): Promise<
    Array<{ name: string; path: string; time: string; size: number }>
  > {
    const result: Array<{ name: string; path: string; time: string; size: number }> = []

    try {
      await this.fs.access(this.backupDir)
    } catch {
      return result
    }

    const files = await this.fs.readdir(this.backupDir)
    const zipFiles = files
      .filter((f: string) => (f.startsWith("data-") || f.startsWith("sn-plugin-")) && f.endsWith(".zip"))
      .sort()
      .reverse()

    for (const name of zipFiles) {
      const filePath = this.path.join(this.backupDir, name)
      try {
        const stats = await this.fs.stat(filePath)
        result.push({
          name,
          path: filePath,
          time: stats.mtime.toLocaleString(),
          size: stats.size,
        })
      } catch {
        // 跳过无法读取的文件
      }
    }

    return result
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
