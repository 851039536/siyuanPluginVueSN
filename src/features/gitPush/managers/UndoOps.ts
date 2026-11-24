// 撤销 / reset / reflog 读取（F6）：显式重置到任意提交，按写操作日志撤销上一次操作
//
// 三条硬约束（对应路线图 F6 的风险清单）：
// 1. merge / rebase / cherry-pick / revert 进行中一律禁止 reset —— 中断状态的文件与
//    重置后的 HEAD 不再匹配，继续操作只会把冲突状态搅成更难恢复的形态。
// 2. `--hard` 会丢暂存与工作区改动（未跟踪文件也不会恢复），所以执行前先做 bundle 备份，
//    并由调用方在界面上明确提示；bundle 只保提交历史，不保工作区内容。撤销走 hard 时
//    还要求工作区干净：soft/mixed 重置后改动仍在工作区，硬回退会把它们连根清掉。
// 3. 撤销前必须校验「当前 HEAD 仍是那次操作的结果」。用户可能已经手动提交/切分支，
//    再按旧日志硬回退会连后面的提交一起丢掉 —— 校验不过就拒绝，并提示去 Reflog 手动恢复。
import type { RefLogEntry } from "../types/reflog"
import type { ResetMode, UndoResult } from "../types/undo"
import type { WriteJournalEntry } from "./WriteJournal"
import type { BackupOps } from "./BackupOps"
import type { GitExecutor } from "./GitExecutor"
import { parseReflog } from "../utils/reflogParse"
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** 中断状态文件 → 用户可读的操作名（顺序即提示优先级） */
const SEQUENCER_FILES: Array<[string, string]> = [
  ["MERGE_HEAD", "合并"],
  ["rebase-merge", "变基"],
  ["rebase-apply", "变基"],
  ["CHERRY_PICK_HEAD", "拣选"],
  ["REVERT_HEAD", "回退"],
]

const RESET_TIMEOUT_MS = 120000

export class UndoOps {
  constructor(private executor: GitExecutor, private backupOps: BackupOps) {}

  /** 读取 reflog（最新在前）；`--date=iso` 让选择器带绝对时间，避免相对时间在展示时漂移 */
  async listReflog(projectPath: string, limit = 100): Promise<RefLogEntry[]> {
    const raw = await this.executor.execGit(projectPath, [
      "reflog", "show", "--date=iso", "-n", String(Math.max(1, Math.floor(limit))),
      "--format=%H%x00%gs%x00%gD",
    ])
    return parseReflog(raw)
  }

  /**
   * 显式重置到指定提交。
   * `hard` 前自动备份（bundle）；`soft` / `mixed` 不动工作区文件，不需要备份。
   */
  async reset(projectPath: string, mode: ResetMode, ref: string): Promise<UndoResult> {
    await this.assertResettable(projectPath)
    const target = await this.resolveCommit(projectPath, ref)
    const backupPath = mode === "hard"
      ? await this.backupOps.createBackup(projectPath, "reset")
      : undefined
    await this.executor.execGit(projectPath, ["reset", `--${mode}`, target], undefined, RESET_TIMEOUT_MS)
    return { backupPath }
  }

  /**
   * 撤销写操作日志中的最后一条操作。
   * - commit：`--soft` 回到父提交（暂存区保留，等同「取消提交」）；
   * - merge / reset：`--hard` 回到 headBefore（要求工作区干净，先备份）。
   *
   * merge 条目由合并能力（路线图 F4）负责记账；当前版本没有合并入口，因此这条分支
   * 只在单测构造的日志上可达 —— 保留它是因为 F6 的设计口径包含合并撤销，接入 F4
   * 后即可生效，而不是要把硬回退逻辑再写一遍。
   */
  async undo(projectPath: string, entry: WriteJournalEntry | null | undefined): Promise<UndoResult> {
    if (!entry) throw new Error("没有可撤销的操作记录")
    if (!entry.headBefore) throw new Error("该操作没有可回退的目标（空仓库），无法撤销")
    await this.assertSameBranch(projectPath, entry.branchBefore)
    await this.assertResettable(projectPath)
    return entry.op === "commit"
      ? this.undoCommit(projectPath, entry)
      : this.undoPointMove(projectPath, entry)
  }

  private async undoCommit(projectPath: string, entry: WriteJournalEntry): Promise<UndoResult> {
    const parents = await this.headParents(projectPath)
    // [HEAD, 父提交]：多于一个父 = 这是合并提交，撤销语义与 merge 撤销冲突
    if (parents.length !== 2) {
      throw new Error("当前 HEAD 不是普通提交（可能是合并或根提交），无法自动撤销；可在 Reflog 中手动恢复")
    }
    if (parents[1] !== entry.headBefore) {
      throw new Error("HEAD 已变化，无法自动撤销这条操作；可在 Reflog 中手动恢复")
    }
    // --soft：提交内容退回暂存区，不碰工作区，是「取消提交」最安全的形态
    await this.executor.execGit(projectPath, ["reset", "--soft", entry.headBefore], undefined, RESET_TIMEOUT_MS)
    return {}
  }

  private async undoPointMove(projectPath: string, entry: WriteJournalEntry): Promise<UndoResult> {
    const head = await this.resolveCommit(projectPath, "HEAD")
    if (head === entry.headBefore) throw new Error("当前 HEAD 已在该操作之前，无需撤销")

    const latest = (await this.executor.execGit(projectPath, ["reflog", "show", "-1", "--format=%gs"])).trim()
    if (entry.op === "merge") {
      // 合并结果：合并提交的首父就是操作前的分支头（fast-forward 时 HEAD 本身就是首父链）
      const parents = await this.headParents(projectPath)
      if (parents.length < 2 || parents[1] !== entry.headBefore) {
        throw new Error("当前 HEAD 不是该次合并的结果，无法自动撤销；可在 Reflog 中手动恢复")
      }
    } else if (!latest.startsWith("reset:")) {
      // reset 之后又提交/切分支/合并：最新 reflog 不再是 reset，硬回退会连带丢弃后续改动
      throw new Error("该重置之后仓库又发生了变化，无法自动撤销；可在 Reflog 中手动恢复")
    }

    // 最后一道闸：硬回退会清掉工作区里的已跟踪改动（bundle 备份只含提交历史）
    await this.assertCleanWorktree(projectPath)
    const backupPath = await this.backupOps.createBackup(projectPath, "reset")
    await this.executor.execGit(projectPath, ["reset", "--hard", entry.headBefore], undefined, RESET_TIMEOUT_MS)
    return { backupPath }
  }

  /**
   * 硬回退前要求工作区干净。
   *
   * soft/mixed 重置会保留工作区改动，若紧接着点「撤销」，这些**从未提交过**的内容会被
   * `reset --hard` 永久清掉，而 bundle 只保提交、事后无法找回。未跟踪文件不受硬回退影响，
   * 因此用 `--untracked-files=no` 只拦已跟踪改动。
   */
  private async assertCleanWorktree(projectPath: string): Promise<void> {
    const raw = await this.executor.execGit(
      projectPath,
      ["status", "--porcelain", "--untracked-files=no"],
    )
    if (raw.trim()) {
      throw new Error("工作区有未提交改动，硬回退会丢弃它们：请先提交或 stash 后再撤销")
    }
  }

  /** merge / rebase / cherry-pick / revert 进行中禁止 reset（中断状态与目标 HEAD 不匹配） */
  private async assertResettable(projectPath: string): Promise<void> {
    for (const [file, label] of SEQUENCER_FILES) {
      if (await this.gitPathExists(projectPath, file)) {
        throw new Error(`${label}进行中：请先完成或中止${label}后再重置`)
      }
    }
  }

  /** 分支守卫：在别的分支上按旧日志撤销会误伤当前分支 */
  private async assertSameBranch(projectPath: string, branchBefore: string): Promise<void> {
    if (!branchBefore) return
    let current = ""
    try {
      current = (await this.executor.execGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"])).trim()
    } catch {
      return
    }
    if (current && current !== branchBefore && current !== "HEAD") {
      throw new Error(`当前分支已从 ${branchBefore} 切换，无法撤销这条操作；可在 Reflog 中手动恢复`)
    }
  }

  /** `git rev-list --parents -n 1 HEAD` → [HEAD, 父1, 父2...] */
  private async headParents(projectPath: string): Promise<string[]> {
    try {
      const raw = await this.executor.execGit(projectPath, ["rev-list", "--parents", "-n", "1", "HEAD"])
      return raw.trim().split(/\s+/).filter(Boolean)
    } catch {
      throw new Error("无法读取当前提交（仓库可能为空或已损坏）")
    }
  }

  private async resolveCommit(projectPath: string, ref: string): Promise<string> {
    try {
      return (await this.executor.execGit(projectPath, ["rev-parse", "--verify", `${ref}^{commit}`])).trim()
    } catch {
      throw new Error(`目标提交不存在：${ref}`)
    }
  }

  private async gitPathExists(projectPath: string, name: string): Promise<boolean> {
    const node = getNodeFsPathOs()
    if (!node) return false
    try {
      const raw = (await this.executor.execGit(projectPath, ["rev-parse", "--git-path", name])).trim()
      return !!raw && node.fs.existsSync(node.path.resolve(projectPath, raw))
    } catch {
      return false
    }
  }
}
