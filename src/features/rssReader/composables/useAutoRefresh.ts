/**
 * RSS 自动刷新组合式函数 — 按设置间隔定时刷新全部订阅源
 */
import type { Ref } from "vue"

export interface AutoRefreshDeps {
  settings: Ref<{ refreshInterval: number }>
  refreshAll: () => Promise<void>
}

export function useAutoRefresh(deps: AutoRefreshDeps) {
  const {
    settings,
    refreshAll,
  } = deps

  let timer: ReturnType<typeof setInterval> | undefined

  function start() {
    stop()
    const minutes = settings.value.refreshInterval
    if (minutes > 0) {
      timer = setInterval(() => {
        void refreshAll()
      }, minutes * 60 * 1000)
    }
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  }

  return {
    start,
    stop,
  }
}
