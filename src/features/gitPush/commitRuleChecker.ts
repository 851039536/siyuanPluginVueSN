// gitPush 提交规则检查纯函数（Conventional Commits 校验 + 违规统计聚合）
import type {
  CommitAnalysisEntry,
  CommitRuleCheckStats,
  CommitRuleConfig,
  CommitRuleReasonKey,
  CommitRuleViolation,
} from "./types/meta"
import { DEFAULT_COMMIT_RULE_CONFIG } from "./types/meta"
import { COMMIT_TYPE_VALUES } from "./types/storage"

/** 提交类型白名单（Set 加速校验，与 storage.ts 的 COMMIT_TYPE_VALUES 保持一致） */
const ALLOWED_TYPES = new Set<string>(COMMIT_TYPE_VALUES)

/** 匹配 CJK 统一表意文字（常用汉字，U+4E00–U+9FFF），用于"描述必须含中文"规则判定 */
const HAN_CHAR_REGEX = /[\u4E00-\u9FFF]/

/** scope 合法格式（仅小写字母、数字、连字符，参考 GitHub 仓库/分支命名习惯） */
const SCOPE_FORMAT_REGEX = /^[a-z0-9-]+$/

/** 描述结尾句号（英文句点或中文句号，GitHub 建议标题不以句号结尾） */
const TRAILING_PERIOD_REGEX = /[.。]$/

/**
 * 校验单条提交信息，返回不合规原因；合规返回 null。
 * 规则：type(scope)!: 描述，type 限 feat/fix/chore/docs/style/refactor/test；
 * 另含 GitHub 建议（scope 格式/句号结尾/最短字数/标题正文空行）。
 * @param config 可选规则配置（minSubjectLength 阈值），缺省用默认配置，调用点向后兼容
 */
export function checkCommitRule(
  message: string,
  config: CommitRuleConfig = DEFAULT_COMMIT_RULE_CONFIG,
): CommitRuleReasonKey | null {
  const raw = message ?? ""
  if (raw !== raw.trim()) return "whitespace"

  // 先尝试识别 type 前缀，带/不带 scope、breaking ! 均可
  const prefix = /^([A-Za-z]+)(?:\(([^)]*)\))?(!)?:/.exec(raw)
  if (!prefix) return "missingType"

  const [, type, scope] = prefix
  if (!ALLOWED_TYPES.has(type)) return "invalidType"
  if (scope !== undefined && scope.trim() === "") return "invalidScope"
  if (scope !== undefined && !SCOPE_FORMAT_REGEX.test(scope.trim())) return "invalidScopeFormat"

  // 冒号后必须恰好一个空格，再接非空描述
  const afterColon = raw.slice(prefix[0].length)
  if (!afterColon.startsWith(" ")) return "badSeparator"
  if (afterColon.length > 1 && afterColon[1] === " ") return "badSeparator"

  // 冒号后按首个换行拆分为 subject（首行）与 body（后续），长度/句号/中文判定只作用于 subject，避免 body 内容干扰
  const subjectAndBody = afterColon.slice(1)
  const newlineIdx = subjectAndBody.indexOf("\n")
  const subject = newlineIdx === -1 ? subjectAndBody : subjectAndBody.slice(0, newlineIdx)
  const body = newlineIdx === -1 ? "" : subjectAndBody.slice(newlineIdx + 1)

  if (!subject) return "emptySubject"
  // 描述必须包含中文（type/scope 保持英文 conventional commit 格式）；优先于过短/句号判定，避免英文描述误报为过短
  if (!HAN_CHAR_REGEX.test(subject)) return "notChinese"
  if (TRAILING_PERIOD_REGEX.test(subject)) return "subjectEndsWithPeriod"
  if (subject.length < config.minSubjectLength) return "subjectTooShort"
  // 多行消息：body 首行去空白后非空 = subject 与正文之间缺少空行（单行提交 body 为空串不受影响）
  if (body && body.split("\n")[0].trim() !== "") return "missingBlankLine"
  return null
}

/** 聚合提交条目为提交规则检查统计结果（违规列表按日期降序；merge 提交豁免——消息由 git 自动生成） */
export function analyzeCommitRuleCompliance(
  entries: CommitAnalysisEntry[],
  config: CommitRuleConfig = DEFAULT_COMMIT_RULE_CONFIG,
): CommitRuleCheckStats {
  const violations: CommitRuleViolation[] = []
  for (const entry of entries) {
    // merge 提交（"Merge branch ..." 等）非用户书写，且线性 rebase 无法修正，不计违规
    if (entry.isMerge) continue
    const reason = checkCommitRule(entry.message, config)
    if (reason) {
      violations.push({ ...entry, reason })
    }
  }
  violations.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))

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

/**
 * 启发式修正提交信息；无法可靠修复时返回空串。
 * 可确定性修正的格式问题（trim、空 scope、多余空格、句号结尾、scope 非法字符）+ 缺少 type（按描述关键词推断 type 补全）；
 * 非法 type / 空描述 / 非中文描述 / 描述过短无法可靠推断，返回空串（交由 AI 生成）。
 * 结果经 checkCommitRule 终验，仅返回完全合规的修正结果。
 */
export function fixCommitMessageHeuristically(
  message: string,
  config: CommitRuleConfig = DEFAULT_COMMIT_RULE_CONFIG,
): string {
  const raw = (message ?? "").trim()
  if (!raw) return ""

  const prefix = /^([A-Za-z]+)(?:\(([^)]*)\))?(!)?:\s*(.*)$/.exec(raw)
  // 缺少 type 前缀：从描述关键词推断 type 补全（描述非中文仍不可修，保持中文强制）
  if (!prefix) {
    if (!/[一-鿿]/.test(raw)) return ""
    const subject = raw.replace(/[.。]+$/, "").trim()
    if (!subject) return ""
    const fixed = `${inferType(subject)}: ${subject}`
    return checkCommitRule(fixed, config) === null ? fixed : ""
  }

  const [, type, scope, bang, rest] = prefix
  if (!ALLOWED_TYPES.has(type)) return ""

  // 去掉结尾句号（可确定性修正），trim 后为空视为不可修
  const subject = rest.trim().replace(/[.。]+$/, "").trim()
  if (!subject) return ""
  // 无法自动生成中文描述时视为不可修复，交由 AI 处理
  if (!HAN_CHAR_REGEX.test(subject)) return ""

  // scope 非法字符规范化（大写转小写、非法字符替换为连字符），trim 后为空（如 feat( ):）时省略 scope 段
  const normalizedScope = scope && scope.trim() ? scope.trim().replace(/[^a-z0-9-]/g, "-").toLowerCase() : ""
  const scopePart = normalizedScope ? `(${normalizedScope})` : ""
  const bangPart = bang || ""
  const fixed = `${type}${scopePart}${bangPart}: ${subject}`
  return checkCommitRule(fixed, config) === null ? fixed : ""
}

/** 从描述关键词推断 conventional commit type（命中顺序即优先级，无匹配默认 chore） */
function inferType(subject: string): string {
  if (/修复|解决|错误|异常|缺陷|崩溃|bug/i.test(subject)) return "fix"
  if (/新增|添加|实现|支持|功能|feat/i.test(subject)) return "feat"
  if (/重构|优化|精简|拆分|合并|提取|抽象|调整/i.test(subject)) return "refactor"
  if (/文档|注释|说明|readme/i.test(subject)) return "docs"
  if (/测试|用例|单测/i.test(subject)) return "test"
  if (/样式|格式|布局|排版/i.test(subject)) return "style"
  return "chore"
}
