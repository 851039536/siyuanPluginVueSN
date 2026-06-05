import type { Ref } from "vue"

import {
  onBeforeUnmount,
  watch,
} from "vue"

/**
 * 点击目标元素外部时关闭（适用于 popover / dropdown）
 *
 * @param triggerRef - 触发元素的 ref
 * @param isOpen - 控制显隐的 ref
 */
export function useClickOutside(
  triggerRef: Ref<HTMLElement | null>,
  isOpen: Ref<boolean>,
): void {
  let handler: ((e: MouseEvent) => void) | null = null

  watch(isOpen, (open) => {
    if (handler) {
      document.removeEventListener("click", handler, true)
      handler = null
    }
    if (open) {
      handler = (e: MouseEvent) => {
        if (triggerRef.value && !triggerRef.value.contains(e.target as Node)) {
          isOpen.value = false
        }
      }
      document.addEventListener("click", handler, true)
    }
  })

  onBeforeUnmount(() => {
    if (handler) {
      document.removeEventListener("click", handler, true)
      handler = null
    }
  })
}
