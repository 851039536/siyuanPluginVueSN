// 批量操作进度状态管理 composable（顶部旋转进度指示器数据源，含批量执行编排 runBatch）
import { ref, onUnmounted } from "vue"
import type { LoadProgress } from "../types/batchProgress"
import { poolProcess } from "../utils"
import { TimerRegistry } from "@/utils/timerRegistry"

/** runBatch 的函数签名（供 useRefreshOps 等注入方引用，消除手写重复类型） */
export type RunBatch = <T>(
  items: T[],
  label: string,
  fn: (item: T) => Promise<void>,
) => Promise<void>

const DEFAULT_STATE: LoadProgress = {
  visible: false,
  current: 0,
  total: 0,
  label: "",
}

/** 完成态自动消失延时（ms） */
const AUTO_HIDE_DELAY = 3000

export function useBatchProgress(options?: {
  /** 批内并发项目数（默认 3；传入 manager.getGitConcurrency 可跟随 git 并发设置） */
  getBatchSize?: () => number
}) {
  const state = ref<LoadProgress>({ ...DEFAULT_STATE })
  const timers = new TimerRegistry()
  /** 批内并发数（runBatch 时动态求值，跟随 git 并发设置） */
  const getBatchSize = () => Math.max(1, options?.getBatchSize?.() ?? 3)

  function start(total: number, label: string) {
    state.value = { visible: true, current: 0, total, label }
  }

  function advance() {
    state.value.current++
  }

  function end() {
    state.value = { ...DEFAULT_STATE }
  }

  /** 完成批量操作：切换完成图标，短暂停留后自动消失 */
  function finish() {
    state.value = { ...state.value, done: true }
    timers.setTimeout(end, AUTO_HIDE_DELAY)
  }

  /** 跨批次串行链：同一时刻只允许一个批次占用共享进度状态。
   *  防止并发批次（如首屏加载 + 切到统计视图）同时 start() 重置 total、而各自 advance() 累加 current，导致 current 超过 total（如 49/23） */
  let runChain: Promise<void> = Promise.resolve()

  /** 批量处理 + 进度指示包装（per-item 异常隔离，单项目失败不影响后续） */
  async function runBatch<T>(
    items: T[], label: string, fn: (item: T) => Promise<void>,
  ) {
    if (items.length === 0) { return }
    // 跨批次串行：等上一批完全结束再启动本批（批内并发数跟随 git 并发设置，仅跨批次串行）
    const prev = runChain
    let release!: () => void
    runChain = new Promise<void>((r) => { release = r })
    try {
      await prev
      start(items.length, label)
      try {
        await poolProcess(items, getBatchSize(), async (item) => {
          try {
            await fn(item)
          } catch {
            // 单项目失败静默隔离（失败详情由各操作自身的 toast/输出面板呈现）
          } finally {
            advance()
          }
        })
      } finally {
        finish()
      }
    } finally {
      release()
    }
  }

  onUnmounted(() => timers.clearAll())

  return {
    state,
    runBatch,
  }
}
