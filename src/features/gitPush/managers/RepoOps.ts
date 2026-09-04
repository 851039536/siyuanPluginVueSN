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
      // 用不可见分隔符 0x1F（Unit Separator）替代 |，避免 subject 含 | 时解析错乱
      // 注意：git tag --format 是 for-each-ref 语法，十六进制转义为 %1f；%x1f 是 git log --pretty 专属，在此会被原样输出导致切分失败
      // hash 段：annotated tag 取 %(*objectname)（解引用后的 commit），lightweight tag 回落 %(objectname)（即 commit 本身）
      const raw = await this.executor.execGit(projectPath, ["tag", "-l", `--sort=-creatordate`, `--format=%(refname:short)%1f%(subject)%1f%(creatordate:iso)%1f%(*objectname)%1f%(objectname)`])
      return raw.trim().split("\n").filter(Boolean).slice(0, limit).map((line) => {
        const [name, message, date, peeledHash, objectHash] = line.split("\x1F")
        return {
          name,
          message: message || undefined,
          date: date || undefined,
          hash: peeledHash || objectHash || undefined,
        }
      })
    } catch { return [] }
  }

  async createTag(projectPath: string, name: string, message?: string, commitRef?: string): Promise<void> {
    // "--" 分隔符防止以 "-" 开头的 tag 名被 git 解析为命令行选项；commitRef 在 "--" 之后同样无选项注入面
    const args = message ? ["tag", "-m", message, "--", name] : ["tag", "--", name]
    if (commitRef) args.push(commitRef)
    await this.executor.execGit(projectPath, args)
  }

  async deleteTag(projectPath: string, name: string): Promise<void> {
    await this.executor.execGit(projectPath, ["tag", "-d", "--", name])
  }

  async pushTag(projectPath: string, remoteName: string, tag: string): Promise<string> {
    return await this.executor.execGit(projectPath, ["push", remoteName, "--", tag])
  }

  /** 获取远程已存在的 Tag 名列表（git ls-remote --tags，网络命令走可配置的网络超时） */
  async getRemoteTags(projectPath: string, remoteName: string): Promise<string[]> {
    const raw = await this.executor.execGit(projectPath, ["ls-remote", "--tags", "--", remoteName])
    const names: string[] = []
    for (const line of raw.trim().split("\n").filter(Boolean)) {
      const m = line.match(/refs\/tags\/(.+)$/)
      // 过滤 annotated tag 的 ^{} peel 行，仅保留 tag 名
      if (m && !m[1].endsWith("^{}")) names.push(m[1])
    }
    return names
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

  /**
   * 中止进行中的合并：先检测 MERGE_HEAD 存在才执行（stash pop 冲突等非 merge 场景
   * `git merge --abort` 只会报模糊的 "no merge to abort"，需前置识别给出明确指引）
   */
  async abortMerge(projectPath: string): Promise<void> {
    const node = getNodeFsPathOs()
    if (node) {
      const mergeHead = (await this.executor.execGit(projectPath, ["rev-parse", "--git-path", "MERGE_HEAD"]).catch(() => "")).trim()
      const inMerge = !!mergeHead && node.fs.existsSync(node.path.resolve(projectPath, mergeHead))
      if (!inMerge) {
        throw new Error("当前无进行中的合并（不存在 MERGE_HEAD）。若这是 stash 恢复产生的冲突：stash 条目并未删除，数据不会丢失，请解决冲突或参考终端操作恢复")
      }
    }
    await this.executor.execGit(projectPath, ["merge", "--abort"])
  }

  async resolveConflictFile(projectPath: string, file: string, strategy: "theirs" | "ours"): Promise<void> {
    // "--" 分隔符防止以 "-" 开头的文件路径被 git 解析为选项
    await this.executor.execGit(projectPath, ["checkout", `--${strategy}`, "--", file])
    await this.executor.execGit(projectPath, ["add", "--", file])
  }

  // ── 远程配置（"--" 分隔防止以 "-" 开头的 remote 名被 git 解析为选项，与 Tag 管理同源防护）──

  async addRemote(projectPath: string, name: string, url: string): Promise<void> {
    await this.executor.execGit(projectPath, ["remote", "add", "--", name, url])
  }

  async removeRemote(projectPath: string, name: string): Promise<void> {
    await this.executor.execGit(projectPath, ["remote", "remove", "--", name])
  }

  async renameRemote(projectPath: string, oldName: string, newName: string): Promise<void> {
    await this.executor.execGit(projectPath, ["remote", "rename", "--", oldName, newName])
  }

  async getRemoteUrl(projectPath: string, name: string): Promise<string> {
    try {
      return (await this.executor.execGit(projectPath, ["remote", "get-url", "--", name])).trim()
    } catch {
      return ""
    }
  }

  async setRemoteUrl(projectPath: string, name: string, url: string): Promise<void> {
    await this.executor.execGit(projectPath, ["remote", "set-url", "--", name, url])
  }

  // ── 仓库克隆 ──

  /** 从远程 URL 提取仓库目录名（去尾部 / 与 .git，取最后一段） */
  private repoNameFromUrl(url: string): string {
    const trimmed = url.replace(/\/+$/, "").replace(/\.git$/, "")
    const name = trimmed.split(/[/:]/).pop() || ""
    if (!name) throw new Error("无法从 URL 解析仓库名")
    return name
  }

  /** 克隆仓库到指定父目录下的同名子目录，返回克隆后的完整路径（5 分钟超时，onOutput 实时回传 git 进度输出） */
  async cloneRepo(parentDir: string, url: string, onOutput?: (chunk: string) => void): Promise<string> {
    const nodeModules = getNodeFsPathOs()
    if (!nodeModules) throw new Error("Node 环境不可用")
    const { fs, path } = nodeModules

    if (!fs.existsSync(parentDir)) throw new Error("路径不存在")
    // URL 以 "-" 开头会被 git 解析为命令行选项（选项注入面），直接拒绝
    if (url.trim().startsWith("-")) throw new Error("仓库 URL 不合法：不能以 \"-\" 开头")
    // statSync 包 try-catch：existsSync 与 statSync 之间存在 TOCTOU 窗口（目录被删除时抛原始 ENOENT）
    let parentIsDir = false
    try { parentIsDir = fs.statSync(parentDir).isDirectory() } catch { /* 视同不存在 */ }
    if (!parentIsDir) throw new Error("路径不存在或不是目录")
    const target = path.join(parentDir, this.repoNameFromUrl(url))
    if (fs.existsSync(target)) throw new Error("目标目录已存在")

    // --progress 强制非 TTY 下也输出进度（走 stderr，由 onOutput 流式回传）
    await this.executor.execGit(parentDir, ["clone", "--progress", url], undefined, 300000, onOutput)
    return target
  }

  // ── Git 配置查看 ──

  /** 本机 home 目录（Git 全局配置执行目录） */
  private gitHomeDir(): string {
    const modules = getNodeFsPathOs()
    return modules?.os?.homedir() || process.cwd()
  }

  /** 获取本机全局 Git 配置（git config --global --list） */
  async getGitGlobalConfig(): Promise<string> {
    return this.executor.execGit(this.gitHomeDir(), ["config", "--global", "--list"])
  }

  /** 设置全局 Git 配置项（git config --global <key> <value>） */
  async setGitGlobalConfig(key: string, value: string): Promise<void> {
    await this.executor.execGit(this.gitHomeDir(), ["config", "--global", key, value])
  }

  /** 删除全局 Git 配置项（git config --global --unset-all <key>，键不存在视为成功） */
  async unsetGitGlobalConfig(key: string): Promise<void> {
    try {
      await this.executor.execGit(this.gitHomeDir(), ["config", "--global", "--unset-all", key])
    } catch { /* 删除不存在的配置项无需报错 */ }
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

  /** 设置项目级 Git 配置项（git config --local <key> <value>） */
  async setProjectGitConfig(projectPath: string, key: string, value: string): Promise<void> {
    await this.executor.execGit(projectPath, ["config", "--local", key, value])
  }

  /** 删除项目级 Git 配置项（git config --local --unset-all <key>，键不存在视为成功） */
  async unsetProjectGitConfig(projectPath: string, key: string): Promise<void> {
    try {
      await this.executor.execGit(projectPath, ["config", "--local", "--unset-all", key])
    } catch { /* 删除不存在的配置项无需报错 */ }
  }

  /** 获取项目 Git 配置文件路径（<projectPath>/.git/config） */
  getProjectGitConfigFilePath(projectPath: string): string {
    const modules = getNodeFsPathOs()
    return modules?.path?.join(projectPath, ".git", "config") || ""
  }

  // ── 仓库扫描 ──

  /** 递归扫描目录查找 Git 仓库（异步层级 BFS，不阻塞渲染进程；MAX_DEPTH/MAX_RESULTS 兜底防失控） */
  async scanForGitRepos(dirPath: string): Promise<ScannedGitRepo[]> {
    const nodeModules = getNodeFsPathOs()
    if (!nodeModules) throw new Error("Node 环境不可用")
    const { fs, path } = nodeModules

    if (!fs.existsSync(dirPath)) throw new Error("路径不存在")
    // stat 包 try-catch：existsSync 与 stat 之间存在 TOCTOU 窗口（目录被删除时抛原始 ENOENT）
    try {
      if (!(await fs.promises.stat(dirPath)).isDirectory()) throw new Error("路径不存在或不是目录")
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("目录")) throw e
      throw new Error("路径不存在或不是目录")
    }

    const SKIP_DIRS = new Set([
      "node_modules", ".git", "__pycache__", ".venv", "venv",
      "dist", "build", "target", "bin", "obj",
    ])
    // 扫描边界：防止选错大目录（如磁盘根）耗尽资源
    const MAX_DEPTH = 8
    const MAX_RESULTS = 500

    const results: ScannedGitRepo[] = []
    // 层级 BFS：每层并行读各目录（fs.promises 异步，不阻塞渲染进程），层内发现 .git 的目录不再下钻
    let level: { dir: string, depth: number }[] = [{ dir: dirPath, depth: 0 }]

    while (level.length > 0 && results.length < MAX_RESULTS) {
      type LevelScan = { repos: ScannedGitRepo[], nextDirs: { dir: string, depth: number }[] }
      const scans: LevelScan[] = await Promise.all(level.map(async ({ dir, depth }) => {
        try {
          const entries = await fs.promises.readdir(dir, { withFileTypes: true })
          const nextDirs: { dir: string, depth: number }[] = []
          let hasGitDir = false
          for (const entry of entries) {
            if (entry.name === ".git" && entry.isDirectory()) {
              hasGitDir = true
            } else if (entry.isDirectory() && !entry.isSymbolicLink() && !SKIP_DIRS.has(entry.name) && depth < MAX_DEPTH) {
              nextDirs.push({ dir: path.join(dir, entry.name), depth: depth + 1 })
            }
          }
          // 找到 .git 即为仓库根，不深入其子目录（避免递归扫描仓库内部）
          return { repos: hasGitDir ? [{ name: path.basename(dir), path: dir }] : [], nextDirs: hasGitDir ? [] : nextDirs }
        } catch {
          // 单目录读取失败（权限/删除竞态）跳过，不中断整体扫描
          return { repos: [], nextDirs: [] }
        }
      }))

      for (const scan of scans) {
        results.push(...scan.repos)
        if (results.length >= MAX_RESULTS) break
      }
      level = results.length >= MAX_RESULTS ? [] : scans.flatMap((s) => s.nextDirs)
    }

    return results
  }
}
