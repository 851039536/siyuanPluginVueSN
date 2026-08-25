// 下拉面板点击外部关闭 composable：持有根元素 ref，点击面板外区域自动关闭
import type { Ref } from "vue"
import {
  onMounted,
  onUnmounted,
  ref,
} from "vue"

/**
 * 点击目标元素外部时关闭面板
 * 内部创建根元素 ref 并注册常驻 document click 监听，组件卸载时自动移除
 * @param isOpen - 控制面板显隐的 ref
 * @returns rootRef - 绑定到面板根元素的 ref（模板中 ref="rootRef"）
 */
export function useClickOutside(isOpen: Ref<boolean>): Ref<HTMLElement | null> {
  const rootRef = ref<HTMLElement | null>(null)

  function handleDocumentClick(event: MouseEvent): void {
    if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
      isOpen.value = false
    }
  }

  onMounted(() => {
    document.addEventListener("click", handleDocumentClick)
  })

  onUnmounted(() => {
    document.removeEventListener("click", handleDocumentClick)
  })

  return rootRef
}
