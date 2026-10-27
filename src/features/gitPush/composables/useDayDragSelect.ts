// gitPush 热力图/日历的「拖过一片日格选区间」状态机。
// 独立成 composable：热力图与日历共用同一套逻辑，避免两处各写一遍「拖拽收尾 click 抑制」这个易错点。
// 刻意不用 onMounted/onUnmounted：mouseup 监听在首次按下时挂、收尾时摘，
// 既没有组件上下文依赖（可在 Node 环境直接单测），也不会因组件卸载残留监听。
import { readonly, ref } from "vue"

interface DayDragSelectDeps {
  /** 按下：以该日为区间锚点 */
  onStart: (date: string) => void
  /** 拖到另一日：把区间另一端移到该日 */
  onExtend: (date: string) => void
}

export function useDayDragSelect(deps: DayDragSelectDeps) {
  /** 正在拖拽（用于抑制 tooltip 跟随，否则浮层会盖住掠过的格子） */
  const dragging = ref(false)
  /** 本次按下后是否真的移动过（区分「单击」与「拖拽」） */
  const moved = ref(false)
  /**
   * 拖拽结束后浏览器仍会补发一次 click（按下与松开落在同一格时）。
   * 它是一个宏任务之后才来的，故用 setTimeout(0) 在同一轮事件结束后清掉；
   * 期间到达的 click 一律丢弃——否则「拖回起点」会把刚选好的区间又取消掉。
   */
  const suppressClick = ref(false)

  function endDrag() {
    window.removeEventListener("mouseup", endDrag)
    if (!dragging.value) return
    dragging.value = false
    if (moved.value) {
      suppressClick.value = true
      setTimeout(() => { suppressClick.value = false }, 0)
    }
    moved.value = false
  }

  function onDown(date: string, e: MouseEvent) {
    // 只响应主键：右键菜单/中键滚动不该改变选区
    if (!date || e.button !== 0) return
    dragging.value = true
    moved.value = false
    window.addEventListener("mouseup", endDrag)
    deps.onStart(date)
  }

  function onEnter(date: string) {
    if (!dragging.value || !date) return
    moved.value = true
    deps.onExtend(date)
  }

  return {
    dragging: readonly(dragging),
    suppressClick: readonly(suppressClick),
    onDown,
    onEnter,
  }
}
