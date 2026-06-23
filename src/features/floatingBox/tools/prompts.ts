import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import Prompts from "../components/PromptsModal.vue"

let modal: ModalAppInstance | null = null

function showPromptsModal(plugin: Plugin) {
  if (!modal) {
    const skills = (plugin.i18n as any)?.skills || {}
    modal = createModalVueApp(Prompts, {
      maskId: "prompts-modal-mask",
      width: "80vw",
      height: "80vh",
      getCloseHandler: () => () => modal?.close(),
      buildProps: () => ({
        i18n: skills.modal || {},
        plugin,
        onClose: () => modal?.close(),
      }),
    })
  }
  modal.open()
}

export function createPromptsTool(plugin: Plugin): FloatingTool {
  const skills = (plugin.i18n as any)?.skills || {}
  return {
    id: "skills",
    label: skills.label || "Prompts",
    title: skills.title || "提示词库",
    icon: "mdi:star",
    bgColor: "#667eea",
    action: () => showPromptsModal(plugin),
  }
}
