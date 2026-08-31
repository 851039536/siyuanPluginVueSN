/**
 * 提示词库功能入口
 * Modal 惰性创建于 showPromptsModal（App.vue 事件调度入口），
 * 创建时自挂载 __promptsModal（persistent Modal 常驻），供插件 onunload 经 DESTROYABLE_KEYS 统一销毁
 */
import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import PromptsModal from "./index.vue"

let modal: ModalAppInstance | null = null

/**
 * 打开提示词库弹窗（公开 API，供 App.vue 事件调度调用）
 */
export function showPromptsModal(plugin: Plugin): void {
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
    // 实例自挂载：Modal 关闭后 Vue 实例常驻（display:none），卸载时须随 DESTROYABLE_KEYS 销毁
    ;(plugin as any).__promptsModal = {
      destroy: () => {
        modal?.destroy()
        modal = null
      },
    }
  }
  modal.open()
}

/**
 * 注册提示词库功能（事件监听器在 App.vue 中通过 showPromptsModal 调度）
 */
export function registerPrompts(_plugin: Plugin): void {
  // 功能初始化：Modal 惰性创建（参见 showPromptsModal），无其他持久化资源
}
