// 破坏性 git 操作的 bundle 全量备份（BFG 清理 / reset 撤销共用）
//
// 为什么单独成层：备份的目录布局、命名、保留份数与轮转是同一套规则，
// 原先长在 RepoCleanOps 里，reset 复用时会变成「清理逻辑依赖 BFG 编排」的反向耦合。
// 按用途分目录（bfg / reset）：两类备份的保留策略与展示入口不同，混在一个目录会被
// 对方的 prune 顺手删掉。
//
// 插件侧目录布局与桌面端不同：<workspace>/data/storage/petal/<plugin>/<kind>-backups/<项目名>/
// （沿用既有 bfg-backups 目录，老备份仍可被轮转与清理）；桌面端是 <backupDir>/<kind>/<项目名>。
// 根目录由调用方注入（GitPushManager 负责拼接 petal 路径），本文件因此不 import 思源 api，
// 纯 git 单测可以直接注入临时目录。
//
// 备份产物是 `git bundle`（单文件可用 `git clone <文件>` 恢复），不含工作区改动 ——
// reset --hard 丢掉的未提交内容无法从 bundle 找回，这一限制由调用方在界面上说明。
import type { GitExecutor } from "./GitExecutor"
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** 备份用途：决定目录命名与清理范围 */
export type BackupKind = "bfg" | "reset"

/** 每项目保留份数（超出按文件名时间戳轮换删除最旧） */
export const BACKUP_KEEP = 3

/** bundle 生成超时（视仓库大小放宽） */
const BUNDLE_TIMEOUT_MS = 600000

export class BackupOps {
  /**
   * @param backupRoot 备份根目录（插件数据目录下的 petal/<plugin>；测试注入临时目录）
   */
  constructor(
    private executor: GitExecutor,
    private backupRoot: () => string | Promise<string>,
  ) {}

  /**
   * 创建 bundle 全量备份。
   * @returns 备份文件的完整路径
   */
  async createBackup(projectPath: string, kind: BackupKind = "bfg"): Promise<string> {
    const node = getNodeFsPathOs()
    if (!node) throw new Error("Node 环境不可用")
    const { fs, path } = node

    const backupDir = await this.backupDirOf(projectPath, kind)
    fs.mkdirSync(backupDir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const backupPath = path.join(backupDir, `${path.basename(projectPath)}-${ts}.bundle`)
    await this.executor.execGit(projectPath, ["bundle", "create", backupPath, "--all"], undefined, BUNDLE_TIMEOUT_MS)
    this.pruneBackups(backupDir)
    return backupPath
  }

  /** 清空该项目指定用途目录下的全部 bundle（用户主动清理；仅删 .bundle 文件防误删） */
  async deleteBackups(projectPath: string, kind: BackupKind = "bfg"): Promise<number> {
    const node = getNodeFsPathOs()
    if (!node) throw new Error("Node 环境不可用")
    const { fs, path } = node
    const dir = await this.backupDirOf(projectPath, kind)
    let removed = 0
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith(".bundle")) continue
        try { fs.rmSync(path.join(dir, f), { force: true }); removed++ } catch { /* 单文件失败不中断 */ }
      }
    } catch { /* 目录不存在视为无备份 */ }
    return removed
  }

  /** 项目备份目录路径（界面展示与打开文件夹用） */
  async backupDirOf(projectPath: string, kind: BackupKind = "bfg"): Promise<string> {
    const node = getNodeFsPathOs()
    if (!node) throw new Error("Node 环境不可用")
    const { path } = node
    const base = await this.backupBaseDir()
    return path.join(base, `${kind}-backups`, path.basename(projectPath))
  }

  /** 备份根目录（懒加载缓存） */
  private workspaceRootCache = ""
  private async backupBaseDir(): Promise<string> {
    if (this.workspaceRootCache) return this.workspaceRootCache
    this.workspaceRootCache = await this.backupRoot()
    return this.workspaceRootCache
  }

  /** 清理旧备份：仅保留最近 keep 份（按文件名时间戳排序） */
  private pruneBackups(dir: string, keep = BACKUP_KEEP): void {
    const node = getNodeFsPathOs()
    if (!node) return
    const { fs, path } = node
    try {
      const files = fs.readdirSync(dir).filter((f: string) => f.endsWith(".bundle")).sort()
      while (files.length > keep) {
        const oldest = files.shift()
        if (oldest) {
          try { fs.rmSync(path.join(dir, oldest), { force: true }) } catch { /* 忽略 */ }
        }
      }
    } catch { /* 目录不存在等，忽略 */ }
  }
}
