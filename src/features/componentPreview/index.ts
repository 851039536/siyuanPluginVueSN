/**
 * 组件预览 — 功能注册入口 + 公开 API
 */
import type { Plugin } from "siyuan"
import { PreviewManager } from "./types"

export { showComponentPreview } from "./types"

/** 注册函数：实例挂载到 plugin 上供卸载清理（含 addTab 模型、独立窗口管理与全局事件监听） */
export function registerComponentPreview(plugin: Plugin) {
  const instance = new PreviewManager(plugin)
  ;(plugin as any).__componentPreview = instance

  // 注册命令（仅命令面板入口，不绑定默认快捷键：⌃⌥V 已由视频管理器占用）
  plugin.addCommand({
    langKey: "openComponentPreview",
    callback: () => {
      void instance.open()
    },
  })

  // 注册自定义图标（openTab custom.icon 引用）：网格窗口符号，象征组件画布
  plugin.addIcons(`<symbol id="iconComponentPreview" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></symbol>`)
}
