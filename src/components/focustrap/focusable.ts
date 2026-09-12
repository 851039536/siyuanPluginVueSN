// FocusTrap 的纯函数工具：可聚焦元素查询 + Tab 回绕的边界判定
// （FocusTrap.vue 的私有模块，禁止 feature 直接导入）
// 沿用 confirm/position.ts 的「计算外置、组件只做编排」先例。

/**
 * 可聚焦元素选择器（对齐浏览器 Tab 序列的实际候选集）。
 * ⚠️ 刻意不包含 `[tabindex="-1"]`：那是「可编程聚焦但不可 Tab 到达」的元素，
 *    把它算进回绕边界会让 Tab 停在一个用户按 Tab 键永远到不了的节点上。
 * ⚠️ 也刻意不排除 `disabled` —— 改用下方的 `isFocusable` 逐个校验（属性选择器无法可靠表达
 *    「自身或祖先 disabled」这层关系，尤其对 fieldset 内的控件）。
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

/** 元素是否真实可聚焦：排除禁用、`hidden`、以及不可见的元素 */
function isFocusable(element: HTMLElement): boolean {
  if (element.hasAttribute("disabled")) return false
  // `inert` 子树整体退出无障碍树与 Tab 序列
  if (element.closest("[inert]")) return false
  // 不可见元素（display: none / visibility: hidden / 零尺寸）Tab 不会停留
  // ⚠️ offsetParent 为 null 对 position: fixed 元素同样成立，故用 getClientRects 兜底
  if (element.getClientRects().length === 0) return false
  return true
}

/**
 * 收集容器内的可聚焦元素（文档顺序 = Tab 顺序）。
 * 说明：这里用 DOM 顺序而非真实的 Tab 顺序（`tabindex` 正值会改变顺序）。
 * 库内组件一律不使用正 `tabindex`（全库统一 0 / -1），故两者等价；
 * 若调用方在插槽内塞了正 tabindex，回绕边界可能与视觉顺序略有出入（可接受的有意简化）。
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  return candidates.filter(isFocusable)
}

/** 容器是否对焦点完全「封闭」（无任何可聚焦后代）—— 此时焦点只能留在容器自身 */
export function hasFocusableElement(container: HTMLElement): boolean {
  return getFocusableElements(container).length > 0
}

/**
 * 根据当前聚焦元素与 Tab 方向，算出应当回绕到的目标。
 * - 正向 Tab 在末位 → 回到首位
 * - 逆向 Shift+Tab 在首位 → 跳到末位
 * - 焦点不在容器内（或落在容器自身）→ 正向到首位、逆向到末位
 * 返回 `null` 表示无需干预（浏览器默认行为已正确）。
 */
export function resolveWrapTarget(
  container: HTMLElement,
  current: HTMLElement | null,
  shiftKey: boolean,
): HTMLElement | null {
  const focusables = getFocusableElements(container)
  if (focusables.length === 0) return null

  const first = focusables[0]
  const last = focusables[focusables.length - 1]

  // 焦点不在容器内（含落在容器自身）：拉回边界
  if (!current || current === container || !container.contains(current)) {
    return shiftKey ? last : first
  }

  if (shiftKey && current === first) return last
  if (!shiftKey && current === last) return first
  return null
}
