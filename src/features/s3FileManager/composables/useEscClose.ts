/**
 * S3 文件管理器弹层 Esc 关闭 composable
 *
 * 挂载时注册 window keydown 监听、卸载时清理；按下 Esc 执行关闭回调。
 * 各弹窗/右键菜单统一接入，保证键盘可关闭的一致体验。
 * isActive 供常驻挂载的弹层（如右键菜单）按可见性守卫，避免隐藏时误响应。
 */
import { onMounted, onUnmounted } from "vue"

export function useEscClose(onClose: () => void, isActive?: () => boolean): void {
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key !== "Escape") { return }
    if (isActive && !isActive()) { return }
    onClose()
  }

  onMounted(() => window.addEventListener("keydown", handleKeydown))
  onUnmounted(() => window.removeEventListener("keydown", handleKeydown))
}
