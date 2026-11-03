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

/** 描述以小写英文字母开头（可选规则"首字母大写"仅此情形判违规，中文/大写/数字/符号开头天然合规） */
const SUBJECT_NOT_CAPITALIZED_REGEX = /^[a-z]/

/** 描述以临时提交标记开头（wip/todo/fixme/tbd，大小写不敏感；\b 在字母→中文边界成立，"WIP登录"可命中） */
const WIP_SUBJECT_REGEX = /^(wip|todo|fixme|tbd)\b/i

/**
 * 构建 AI 生成提交信息的规则约束 prompt 片段（单一事实源：AI 生成与生成后校验共用同一套规则描述）。
 * @param config 规则配置（可选规则按开关动态拼接，与 checkCommitRule 校验口径一致）
 */
export function buildCommitRulePrompt(config: CommitRuleConfig): string {
  const parts = [
    `type 必须为 ${COMMIT_TYPE_VALUES.join("/")} 之一`,
    "描述使用中文，不得以句号（. 或 。）结尾",
    `描述不少于 ${config.minSubjectLength} 个字`,
  ]
  // scope 字符集约束仅在开启该规则时下发：规则关闭时不再要求 AI 转小写连字符，
  // 使设置与 AI 产出行为一致（否则会出现"设置里关了、AI 仍按开启生成"的错位）
  if (config.scopeFormatEnabled) {
    parts.splice(1, 0, "scope（可选）仅允许小写字母、数字、连字符；引用模块名时转为小写连字符形式（如 HidHelper → hid-helper）")
  }
  // 首字母大写规则必须下发：校验对小写英文字母开头的描述一判即违规，
  // 而"以英文单词起头 + 中文说明"（如 update README 说明）并不违反"描述使用中文"，
  // 旧注释"中文即天然合规"的判断有误，会导致 AI 偶发产出被校验打回
  if (config.requireCapitalizedSubject) {
    parts.push("描述不要以小写英文字母开头（以英文单词开头时首字母大写，建议直接以中文开头）")
  }
  if (config.detectWipSubject) {
    parts.push("不要以 wip/todo/fixme 等临时标记开头")
  }
  if (config.bodyLineLimitEnabled) {
    parts.push(`若输出多行，每行不超过 ${config.maxBodyLineLength} 个字符`)
  }
  return parts.join("；")
}

/**
 * 校验单条提交信息，返回不合规原因；合规返回 null。
 * 规则：type(scope)!: 描述，type 限 feat/fix/chore/docs/style/refactor/test；
 * 另含 GitHub 建议（句号结尾/最短字数/标题正文空行）与可选规则（首字母大写/WIP/scope 格式/正文行长）。
 * @param config 规则配置（阈值 + 可选规则开关），缺省用默认配置，调用点向后兼容
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
  if (scope !== undefined) {
    const trimmedScope = scope.trim()
    // "scope 为空"恒校验：写了空括号 `feat(): xxx` 在任何配置下都是笔误，与字符集规则无关
    if (!trimmedScope) return "invalidScope"
    // 字符集规则按开关生效（默认关闭）：见 CommitRuleConfig.scopeFormatEnabled 注释
    if (config.scopeFormatEnabled && !SCOPE_FORMAT_REGEX.test(trimmedScope)) return "invalidScopeFormat"
  }

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
  // 可选规则：描述首字母大写（仅小写英文字母开头判违规，中文/大写/数字/符号开头天然合规）
  if (config.requireCapitalizedSubject && SUBJECT_NOT_CAPITALIZED_REGEX.test(subject)) return "subjectNotCapitalized"
  // 可选规则：WIP 临时提交检测（"wip: xxx" 已被 missingType 拦截，此处针对 "feat: WIP xxx" 描述开头标记）
  if (config.detectWipSubject && WIP_SUBJECT_REGEX.test(subject)) return "wipSubject"
  if (TRAILING_PERIOD_REGEX.test(subject)) return "subjectEndsWithPeriod"
  if (subject.length < config.minSubjectLength) return "subjectTooShort"
  // 多行消息：body 首行去空白后非空 = subject 与正文之间缺少空行（单行提交 body 为空串不受影响）
  if (body && body.split("\n")[0].trim() !== "") return "missingBlankLine"
  // 可选规则：正文行长限制（body 逐行超限判违规，空行长度 0 天然合规）
  if (config.bodyLineLimitEnabled && body.split("\n").some((line) => line.length > config.maxBodyLineLength)) return "bodyLineTooLong"
  return null
}

/** 聚合提交条目为提交规则检查统计结果（违规列表按日期降序；merge 提交豁免且不计入检查数——消息由 git 自动生成） */
export function analyzeCommitRuleCompliance(
  entries: CommitAnalysisEntry[],
  config: CommitRuleConfig = DEFAULT_COMMIT_RULE_CONFIG,
): CommitRuleCheckStats {
  const violations: CommitRuleViolation[] = []
  /** 实际参与规则判定的提交数（排除 merge：它们既不会被判违规，也不应计入合规率分母） */
  let checkedCount = 0
  for (const entry of entries) {
    // merge 提交（"Merge branch ..." 等）非用户书写，且线性 rebase 无法修正，不计违规
    if (entry.isMerge) continue
    checkedCount++
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
    totalCommits: checkedCount,
    violationCount: violations.length,
    compliantCount: checkedCount - violations.length,
    byReason,
    violations,
  }
}

/**
 * 启发式修正提交信息；无法可靠修复时返回空串。
 * 可确定性修正的格式问题（trim、代码块/引号包裹、空 scope、多余空格、句号结尾、scope 非法字符、首字母大写）
 * + 缺少 type（按描述关键词推断 type 补全）；非法 type / 空描述 / 非中文描述 / 描述过短无法可靠推断，返回空串。
 * 结果经 checkCommitRule 终验，仅返回完全合规的修正结果；原多行正文可随标题一起通过校验时予以保留。
 */
export function fixCommitMessageHeuristically(
  message: string,
  config: CommitRuleConfig = DEFAULT_COMMIT_RULE_CONFIG,
): string {
  const raw = stripWrapping((message ?? "").trim()).replace(/\r\n?/g, "\n")
  if (!raw) return ""

  const newlineIdx = raw.indexOf("\n")
  const subjectLine = newlineIdx === -1 ? raw : raw.slice(0, newlineIdx)
  const bodyRaw = newlineIdx === -1 ? "" : raw.slice(newlineIdx + 1)
  const fixedSubject = fixSubjectLine(subjectLine, config)
  if (!fixedSubject) return ""
  if (bodyRaw) {
    const rest = bodyRaw.startsWith("\n") ? `\n${bodyRaw}` : `\n\n${bodyRaw}`
    const withBody = `${fixedSubject}${rest}`
    // 原正文仍合规时保留（避免多行提交信息被降级成单行）；正文本身违规时退回单行
    if (checkCommitRule(withBody, config) === null) return withBody
  }
  return checkCommitRule(fixedSubject, config) === null ? fixedSubject : ""
}

/** 启发式修订单行标题：type 补全/小写、scope 规范化、句号去除、首字母大写；返回结果不做终验（由调用方统一校验） */
function fixSubjectLine(line: string, config: CommitRuleConfig): string {
  const raw = line.trim()
  if (!raw) return ""

  const prefix = /^([A-Za-z]+)(?:\(([^)]*)\))?(!)?:\s*(.*)$/.exec(raw)
  // 缺少 type 前缀：从描述关键词推断 type 补全（描述非中文仍不可修，保持中文强制）
  if (!prefix) {
    if (!HAN_CHAR_REGEX.test(raw)) return ""
    const subject = capitalizeLeadingLatin(raw.replace(/[.。]+$/, "").trim(), config)
    return subject ? `${inferType(subject)}: ${subject}` : ""
  }

  const [, type, scope, bang, rest] = prefix
  // type 大小写规范化（AI/手输大写 type 常见笔误，如 Feat → feat）
  const normalizedType = type.toLowerCase()
  if (!ALLOWED_TYPES.has(normalizedType)) return ""

  // 去掉结尾句号（可确定性修正），trim 后为空视为不可修
  const subject = capitalizeLeadingLatin(rest.trim().replace(/[.。]+$/, "").trim(), config)
  if (!subject) return ""
  // 无法自动生成中文描述时视为不可修复，交由 AI 处理
  if (!HAN_CHAR_REGEX.test(subject)) return ""

  const scopePart = normalizeScope(scope, config)
  return `${normalizedType}${scopePart ? `(${scopePart})` : ""}${bang || ""}: ${subject}`
}

/** 可选规则"首字母大写"的确定性修正：仅当描述以小写英文字母开头时改首字母大写（规则关闭时不改动） */
function capitalizeLeadingLatin(subject: string, config: CommitRuleConfig): string {
  if (!config.requireCapitalizedSubject || !SUBJECT_NOT_CAPITALIZED_REGEX.test(subject)) return subject
  return subject.charAt(0).toUpperCase() + subject.slice(1)
}

/**
 * scope 规范化：仅在"scope 格式校验"开启时改写字符集。
 * 规则关闭时任意写法（大写/中文/下划线）均判合规，保留原样——否则会把 `feat(用户模块)` 改写成
 * `feat(----)`，与设置里"关闭即不限写法"的承诺相反。
 * 规则开启时若转换后已无任何字母数字（如全中文 scope），直接省略该 scope，避免产出 `feat(----)` 这类无意义片段。
 */
function normalizeScope(scope: string | undefined, config: CommitRuleConfig): string {
  const trimmed = (scope ?? "").trim()
  if (!trimmed) return ""
  if (!config.scopeFormatEnabled) return trimmed
  // 必须先转小写再替换非法字符：反序会把大写字母本身当成非法字符（HidHelper → -id-elper），
  // 与 prompt 声明的「HidHelper → hid-helper」相反
  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9-]/g, "-")
  return /[a-z0-9]/.test(normalized) ? normalized : ""
}

/** 去掉 AI 偶发包裹的 Markdown 代码块与成对引号（否则合法提交信息会被误判为"缺少 type"并改写成语义错误的 type） */
function stripWrapping(raw: string): string {
  let out = raw.trim()
  const fence = /^```[a-zA-Z-]*\s*\n([\s\S]*?)\n?```$/.exec(out)
  if (fence) out = fence[1].trim()
  if (out.length >= 2) {
    const pairs: Record<string, string> = { "\"": "\"", "'": "'", "“": "”", "‘": "’" }
    const closing = pairs[out.charAt(0)]
    if (closing && out.endsWith(closing)) out = out.slice(1, -1).trim()
  }
  return out
}

/**
 * AI 输出的确定性后处理：仅对标题行做 type 小写、scope 规范化、句号去除与首字母大写，正文行原样保留；
 * 标题与正文之间缺失空行时确定性补齐（missingBlankLine 规则），避免多行要点因格式细节被整体丢弃；
 * 规范化后仍违规返回空串（交由调用方降级启发式）。
 */
export function normalizeCommitMessageFormat(message: string, config: CommitRuleConfig): string {
  const raw = stripWrapping((message ?? "").replace(/\r\n?/g, "\n").trim())
  if (!raw) return ""
  const newlineIdx = raw.indexOf("\n")
  const subjectLine = newlineIdx === -1 ? raw : raw.slice(0, newlineIdx)
  const bodyRaw = newlineIdx === -1 ? "" : raw.slice(newlineIdx + 1)
  const fixedSubject = fixCommitMessageHeuristically(subjectLine, config)
  if (!fixedSubject) return ""
  const rest = bodyRaw === ""
    ? ""
    : bodyRaw.startsWith("\n") ? `\n${bodyRaw}` : `\n\n${bodyRaw}`
  const fixed = `${fixedSubject}${rest}`
  if (checkCommitRule(fixed, config) === null) return fixed
  // 正文违规（如正文单行超长）时退回合规的标题行：保住 AI 产出的有效标题，
  // 比整条丢弃、降级到对原提交信息的启发式修正更可靠
  return checkCommitRule(fixedSubject, config) === null ? fixedSubject : ""
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
