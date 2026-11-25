// git --progress 输出增量解析：\r 原地刷新、\n 换行、分块截断，输出真实阶段与百分比
import type { GitProgressStage } from "../types/pipeline"

/** 解析出的一条进度事件（stage 缺省表示只有文本消息，不推进阶段） */
export interface GitProgressLineEvent {
  stage?: GitProgressStage
  percent?: number
  detail: string
}

/** 阶段识别：顺序即优先级，先匹配到的生效 */
const STAGE_RULES: { re: RegExp, stage: GitProgressStage }[] = [
  { re: /^enumerating objects/i, stage: "enumerating" },
  { re: /^counting objects/i, stage: "counting" },
  { re: /^(delta compression using|compressing objects)/i, stage: "compressing" },
  { re: /^writing objects/i, stage: "writing" },
  { re: /^receiving objects/i, stage: "receiving" },
  { re: /^unpacking objects/i, stage: "unpacking" },
  { re: /^resolving deltas/i, stage: "resolving" },
  // push 特有："To <url>" 表示已连上远端、等待服务端处理；成功后的 ref 行再推进 updating
  { re: /^to\s+\S+/i, stage: "remote" },
  { re: /->\s*\S+/, stage: "updating" },
  // pull 快进：git 不打印 To/refspec，而是 Updating abc..def / Fast-forward
  { re: /^(updating\s+[0-9a-f]+|fast-forward)/i, stage: "updating" },
]

/** 错误 / 警告 / 普通远端消息：只作为 detail，不推进阶段 */
const DETAIL_ONLY_RE = /^(error|fatal|warning|hint|note):/i

/** 单行解析 */
function parseLine(line: string): GitProgressLineEvent | null {
  const isRemote = /^remote:\s*/i.test(line)
  // 远端 sideband 会把进度也加上 remote: 前缀，剥掉后再识别阶段
  const body = isRemote ? line.replace(/^remote:\s*/i, "").trim() : line
  if (!body) return null

  const percentMatch = body.match(/(\d{1,3})%/)
  const percent = percentMatch ? Math.max(0, Math.min(100, Number(percentMatch[1]))) : undefined

  // 被拒推送行（"! [rejected] main -> main"）：只作为错误 detail，不能点亮「更新引用」
  if (/^!|\[rejected\]/i.test(body)) {
    return { detail: body }
  }

  if (DETAIL_ONLY_RE.test(body)) {
    return { detail: body }
  }

  for (const rule of STAGE_RULES) {
    if (rule.re.test(body)) {
      return { stage: rule.stage, percent, detail: body }
    }
  }

  // 纯远端消息（如 "remote: Create a pull request..."）不推进阶段
  return isRemote ? { detail: body } : null
}

/**
 * 创建增量解析器。每个远程 / 每次重试都新建一个，避免多远程并行时串流。
 *
 * 解析器只做「行 → 事件」的映射与去重，不持有业务状态：
 * - 同一阶段同一百分比重复出现（速度文本变化）不再重复上报；
 * - 阶段切换一定上报，便于 UI 推进；
 * - 阶段无百分比时只上报一次，避免刷屏。
 */
export function createGitProgressParser() {
  let carry = ""
  let lastStage: GitProgressStage | null = null
  let lastPercent: number | undefined
  let lastDetail = ""

  /** 单条事件是否需要上报（去重） */
  function shouldEmit(event: GitProgressLineEvent): boolean {
    if (!event.stage) {
      if (event.detail === lastDetail) return false
      lastDetail = event.detail
      return true
    }
    const stageChanged = event.stage !== lastStage
    const percentChanged = event.percent !== lastPercent
    lastStage = event.stage
    lastPercent = event.percent
    if (stageChanged) {
      lastDetail = event.detail
      return true
    }
    if (percentChanged) {
      lastDetail = event.detail
      return true
    }
    // 同阶段同百分比：只有 detail 变化才上报（如写入速度）
    if (event.detail !== lastDetail) {
      lastDetail = event.detail
      return true
    }
    return false
  }

  function consume(raw: string): GitProgressLineEvent[] {
    const line = raw.trim()
    if (!line) return []
    const event = parseLine(line)
    return event && shouldEmit(event) ? [event] : []
  }

  return {
    /** 追加一个原始输出块，返回本次新增的有效事件 */
    push(chunk: string): GitProgressLineEvent[] {
      carry += chunk
      // \r\n 作为一个分隔符处理，避免 Windows 下产生空行
      const parts = carry.split(/\r\n|\r|\n/)
      carry = parts.pop() ?? ""
      const events: GitProgressLineEvent[] = []
      for (const part of parts) {
        events.push(...consume(part))
      }
      return events
    },
    /** 子进程结束时冲刷残留的半行 */
    flush(): GitProgressLineEvent[] {
      const rest = carry
      carry = ""
      return consume(rest)
    },
  }
}
