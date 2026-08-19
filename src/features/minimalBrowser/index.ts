/**
 * 极简浏览器 — 功能注册入口 + 公开 API
 */
import type { Plugin } from "siyuan"
import { BrowserManager } from "./types"

export { showMinimalBrowser } from "./types"

/** 注册函数：实例挂载到 plugin 上供卸载清理（含 addTab 模型、独立窗口管理与全局事件监听） */
export function registerMinimalBrowser(plugin: Plugin) {
  const instance = new BrowserManager(plugin)
  ;(plugin as any).__minimalBrowser = instance

  // 注册快捷键命令（⌃⌥B：Mac 为 Ctrl+Alt+B，Windows 自动转换）
  plugin.addCommand({
    langKey: "openMinimalBrowser",
    hotkey: "⌃⌥B",
    callback: () => {
      void instance.open()
    },
  })

  // 注册自定义图标（openTab custom.icon 引用）
  plugin.addIcons(`<symbol id="iconEarth" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></symbol>`)
}
