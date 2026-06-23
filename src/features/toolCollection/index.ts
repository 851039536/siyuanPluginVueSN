/**
 * 工具合集功能模块
 * 
 * 底部面板集成多种实用小工具，通过 Tab 标签页切换
 * 遵循跨功能通信规则：通过 App.vue 中枢调度 + emitCustomEvent 事件总线
 */
import type { Plugin } from "siyuan"
import type { App } from "vue"
import { createApp, ref } from "vue"
import ToolCollectionPanel from "./index.vue"
import "./styles/index.scss"

// ============================================================
// 公开 API（供 App.vue 中枢调度调用）
// ============================================================

/** 面板可见状态（模块级 ref，被 App.vue 的 toggleToolCollection 操控） */
export const toolCollectionVisible = ref(false)

/** 切换面板显隐 */
export function toggleToolCollection() {
  toolCollectionVisible.value = !toolCollectionVisible.value
}

/** 关闭面板 */
export function closeToolCollection() {
  toolCollectionVisible.value = false
}

// ============================================================
// 注册函数
// ============================================================

let app: App | null = null
let container: HTMLElement | null = null

/**
 * 注册工具合集功能
 * 
 * 将面板挂载到 document.body，通过模块级 ref 控制显隐。
 * 卸载时清理 app 实例和 DOM 元素。
 */
export function registerToolCollection(plugin: Plugin) {
  if (app) return // 避免重复注册

  // 注册快捷键命令 Ctrl+T
  plugin.addCommand({
    langKey: "toggleToolCollection",
    langText: "工具合集",
    hotkey: "⌃⌥T",
    callback: () => {
      toggleToolCollection()
    },
  })

  container = document.createElement("div")
  container.id = "tool-collection-root"
  document.body.appendChild(container)

  app = createApp(ToolCollectionPanel, {
    plugin,
    visible: toolCollectionVisible,
  })
  app.mount(container)

  // 保存引用供 onunload 清理
  ;(plugin as any).__toolCollection = { app, container }
}

/**
 * 注销工具合集功能（插件卸载时调用）
 */
export function unregisterToolCollection() {
  if (app) {
    app.unmount()
    app = null
  }
  if (container) {
    container.remove()
    container = null
  }
  toolCollectionVisible.value = false
}
