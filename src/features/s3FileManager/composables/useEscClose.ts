/**
 * S3 文件管理器弹层 Esc 关闭 composable
 *
 * 按注册顺序形成 LIFO 栈：按下 Esc 只关闭最近打开且仍激活的弹层，
 * 卸载时自动出栈，避免多层弹窗（如右键菜单 + 配置弹窗）被一次 Esc 全部关闭。
 * 常驻挂载的弹层（右键菜单）通过 isActive 守卫，隐藏时不参与关闭。
 */
import { onMounted, onUnmounted } from "vue"

interface EscHandler {
  onClose: () => void
  isActive: () => boolean
}

const escStack: EscHandler[] = []
let keydownBound = false

function handleKeydown(e: KeyboardEvent): void {
  if (e.key !== "Escape") { return }
  for (let i = escStack.length - 1; i >= 0; i--) {
    const handler = escStack[i]
    if (handler.isActive()) {
      handler.onClose()
      return
    }
  }
}

export function useEscClose(onClose: () => void, isActive: () => boolean = () => true): void {
  const handler: EscHandler = { onClose, isActive }

  onMounted(() => {
    escStack.push(handler)
    if (!keydownBound) {
      window.addEventListener("keydown", handleKeydown)
      keydownBound = true
    }
  })

  onUnmounted(() => {
    const idx = escStack.indexOf(handler)
    if (idx >= 0) { escStack.splice(idx, 1) }
    if (escStack.length === 0 && keydownBound) {
      window.removeEventListener("keydown", handleKeydown)
      keydownBound = false
    }
  })
}
