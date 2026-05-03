/**
 * 统一的自定义事件触发工具
 *
 * 替代各处分散的 window/document.dispatchEvent(new CustomEvent(...)) 写法，
 * 提供类型安全的 detail 传参和一致的错误处理。
 *
 * @example
 * // 无 detail
 * emitCustomEvent("toggleSuperPanel")
 * // 带 detail
 * emitCustomEvent("dock-click", { dockId: "statistics-dock" })
 * // 在 document 上派发
 * emitCustomEvent("codeblock-collapse-cleanup", undefined, { target: document })
 * // 使用微任务（当前执行栈完成后派发）
 * emitCustomEvent("openDialog", { content }, { useMicrotask: true })
 */
export function emitCustomEvent<T = any>(
  eventName: string,
  detail?: T,
  options?: {
    bubbles?: boolean;
    cancelable?: boolean;
    target?: EventTarget;
    useMicrotask?: boolean;
  },
): void {
  const { bubbles = true, cancelable = true, target = window, useMicrotask = false } = options || {};

  const dispatch = () => {
    try {
      const event = new CustomEvent(eventName, { detail, bubbles, cancelable });
      target.dispatchEvent(event);
    } catch (error) {
      console.error(`发送事件失败 [${eventName}]:`, error);
    }
  };

  if (useMicrotask) {
    Promise.resolve().then(dispatch);
  } else {
    dispatch();
  }
}
