/**
 * 提示词库功能入口
 * Modal 惰性创建于 showPromptsModal（App.vue 事件调度入口）。
 * 创建时自挂载 __promptsModal（实例对象常驻，Vue app 随弹窗关闭而销毁），
 * 供插件 onunload 经 DESTROYABLE_KEYS 统一销毁。
 */
import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import type { PromptsI18n } from "./types"
import { createModalVueApp } from "@/utils/vueAppHelper"
import PromptsModal from "./index.vue"
import {
  PROMPTS_MODAL_SIZE,
} from "./types"
import { PromptsStorage } from "./types/storage"

let modal: ModalAppInstance | null = null

/**
 * 打开提示词库弹窗（公开 API，供 App.vue 事件调度调用）
 *
 * 打开前显式执行一次 marker 守卫的迁移（AGENTS.md：迁移不得塞进组件初始化路径），
 * await 保证迁移完成后子组件才纯加载数据，避免读到迁移前的旧格式。
 */
export async function showPromptsModal(plugin: Plugin): Promise<void> {
  // 一次性迁移：失败仅告警、不阻断面板打开（下次打开会重试，marker 未落）
  try {
    await new PromptsStorage(plugin).migrateOnce()
  } catch (error) {
    console.warn("[prompts] 数据迁移未完全完成:", error)
  }

  if (!modal) {
    const i18nRaw = (plugin.i18n as Record<string, unknown> | undefined)?.prompts as
      | { modal?: Partial<PromptsI18n> }
      | undefined
    const modalI18n = (i18nRaw?.modal || {}) as Record<string, string>
    modal = createModalVueApp(PromptsModal, {
      maskId: "prompts-modal-mask",
      width: PROMPTS_MODAL_SIZE.width,
      height: PROMPTS_MODAL_SIZE.height,
      getCloseHandler: () => () => modal?.close(),
      buildProps: () => ({
        i18n: modalI18n,
        plugin,
        onClose: () => modal?.close(),
      }),
    })
    // 实例自挂载：实例对象供 DESTROYABLE_KEYS 在 onunload 时统一销毁
    // （Vue app 本身在弹窗关闭时由 vueAppHelper 销毁，非 persistent 常驻）
    ;(plugin as any).__promptsModal = {
      destroy: () => {
        modal?.destroy()
        modal = null
      },
    }
  }
  modal.open()
}
