import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import PromptsModal from "./index.vue"

let modal: ModalAppInstance | null = null

/**
 * 打开提示词库弹窗（公开 API，供 App.vue 事件调度调用）
 */
export function showPromptsModal(plugin: Plugin) {
  if (!modal) {
    const prompts = (plugin.i18n as any)?.prompts || {}
    modal = createModalVueApp(PromptsModal, {
      maskId: "prompts-modal-mask",
      width: "80vw",
      height: "80vh",
      getCloseHandler: () => () => modal?.close(),
      buildProps: () => ({
        i18n: prompts.modal || {},
        plugin,
        onClose: () => modal?.close(),
      }),
    })
  }
  modal.open()
}

/**
 * 注册提示词库功能（事件监听器在 App.vue 中通过 showPromptsModal 调度）
 */
export function registerPrompts(_plugin: Plugin) {
  // 功能初始化：无持久化定时器/Modal 需要在此创建
  // 实际 Modal 在用户触发时惰性创建（参见 showPromptsModal）
}
