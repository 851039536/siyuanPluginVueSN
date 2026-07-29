// 批量操作进度状态管理 composable（含带进度条的批量执行编排 runBatch）
import { ref, onUnmounted } from "vue"
import type { LoadProgress, LogEntry, LogStep } from "../types/batchProgress"
import { batchProcess } from "../utils"

/** 步骤上下文：在批量任务 fn 内部用 ctx.step(name, fn) 测量并记录每个 git 操作的耗时 */
export interface StepCtx {
  step: <R>(name: string, fn: () => Promise<R>) => Promise<R>
}

const DEFAULT_STATE: LoadProgress = {
  visible: false,
  current: 0,
  total: 0,
  label: "",
  elapsedSeconds: 0,
}

export function useBatchProgress() {
  const state = ref<LoadProgress>({ ...DEFAULT_STATE })
  const logEntries = ref<LogEntry[]>([])
  let progressTimer: ReturnType<typeof setInterval> | null = null

  function start(total: number, label: string) {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
    logEntries.value = []
    state.value = { visible: true, current: 0, total, label, elapsedSeconds: 0 }
    const startTime = Date.now()
    progressTimer = setInterval(() => {
      state.value.elapsedSeconds = (Date.now() - startTime) / 1000
    }, 100)
  }

  /** 完成一项并记录项目名（在单项完成后调用，projectName 语义为"最近完成的项目"而非"正在处理的项目"） */
  function advance(projectName?: string) {
    state.value.current++
    if (projectName) {
      state.value.projectName = projectName
    }
  }

  function end() {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
    state.value = { ...DEFAULT_STATE }
  }

  /** 完成批量操作：停止计时器但保持可见，等待用户手动关闭 */
  function finish() {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
    state.value = { ...state.value, done: true }
  }

  /** 手动关闭进度条（复用 end，防御性清理计时器） */
  function hide() {
    end()
  }

  /** 创建 pending 状态的日志条目，返回索引供后续 addStep/completeLog 使用 */
  function beginLog(projectName: string): number {
    const entry: LogEntry = {
      projectName,
      status: "pending",
      elapsedSeconds: 0,
      steps: [],
    }
    logEntries.value.push(entry)
    return logEntries.value.length - 1
  }

  /** 向指定日志条目追加一个步骤耗时记录 */
  function addStep(idx: number, step: LogStep) {
    const entry = logEntries.value[idx]
    if (!entry) return
    // 替换整个 entry 对象确保 Vue 响应式更新
    logEntries.value[idx] = {
      ...entry,
      steps: [...(entry.steps || []), step],
    }
  }

  /** 完成指定日志条目，设置最终状态和总耗时 */
  function completeLog(idx: number, status: "ok" | "fail", elapsedSeconds: number, error?: string) {
    const entry = logEntries.value[idx]
    if (!entry) return
    logEntries.value[idx] = {
      ...entry,
      status,
      elapsedSeconds,
      error,
    }
  }

  onUnmounted(() => {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
  })

  /** 跨批次串行链：同一时刻只允许一个批次占用共享进度状态。
   *  防止并发批次（如首屏加载 + 切到统计视图）同时 start() 重置 total、而各自 advance() 累加 current，导致 current 超过 total（如 49/23） */
  let runChain: Promise<void> = Promise.resolve()

  /** 批量处理 + 进度条包装（per-item 异常隔离，单项目失败不影响后续，支持分步骤计时） */
  async function runBatch<T>(
    items: T[], label: string, fn: (item: T, ctx: StepCtx) => Promise<void>, getName?: (item: T) => string, options?: { keepVisible?: boolean },
  ) {
    if (items.length === 0) { return }
    // 跨批次串行：等上一批完全结束再启动本批（批内仍保留 3 路并发，仅跨批次串行）
    const prev = runChain
    let release!: () => void
    runChain = new Promise<void>((r) => { release = r })
    try {
      await prev
      start(items.length, label)
      try {
        await batchProcess(items, 3, async (item, index) => {
          const name = getName?.(item) ?? ""
          const displayName = name || `#${index + 1}`
          const logIdx = beginLog(displayName)
          const startTime = Date.now()

          // 构造步骤上下文：step() 测量耗时后追加到当前日志条目
          const ctx: StepCtx = {
            async step<R>(stepName: string, stepFn: () => Promise<R>): Promise<R> {
              const stepStart = Date.now()
              try {
                return await stepFn()
              } finally {
                addStep(logIdx, { name: stepName, ms: Date.now() - stepStart })
              }
            },
          }

          try {
            await fn(item, ctx)
            advance(name)
            completeLog(logIdx, "ok", (Date.now() - startTime) / 1000)
          } catch (err) {
            const elapsed = (Date.now() - startTime) / 1000
            advance(name)
            completeLog(logIdx, "fail", elapsed, String(err))
          }
        })
      } finally {
        if (options?.keepVisible) {
          finish()
        } else {
          end()
        }
      }
    } finally {
      release()
    }
  }

  return {
    state,
    logEntries,
    start,
    advance,
    end,
    finish,
    hide,
    beginLog,
    addStep,
    completeLog,
    runBatch,
  }
}
