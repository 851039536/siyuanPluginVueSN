// 撤销 / reset 的公共类型（视图与门面共用，避免组件直接依赖 managers 实现）
import type { WriteJournalOp } from "../managers/WriteJournal"

/** reset 三种模式（与 git 参数同名） */
export type ResetMode = "soft" | "mixed" | "hard"

/** reset / undo 的执行结果 */
export interface UndoResult {
  /** 破坏性路径（hard reset / 撤销 merge 或 reset）生成的 bundle 备份路径 */
  backupPath?: string
}

/** 撤销完成后的摘要（视图据此刷新与提示） */
export interface UndoOutcome extends UndoResult {
  /** 被撤销的操作类型；null = 没有可用日志 */
  op: WriteJournalOp | null
}
