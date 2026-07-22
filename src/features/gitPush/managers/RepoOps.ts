// 仓库元操作：Tag 管理、冲突检测、远程配置、Git 配置查看、仓库扫描
import type {
  ConflictFile,
  ScannedGitRepo,
  TagInfo,
} from "../types/storage"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import type { GitExecutor } from "./GitExecutor"

export class RepoOps {
  private executor: GitExecutor

  constructor(executor: GitExecutor) {
    this.executor = executor
  }

  // ── Tag 管理 ──

  async getTags(projectPath: string, limit = 10): Promise<TagInfo[]> {
    try {
      const raw = await this.executor.execGit(projectPath, ["tag", "-l", `--sort=-creatordate`, `--format=%(refname:short)|%(subject)|%(creatordate:iso)`])
      return raw.trim().split("\n").filter(Boolean).slice(0, limit).map((line) => {
        const [name, message, date] = line.split("|")
        return { name, message: message || undefined, date: date || undefined }
      })
    } catch { return [] }
  }

  async createTag(projectPath: string, name: string, message?: string): Promise<void> {
    const args = ["tag", name]
    if (message) args.push("-m", message)
    await this.executor.execGit(projectPath, args)
  }

  async deleteTag(projectPath: string, name: string): Promise<void> {
    await this.executor.execGit(projectPath, ["tag", "-d", name])
  }

  async pushTag(projectPath: string, remoteName: string, tag: string): Promise<string> {
    return await this.executor.execGit(projectPath, ["push", remoteName, tag])
  }

  // ── 冲突检测 ──

  async hasConflict(projectPath: string): Promise<boolean> {
    const conflicts = await this.getConflictFiles(projectPath)
    return conflicts.length > 0
  }

  async getConflictFiles(projectPath: string): Promise<ConflictFile[]> {
    try {
      const raw = await this.executor.execGit(projectPath, ["diff", "--name-only", "--diff-filter=U"])
      return raw.trim().split("\n").filter(Boolean).map((path) => ({
        path: path.trim(),
        status: "both-modified",
      }))
    } catch { return [] }
  }

  async abortMerge(projectPath: string): Promise<void> {
    await this.executor.execGit(projectPath, ["merge", "--abort"])
  }

  async resolveConflictFile(projectPath: string, file: string, strategy: "theirs" | "ours"): Promise<void> {
    await this.executor.execGit(projectPath, ["checkout", `--${strategy}`, file])
    await this.executor.execGit(projectPath, ["add", file])
  }

  // ── 远程配置 ──

  async addRemote(projectPath: string, name: string, url: string): Promise<void> {
    await this.executor.execGit(projectPath, ["remote", "add", name, url])
  }

  async removeRemote(projectPath: string, name: string): Promise<void> {
    await this.executor.execGit(projectPath, ["remote", "remove", name])
  }

  async renameRemote(projectPath: string, oldName: string, newName: string): Promise<void> {
    await this.executor.execGit(projectPath, ["remote", "rename", oldName, newName])
  }

  async getRemoteUrl(projectPath: string, name: string): Promise<string> {
    try {
      return (await this.executor.execGit(projectPath, ["remote", "get-url", name])).trim()
    } catch {
      return ""
    }
  }

  async setRemoteUrl(projectPath: string, name: string, url: string): Promise<void> {
    await this.executor.execGit(projectPath, ["remote", "set-url", name, url])
  }

  // ── Git 配置查看 ──

  /** 获取本机全局 Git 配置（git config --global --list） */
  async getGitGlobalConfig(): Promise<string> {
    const modules = getNodeFsPathOs()
    const home = modules?.os?.homedir() || process.cwd()
    return this.executor.execGit(home, ["config", "--global", "--list"])
  }

  /** 获取全局 Git 配置文件路径（~/.gitconfig） */
  getGitConfigFilePath(): string {
    const modules = getNodeFsPathOs()
    const home = modules?.os?.homedir() || process.cwd()
    return modules?.path?.join(home, ".gitconfig") || ""
  }

  /** 获取项目级 Git 配置（git config --local --list） */
  async getProjectGitConfig(projectPath: string): Promise<string> {
    return this.executor.execGit(projectPath, ["config", "--local", "--list"])
  }

  /** 获取项目 Git 配置文件路径（<projectPath>/.git/config） */
  getProjectGitConfigFilePath(projectPath: string): string {
    const modules = getNodeFsPathOs()
    return modules?.path?.join(projectPath, ".git", "config") || ""
  }

  /** 用系统默认编辑器打开全局 Git 配置文件 */
  async openGitConfigFile(): Promise<boolean> {
    const filePath = this.getGitConfigFilePath()
    if (!filePath) {
      return false
    }
    if (typeof window.require === "function") {
      try {
        const { shell } = window.require("electron")
        const result = await shell.openPath(filePath)
        return !result // openPath 成功返回空字符串，失败返回错误描述
      } catch {
        return false
      }
    }
    return false
  }

  // ── 仓库扫描 ──

  async scanForGitRepos(dirPath: string): Promise<ScannedGitRepo[]> {
    const nodeModules = getNodeFsPathOs()
    if (!nodeModules) throw new Error("Node 环境不可用")
    const { fs, path } = nodeModules

    if (!fs.existsSync(dirPath)) throw new Error("路径不存在")
    if (!fs.statSync(dirPath).isDirectory()) throw new Error("路径不是目录")

    const SKIP_DIRS = new Set([
      "node_modules", ".git", "__pycache__", ".venv", "venv",
      "dist", "build", "target", "bin", "obj",
    ])

    const results: ScannedGitRepo[] = []
    const queue: string[] = [dirPath]
    let head = 0

    while (head < queue.length) {
      const currentDir = queue[head++]
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true })
        let hasGitDir = false
        const queueLenBefore = queue.length

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name)
          if (entry.name === ".git" && entry.isDirectory()) {
            hasGitDir = true
          } else if (entry.isDirectory() && !entry.isSymbolicLink() && !SKIP_DIRS.has(entry.name)) {
            queue.push(fullPath)
          }
        }

        if (hasGitDir) {
          results.push({ name: path.basename(currentDir), path: currentDir })
          // 不深入已找到 .git 的目录的子目录，避免递归扫描仓库内部
          queue.length = queueLenBefore
        }
      } catch {
        continue
      }
    }

    return results
  }
}
