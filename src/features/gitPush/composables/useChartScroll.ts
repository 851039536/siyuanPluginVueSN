// gitPush 图表横向滚动状态机：容器引用 + 左右按钮可用态 + rAF 合并 + Tab 切换滚动位置保持
//
// 从 CandlestickSection.vue 迁出（原组件 401 行 → ~250 行）：滚动逻辑与 K 线渲染无关，
// 且可被后续其他宽图表复用。行为契约与迁出前逐条一致：
// - scroll 事件经 rAF 合并（一帧最多读一次几何属性）
// - 切换项目/范围时数据变化 → 滚回最左
// - Tab 切换（active 变化）→ 切走前存 scrollLeft，切回 canvas 重建后恢复
//   （非激活 Tab 卸载 canvas 会把容器内容宽度归零，浏览器随之把 scrollLeft 重置为 0）
import { type Ref, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"

export interface UseChartScrollOptions {
  /** 滚动容器模板 ref */
  scrollRef: Ref<HTMLElement | null>
  /** 所在 Tab 是否激活（false→true 时恢复滚动位置） */
  active: Ref<boolean>
  /** 数据源（变化时滚回最左；dailyStats 等响应式引用） */
  dataSource: Ref<unknown>
  /** 单次点击滚动距离（px） */
  scrollAmount?: number
}

export interface ChartScrollApi {
  canScrollLeft: Ref<boolean>
  canScrollRight: Ref<boolean>
  handleScrollLeft: () => void
  handleScrollRight: () => void
}

export function useChartScroll(options: UseChartScrollOptions): ChartScrollApi {
  const { scrollRef, active, dataSource, scrollAmount = 300 } = options

  /** 左/右滚动按钮可用状态（滚动到边界时对应方向禁用） */
  const canScrollLeft = ref(false)
  const canScrollRight = ref(false)

  /** 滚动状态检测的 rAF 句柄（合并同一帧内的多次 scroll 事件，避免逐事件强制 layout + 重渲染） */
  let scrollRaf = 0

  /**
   * 已保存的横向滚动位置（px）。
   * 非激活 Tab 会卸载 canvas，容器内容宽度归零导致浏览器把 scrollLeft 重置为 0，
   * 切回时需在 canvas 重建后恢复，避免用户视角跳回最左端。
   */
  let savedScrollLeft = 0

  /** 依据滚动容器当前偏移量更新左右按钮可用状态（1px 容差避免浮点抖动） */
  function updateScrollState() {
    const el = scrollRef.value
    if (!el) return
    canScrollLeft.value = el.scrollLeft > 1
    canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
  }

  /** scroll 事件回调：合并到下一帧执行，一帧内最多读一次几何属性 */
  function onScroll() {
    if (scrollRaf) return
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0
      updateScrollState()
    })
  }

  /** 向左平滑滚动（查看更早日期数据） */
  function handleScrollLeft() {
    scrollRef.value?.scrollBy({ left: -scrollAmount, behavior: "smooth" })
  }

  /** 向右平滑滚动（查看最新日期数据） */
  function handleScrollRight() {
    scrollRef.value?.scrollBy({ left: scrollAmount, behavior: "smooth" })
  }

  onMounted(() => {
    const el = scrollRef.value
    if (!el) return
    el.addEventListener("scroll", onScroll, { passive: true })
    // 初始状态：图表可能尚未渲染完成，待 DOM 稳定后再检测一次滚动边界
    nextTick(updateScrollState)
  })

  // 卸载前移除监听与未执行的 rAF：Vue 3.5 在 unmounted 钩子执行前模板 ref 已被置空，用 unmounted 会静默移除失败
  onBeforeUnmount(() => {
    scrollRef.value?.removeEventListener("scroll", onScroll)
    if (scrollRaf) {
      cancelAnimationFrame(scrollRaf)
      scrollRaf = 0
    }
  })

  // 切换项目/时间范围导致数据变化时：滚动回最左并重新检测边界状态，避免停留在旧数据位置
  watch(dataSource, () => {
    const el = scrollRef.value
    if (!el) return
    el.scrollLeft = 0
    savedScrollLeft = 0
    nextTick(updateScrollState)
  })

  // Tab 切换导致 canvas 销毁/重建时保存与恢复滚动位置：
  // 切走（active=false）时 watcher 先于 DOM 更新触发，此时 scrollLeft 仍有效，先存下；
  // 切回（active=true）时 canvas 尚未重建，需等 nextTick 容器宽度恢复后再写回。
  watch(active, (isActive) => {
    if (!isActive) {
      savedScrollLeft = scrollRef.value?.scrollLeft ?? 0
      return
    }
    nextTick(() => {
      const el = scrollRef.value
      if (el) el.scrollLeft = savedScrollLeft
      updateScrollState()
    })
  })

  return { canScrollLeft, canScrollRight, handleScrollLeft, handleScrollRight }
}
