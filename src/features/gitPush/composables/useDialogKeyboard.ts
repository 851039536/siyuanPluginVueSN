// gitPush 弹窗键盘辅助：打开时自动聚焦根节点，使 Esc 关闭 / Enter 确认可被捕获
import type { Ref } from "vue"
import { onMounted, ref, watch } from "vue"

/**
 * 返回一个绑定到弹窗根节点（gp-mask/gp-confirm-mask）的 ref。
 * 根节点需设置 tabindex="-1"，本 composable 在挂载或 visible 变为 true 时自动聚焦，
 * 从而让模板上的 @keydown.escape / @keydown.enter 能捕获键盘事件。
 * @param visible 可选：由 v-if 常驻的弹窗（如 ConfirmDialog）传入可见性 ref
 */
export function useDialogKeyboard(visible?: Ref<boolean>) {
  const rootRef = ref<HTMLElement | null>(null)

  function focusRoot() {
    requestAnimationFrame(() => rootRef.value?.focus())
  }

  onMounted(() => {
    if (!visible || visible.value) focusRoot()
  })

  if (visible) {
    watch(visible, (v) => {
      if (v) focusRoot()
    })
  }

  return { rootRef }
}
