// gitPush 本地分页 composable（消除 CommitAnalysisPanel / LogPanel 两处分页重复）
import type { Ref } from "vue"
import { computed, ref } from "vue"

export function usePagedList<T>(source: Ref<T[]>, pageSize = 50) {
  /** 当前可见条数（每次 loadMore 累加 pageSize） */
  const visibleCount = ref(pageSize)

  /** 分页切片 */
  const paged = computed(() => source.value.slice(0, visibleCount.value))

  /** 是否还有更多未展示 */
  const hasMore = computed(() => visibleCount.value < source.value.length)

  /** 加载下一页 */
  function loadMore() {
    visibleCount.value += pageSize
  }

  /** 重置到首页 */
  function reset() {
    visibleCount.value = pageSize
  }

  return { visibleCount, paged, hasMore, loadMore, reset }
}
