// 统计刷新事件总线：让「自加载」的子 Tab（热力图/活跃度/分布）在顶部总刷新时一并重载。
//
// 背景：这些 Tab 各自持有查询函数、自管加载时机（onMounted / active 变化），
// 顶部刷新按钮只驱动 useStatistics + useHistoryData，导致点刷新后这些 Tab 数据陈旧。
// 这里用一个极轻量的订阅/广播（而非把查询上提到 index.vue）保留各 Tab 的自治，
// 同时把「何时刷新」的决策权交回顶层。
import {
  ref,
  watch,
} from "vue"

/** 全局刷新令牌：顶层每次全量刷新自增，订阅方 watch 该令牌触发自身重载 */
const refreshToken = ref(0)

/** 触发一次全局刷新通知（由统计面板顶部的刷新/定时刷新调用） */
export function notifyStatisticsRefresh(): void {
  refreshToken.value++
}

/**
 * 订阅全局刷新通知。
 * 首次挂载不触发（初次加载由各 Tab 自行负责），仅响应后续的显式刷新。
 * @param handler 每次全局刷新时执行（通常为组件自身的 load 函数）
 * @returns 取消订阅函数（组件卸载时调用，避免回调悬挂）
 */
export function onStatisticsRefresh(handler: () => void): () => void {
  return watch(refreshToken, () => {
    handler()
  })
}
