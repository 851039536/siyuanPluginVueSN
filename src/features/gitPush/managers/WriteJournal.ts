// 写操作日志（每项目一份 NDJSON）：为撤销 / reset 提供操作前的 HEAD / 分支 / reflog 快照
//
// 为什么存在：撤销提交需要知道「这次操作前 HEAD 指向哪」，reset 的撤销更要靠它
// 回到 headBefore（见路线图 F6）。reflog 本身会被 expire 与重写，不能作为唯一依据，
// 故在操作前把关键状态冻结进本地日志。
//
// 为什么落索引目录：与提交索引共用「按项目分文件 + NDJSON 追加」的最简形态
// （见 indexIo.ts 的取舍说明）。日志是纯本地恢复线索，丢了不影响任何 git 操作本身。
//
// 为什么失败必须吞掉：写日志是旁路。磁盘被占用 / 目录不可写时，一次已经成功的提交
// 不能因为「没记上日志」而对外报错 —— 顶多这一条撤销线索缺失。
import type { IndexFileIO } from "./indexIo"
import { projectIndexFile } from "./indexIo"

/**
 * 写操作类型（F6 按此分派撤销策略：commit 用 --soft，merge/reset 用 --hard）。
 * 当前只有 commit（GitPushManager.commit）与 reset（resetTo）会写入；`merge` 的记账
 * 由合并能力（路线图 F4）负责，在它落地前撤销侧的 merge 分支仅经单测构造的日志覆盖。
 */
export type WriteJournalOp = "commit" | "merge" | "reset"

/** 一条写操作记录（一条一行 JSON） */
export interface WriteJournalEntry {
  op: WriteJournalOp
  /** ISO 时间戳 */
  at: string
  /** 操作前 HEAD oid；空串 = 空仓库（该条不会写入，见下方 record 调用侧） */
  headBefore: string
  /** 操作前分支名；空串 = detached HEAD */
  branchBefore: string
  /** 操作前 HEAD reflog 条目（如 `HEAD@{0}: commit: xxx`）；无 reflog 时为空串 */
  reflogBefore: string
  /** 人读标签（提交首行等），供撤销列表展示 */
  label: string
}

/** 操作前状态快照（与 git 命令解耦，解析逻辑可单测） */
export type PreWriteState = Pick<WriteJournalEntry, "headBefore" | "branchBefore" | "reflogBefore">

/** 保留上限：超过后裁到 JOURNAL_KEEP_ENTRIES，避免每次追加都重写文件 */
export const JOURNAL_MAX_ENTRIES = 200
const JOURNAL_KEEP_ENTRIES = 100

/** 把多行文本（提交信息）压成单行标签，过长截断，避免日志行无限膨胀 */
export function journalLabel(text: string, max = 80): string {
  const first = (text.split(/\r?\n/)[0] ?? "").trim()
  return first.length > max ? `${first.slice(0, max)}…` : first
}

/**
 * 解析操作前状态。
 *
 * - log 输出 `%H%x00%D`：hash + 装饰（`HEAD -> main, origin/main`）。
 *   分支名只能从 `HEAD -> x` 取：detached HEAD 时没有该装饰，分支留空。
 * - reflog 输出 `%gD%x00%gs`：`HEAD@{0}` + 说明，拼成一条人读记录。
 *
 * 两者都可能为空（空仓库 / 无 reflog / 命令失败），对应字段留空串而不是抛错。
 */
export function parsePreWriteState(logRaw: string, reflogRaw: string): PreWriteState {
  const [hash = "", decorations = ""] = logRaw.trim().split("\0")
  const branch = /(?:^|,\s*)HEAD -> ([^,]+)/.exec(decorations)?.[1]?.trim() ?? ""
  const [selector = "", subject = ""] = reflogRaw.trim().split("\0")
  const reflogBefore = selector ? (subject ? `${selector}: ${subject}` : selector) : ""
  return {
    headBefore: hash.trim(),
    branchBefore: branch,
    reflogBefore,
  }
}

/**
 * 每项目一份写操作日志。
 *
 * 追加永远不抛错（记录失败只告警）；读取容忍崩溃留下的半行。
 * 职责单一：只做持久化，不跑任何 git 命令、不知道撤销策略。
 */
export class WriteJournal {
  constructor(
    private io: IndexFileIO,
    /** 时间源（测试注入固定时钟；生产用 Date.now） */
    private now: () => number = Date.now,
  ) {}

  private file(projectKey: string): string {
    return projectIndexFile("journal", projectKey)
  }

  /** 追加一条记录。失败只告警，**绝不向调用方抛出**（写日志不得影响主操作） */
  async record(projectKey: string, entry: Omit<WriteJournalEntry, "at">): Promise<void> {
    try {
      const line = JSON.stringify({ ...entry, at: new Date(this.now()).toISOString() })
      await this.io.appendLine(this.file(projectKey), line)
      await this.rotateIfNeeded(projectKey)
    } catch (e) {
      console.warn("[gitPush] 写操作日志记录失败（不影响本次 git 操作）", e)
    }
  }

  /** 读取记录，**最新在前**；损坏行跳过，读失败返回空数组 */
  async list(projectKey: string, limit = JOURNAL_MAX_ENTRIES): Promise<WriteJournalEntry[]> {
    let lines: string[]
    try {
      lines = await this.io.readLines(this.file(projectKey))
    } catch {
      return []
    }
    const entries: WriteJournalEntry[] = []
    for (const line of lines) {
      try {
        const parsed: unknown = JSON.parse(line)
        if (isEntry(parsed)) entries.push(parsed)
      } catch {
        // 崩溃留下的半行 / 非 JSON 内容：跳过这一条，不影响其余记录
      }
    }
    return (limit > 0 ? entries.slice(-limit) : entries).reverse()
  }

  /** 清空该项目日志（删除项目 / 路径变更后调用） */
  async clear(projectKey: string): Promise<void> {
    try {
      await this.io.remove(this.file(projectKey))
    } catch {
      // 删除失败不阻塞：下次写入会重新创建
    }
  }

  private async rotateIfNeeded(projectKey: string): Promise<void> {
    const file = this.file(projectKey)
    const lines = await this.io.readLines(file)
    if (lines.length <= JOURNAL_MAX_ENTRIES) return
    const kept = lines.slice(-JOURNAL_KEEP_ENTRIES)
    await this.io.writeText(file, `${kept.join("\n")}\n`)
  }
}

function isEntry(value: unknown): value is WriteJournalEntry {
  if (!value || typeof value !== "object") return false
  const e = value as Record<string, unknown>
  return (e.op === "commit" || e.op === "merge" || e.op === "reset")
    && typeof e.at === "string"
    && typeof e.headBefore === "string"
    && typeof e.branchBefore === "string"
    && typeof e.reflogBefore === "string"
    && typeof e.label === "string"
}
