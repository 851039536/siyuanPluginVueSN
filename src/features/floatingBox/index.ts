import type { App as VueApp } from "vue"
/**
 * 悬浮框功能模块
 * 在 layout__center 区域右侧居中显示一个可展开的悬浮框
 */
import { Plugin } from "siyuan"
import { createApp } from "vue"
import FloatingBox from "./index.vue"

export type {
  FloatingBoxOptions,
  FloatingTool,
  Prompt,
  PromptCategory,
} from "./types"

let vueApp: VueApp | null = null
let container: HTMLElement | null = null

export function registerFloatingBox(plugin: Plugin): void {
  container = document.createElement("div")
  container.id = "floating-box-container"

  const selectors = [
    ".layout__center.fn__flex.fn__flex-1",
    ".layout__center",
    "#workspace",
    "body",
  ]

  let inserted = false

  for (const selector of selectors) {
    const target = document.querySelector(selector)
    if (target) {
      target.appendChild(container)
      inserted = true
      break
    }
  }

  if (!inserted) {
    console.error("未能找到合适的容器插入悬浮框")
  }

  vueApp = createApp(FloatingBox, {
    i18n: (plugin.i18n as any).floatingBox || {},
    plugin,
  })

  try {
    vueApp.mount(container)
  } catch (error) {
    console.error("悬浮框挂载失败:", error)
  }

  ;(plugin as any).__floatingBox = {
    destroy: () => {
      if (vueApp && container) {
        vueApp.unmount()
        container.remove()
        vueApp = null
        container = null
      }
    },
  }
}
