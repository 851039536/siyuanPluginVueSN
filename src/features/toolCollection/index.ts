/**
 * 工具合集功能模块
 *
 * 底部面板集成多种实用小工具，通过 Tab 标签页切换。
 * 支持双形态承载：底部面板（document.body 挂载）+ 独立窗口（addTab + openWindow 官方 API）。
 * 遵循跨功能通信规则：通过 App.vue 中枢调度 + emitCustomEvent 事件总线
 */
import type { Plugin } from "siyuan"
import type { App } from "vue"
import {
  createApp,
  ref,
} from "vue"
import ToolCollectionPanel from "./index.vue"
import { ToolCollectionManager } from "./types"
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

  // 注册自定义图标（openTab custom.icon 引用）
  plugin.addIcons(`<symbol id="iconToolCollection" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></symbol>`)

  // 独立页签/浮动窗口管理器（addTab + openWindow 官方 API）
  const manager = new ToolCollectionManager(plugin)

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
  // 全局基准字号类：index.scss 中 .vp-dock-root 统一设为 $font-size-xs(12px)
  container.classList.add("vp-dock-root")
  document.body.appendChild(container)

  app = createApp(ToolCollectionPanel, {
    plugin,
    visible: toolCollectionVisible,
  })
  app.mount(container)

  // 挂载到 plugin 实例，供面板「在独立窗口打开」按钮与 onunload 统一销毁
  ;(plugin as any).__toolCollection = {
    openFloating: () => void manager.openFloating(),
    destroy: () => {
      manager.destroy()
      unregisterToolCollection()
    },
  }
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
