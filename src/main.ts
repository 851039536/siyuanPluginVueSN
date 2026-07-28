/**
 * Vue 全局应用入口：绑定 plugin 单例、应用紧凑模式、挂载/卸载 App.vue 根容器
 */
import type PluginSample from "@/index"
import type { Plugin } from "siyuan"
import { createApp } from "vue"
import { applyCompactMode } from "@/features/compactMode"
import App from "./App.vue"
import "highlight.js/styles/github-dark.css"

let plugin: Plugin | null = null
export function usePlugin(pluginProps?: Plugin): Plugin {
  if (pluginProps) {
    plugin = pluginProps
  }
  if (!plugin) {
    // fail-fast：绑定前调用直接抛错，避免下游拿到 null 引发远处的空指针
    throw new Error("[main] usePlugin 在 init() 绑定 plugin 之前被调用")
  }
  return plugin
}

let app: ReturnType<typeof createApp> | null = null
let container: HTMLElement | null = null

export function init(pluginInstance: Plugin) {
  // bind plugin hook
  usePlugin(pluginInstance)

  // 初始化时应用紧凑模式（settings 已在 onload 合并 DEFAULT_SETTINGS，无需兜底默认值）
  applyCompactMode((pluginInstance as PluginSample).settings)

  container = document.createElement("div")
  container.classList.add("siyuan-plugin-vite-vue-sn-app")
  container.id = pluginInstance.name
  app = createApp(App)
  app.mount(container)

  document.body.appendChild(container)
}

export function destroy() {
  app?.unmount()
  app = null
  container?.remove()
  container = null
  plugin = null
}
