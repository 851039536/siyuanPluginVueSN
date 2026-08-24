/**
 * 灵感生成器 — 功能注册入口 + 公开 API
 * 自挂载 __ideaGenerator 实例、注册快捷键命令与自定义 Tab 图标
 */
import type { Plugin } from "siyuan"
import { IdeaGeneratorManager } from "./types"

export { showIdeaGenerator } from "./types"

/** 注册函数：实例挂载到 plugin 上供卸载清理（含 addTab 模型、独立窗口管理与全局事件监听） */
export function registerIdeaGenerator(plugin: Plugin) {
  const instance = new IdeaGeneratorManager(plugin)
  ;(plugin as any).__ideaGenerator = instance

  // 注册快捷键命令（⌃⌥I：Mac 为 Ctrl+Alt+I，Windows 自动转换）
  plugin.addCommand({
    langKey: "openIdeaGenerator",
    hotkey: "⌃⌥I",
    callback: () => {
      void instance.open()
    },
  })

  // 注册自定义图标（openTab custom.icon 引用）
  plugin.addIcons(`<symbol id="iconLightbulb" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z"/></symbol>`)
}
