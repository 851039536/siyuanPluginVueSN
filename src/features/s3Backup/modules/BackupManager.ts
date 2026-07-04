/**
 * 工作区文件备份管理器
 *
 * 负责扫描工作区文件列表，供直接上传到 S3 使用。
 * 核心流程: 扫描文件 → 返回文件列表
 */
import { getNodeModules } from "@/utils/nodeModules"

// ========== 类型定义 ==========

export interface BackupProgress {
  phase: "scanning" | "uploading"
  currentFile: string
  filesProcessed: number
  totalFiles: number
  percent: number
}

export interface WorkspaceFile {
  fullPath: string
  relativePath: string
  size: number
}

// ========== BackupManager ==========

export class BackupManager {
  private workspacePath: string
  private fs: any
  private path: any

  constructor(workspacePath: string, _workspaceRoot: string) {
    this.workspacePath = workspacePath

    const node = getNodeModules()
    if (!node) {
      throw new TypeError("无法访问文件系统，请使用桌面版思源笔记")
    }
    this.fs = node.fs.promises
    this.path = node.path
  }

  /** 更新工作区路径 */
  updateWorkspacePaths(workspacePath: string, _workspaceRoot: string): void {
    this.workspacePath = workspacePath
  }

  /**
   * 扫描工作区文件列表（不打包）
   * 用于直接上传模式下遍历文件
   */
  async getWorkspaceFiles(
    onProgress?: (progress: BackupProgress) => void,
  ): Promise<WorkspaceFile[]> {
    await this.validateWorkspace()

    const skipDirs = new Set(["temp", ".recycle"])
    const files: WorkspaceFile[] = []

    onProgress?.({
      phase: "scanning",
      currentFile: "",
      filesProcessed: 0,
      totalFiles: 0,
      percent: 0,
    })

    const rawFiles: { fullPath: string; relativePath: string; size: number }[] = []
    await this.scanDirectory(this.workspacePath, "", skipDirs, rawFiles, onProgress)

    for (const f of rawFiles) {
      files.push({ fullPath: f.fullPath, relativePath: f.relativePath, size: f.size })
    }

    onProgress?.({
      phase: "scanning",
      currentFile: "",
      filesProcessed: files.length,
      totalFiles: files.length,
      percent: 100,
    })

    return files
  }

  // ========== 私有方法 ==========

  /** 验证工作区存在 */
  private async validateWorkspace(): Promise<void> {
    try {
      await this.fs.access(this.workspacePath)
    } catch {
      throw new Error(`目录不存在: ${this.workspacePath}`)
    }
  }

  /** 递归扫描目录 */
  private async scanDirectory(
    dirPath: string,
    zipPath: string,
    skipDirs: Set<string>,
    result: { fullPath: string; relativePath: string; size: number }[],
    onProgress?: (progress: BackupProgress) => void,
  ): Promise<void> {
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
        if (skipDirs.has(entry.name)) {
          continue
        }
        await this.scanDirectory(fullPath, relativePath, skipDirs, result, onProgress)
      } else if (entry.isFile()) {
        try {
          const stats = await this.fs.stat(fullPath)
          result.push({
            fullPath,
            relativePath,
            size: stats.size,
          })
        } catch {
          // 跳过无法读取的文件
        }
      }
    }
  }
}
