// gitPush 项目抓取失败原因分类（纯函数 + 专用错误类型，供失败明细与预检复用）
import type { FetchFailureKind } from "../types"

/** 提取失败原因的展示文本（Error → message；其余类型字符串化；无法提取时回退空串） */
export function fetchFailureReason(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  return typeof reason === "string" ? reason : ""
}

/**
 * 路径预检失败（本地路径不存在）专用错误：分类随错误对象传递，
 * 避免从「执行失败」文案反推原因（文案可能被后续改动/本地化影响）。
 */
export class ProjectFetchError extends Error {
  readonly kind: FetchFailureKind

  constructor(kind: FetchFailureKind, message: string) {
    super(message)
    this.name = "ProjectFetchError"
    this.kind = kind
  }
}

/** 从 git 报错文本推断失败分类（execGit 已把 stderr 拼进 message，此处只做关键字判别；无法判定归入 other） */
export function classifyFetchFailure(reason: unknown): FetchFailureKind {
  const text = fetchFailureReason(reason).toLowerCase()
  // 超时判定放在最前：超时文案末尾会附加超时解法提示，不与后续关键字冲突但优先级最高
  if (/timed out|超时/.test(text)) return "timeout"
  if (/index\.lock|another git process/.test(text)) return "lock"
  if (/dubious ownership|safe\.directory/.test(text)) return "dubiousOwner"
  if (/not a git repository/.test(text)) return "notRepo"
  if (/does not have any commits yet|no commits yet/.test(text)) return "noCommits"
  if (/spawn git|enoent|node 环境不可用/.test(text)) return "gitUnavailable"
  return "other"
}
