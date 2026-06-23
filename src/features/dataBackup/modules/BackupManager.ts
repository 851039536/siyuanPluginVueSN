import JSZip from "jszip"
/**
 * 数据备份管理器
 * 支持：全量备份、备份恢复、进度回调
 */
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

export interface BackupOptions {
  compressionLevel?: number
  excludeDirs?: string[]
  onProgress?: (progress: BackupProgress) => void
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

// ========== 工具函数 ==========

function formatTimestamp(now: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  const y = now.getFullYear().toString().slice(-2)
  return `data-${y}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`
}

// ========== BackupManager ==========

export class BackupManager {
  private workspacePath: string
  private workspaceRoot: string
  private fs: any
  private path: any

  constructor(workspacePath: string, workspaceRoot: string) {
    this.workspacePath = workspacePath
    this.workspaceRoot = workspaceRoot

    const node = getNodeModules()
    if (!node) {
      throw new TypeError("无法访问文件系统，请使用桌面版思源笔记")
    }
    this.fs = node.fs.promises
    this.path = node.path
  }

  get backupDir(): string {
    return `${this.workspaceRoot}/data-backup`
  }

  updateWorkspacePaths(workspacePath: string, workspaceRoot: string) {
    this.workspacePath = workspacePath
    this.workspaceRoot = workspaceRoot
  }

  // ========== 全量备份 ==========

  async performFullBackup(options: BackupOptions = {}): Promise<BackupResult> {
    const {
      compressionLevel = 6,
      excludeDirs = [],
      onProgress,
    } = options

    await this.validateWorkspace()

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

    const allFiles: { fullPath: string, relativePath: string, mtime: number, size: number }[] = []
    await this.scanDirectory(this.workspacePath, "", skipDirs, allFiles, onProgress)

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
      workspaceDataPath: this.workspacePath,
      backupDir: this.backupDir,
      totalFiles,
    }

    return this.finalizeAndSaveBackup(zip, backupInfo, totalFiles, compressionLevel, onProgress)
  }

  /** 压缩、保存备份（公共逻辑） */
  private async finalizeAndSaveBackup(
    zip: JSZip,
    backupInfo: BackupInfo,
    totalFiles: number,
    compressionLevel: number,
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

    await this.fs.mkdir(this.backupDir, { recursive: true })
    const fileName = formatTimestamp(new Date())
    const zipFilePath = this.path.join(this.backupDir, fileName)
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

  // ========== 删除备份 ==========

  async deleteBackupFile(backupFilePath: string): Promise<void> {
    await this.fs.unlink(backupFilePath)
  }

  // ========== 扫描文件系统中的备份列表 ==========

  async scanBackupDir(): Promise<
    Array<{ name: string, path: string, time: string, size: number }>
  > {
    const result: Array<{ name: string, path: string, time: string, size: number }> = []

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

  private async validateWorkspace() {
    try {
      await this.fs.access(this.workspacePath)
    } catch {
      throw new Error(`data 目录不存在: ${this.workspacePath}`)
    }
  }

  private async scanDirectory(
    dirPath: string,
    zipPath: string,
    skipDirs: Set<string>,
    result: { fullPath: string, relativePath: string, mtime: number, size: number }[],
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
        if (skipDirs.has(entry.name)) continue
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
