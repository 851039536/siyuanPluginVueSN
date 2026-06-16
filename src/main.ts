import type PluginSample from "@/index"
import { Plugin } from "siyuan"
import { createApp } from "vue"
import App from "./App.vue"
import "highlight.js/styles/github-dark.css"
import { applyCompactMode } from "@/features/compactMode"

let plugin: Plugin | null = null
export function usePlugin(pluginProps?: Plugin): Plugin {
  if (pluginProps) {
    plugin = pluginProps
  }
  if (!plugin && !pluginProps) {
    console.error("need bind plugin")
  }
  return plugin as Plugin
}

let app: ReturnType<typeof createApp> | null = null
export function init(pluginInstance: Plugin) {
  // bind plugin hook
  usePlugin(pluginInstance)

  // 初始化时应用紧凑模式（含密度 + 字号 + 区域开关）
  const pluginSample = pluginInstance as PluginSample
  const s = pluginSample.settings
  applyCompactMode({
    compactMode: s?.compactMode ?? true,
    compactModeDensity: s?.compactModeDensity ?? 'compact',
    compactModeFontScale: s?.compactModeFontScale ?? 90,
    compactModeAreas: s?.compactModeAreas ?? { sidebar: true, editor: true, tabs: true, dialogs: true, controls: true },
  })

  const div = document.createElement("div")
  div.classList.toggle("siyuan-plugin-vite-vue-sn-app")
  div.id = pluginInstance.name
  app = createApp(App)
  app.mount(div)

  document.body.appendChild(div)
}

export function destroy() {
  app?.unmount()
  app = null
  const div = document.getElementById(plugin?.name ?? "")
  div?.remove()
}
