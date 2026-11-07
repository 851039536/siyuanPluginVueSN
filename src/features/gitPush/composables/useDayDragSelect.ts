// gitPush 热力图「拖过一片日格选区间」状态机。
// 独立成 composable，避免「拖拽收尾 click 抑制」这个易错点散落在组件里。
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
  /**
   * 按下起点（拖到另一格时才正式起锚）。
   * 不在 mousedown 立即起锚：父级选中后，浏览器补发的 click 会把同一格判为
   * 「再次点击」而取消——表现为点击日期完全没有反应。单击交给 click 处理，
   * 只有真正拖到别的格子才由 onStart 起锚。
   */
  let startDate = ""

  function endDrag() {
    window.removeEventListener("mouseup", endDrag)
    if (!dragging.value) return
    dragging.value = false
    if (moved.value) {
      suppressClick.value = true
      setTimeout(() => { suppressClick.value = false }, 0)
    }
    moved.value = false
    startDate = ""
  }

  function onDown(date: string, e: MouseEvent) {
    // 只响应主键：右键菜单/中键滚动不该改变选区
    if (!date || e.button !== 0) return
    dragging.value = true
    moved.value = false
    startDate = date
    window.addEventListener("mouseup", endDrag)
  }

  function onEnter(date: string) {
    if (!dragging.value || !date) return
    if (!moved.value) {
      // 首次跨到别的格子：此刻才真正起锚（纯单击不会走到这里）
      moved.value = true
      if (startDate) deps.onStart(startDate)
    }
    deps.onExtend(date)
  }

  return {
    dragging: readonly(dragging),
    suppressClick: readonly(suppressClick),
    onDown,
    onEnter,
  }
}
