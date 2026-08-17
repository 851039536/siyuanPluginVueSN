// gitPush 提交规则检查纯函数（Conventional Commits 校验 + 违规统计聚合）
import type {
  CommitAnalysisEntry,
  CommitRuleCheckStats,
  CommitRuleReasonKey,
  CommitRuleViolation,
} from "./types"
import { COMMIT_TYPE_VALUES } from "./types"

/** 提交类型白名单（Set 加速校验，与 storage.ts 的 COMMIT_TYPE_VALUES 保持一致） */
const ALLOWED_TYPES = new Set<string>(COMMIT_TYPE_VALUES)

/**
 * 校验单条提交信息，返回不合规原因；合规返回 null。
 * 规则：type(scope)!: 描述，type 限 feat/fix/chore/docs/style/refactor/test。
 */
export function checkCommitRule(message: string): CommitRuleReasonKey | null {
  const raw = message ?? ""
  if (raw !== raw.trim()) return "whitespace"

  // 先尝试识别 type 前缀，带/不带 scope、breaking ! 均可
  const prefix = /^([A-Za-z]+)(?:\(([^)]*)\))?(!)?:/.exec(raw)
  if (!prefix) return "missingType"

  const [, type, scope] = prefix
  if (!ALLOWED_TYPES.has(type)) return "invalidType"
  if (scope !== undefined && scope === "") return "invalidScope"

  // 冒号后必须恰好一个空格，再接非空描述
  const afterColon = raw.slice(prefix[0].length)
  if (!afterColon.startsWith(" ")) return "badSeparator"
  if (afterColon.length > 1 && afterColon[1] === " ") return "badSeparator"
  const subject = afterColon.slice(1)
  if (!subject) return "emptySubject"
  return null
}

/** 聚合提交条目为提交规则检查统计结果（违规列表按日期降序） */
export function analyzeCommitRuleCompliance(entries: CommitAnalysisEntry[]): CommitRuleCheckStats {
  const violations: CommitRuleViolation[] = []
  for (const entry of entries) {
    const reason = checkCommitRule(entry.message)
    if (reason) {
      violations.push({ ...entry, reason })
    }
  }
  violations.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))

  const countByReason = new Map<CommitRuleReasonKey, number>()
  for (const v of violations) {
    countByReason.set(v.reason, (countByReason.get(v.reason) ?? 0) + 1)
  }
  const byReason = [...countByReason.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalCommits: entries.length,
    violationCount: violations.length,
    compliantCount: entries.length - violations.length,
    byReason,
    violations,
  }
}
