/**
 * 状态栏功能模块
 *
 * 挂载状态栏 Vue 面板；实例自挂载到 `(plugin as any).__statusBar` 并暴露 `destroy()`，
 * 由 `src/index.ts` 的 DESTROYABLE_KEYS 统一销毁（禁止 onunload 特例分支）。
 */
import type { Plugin } from "siyuan"
import type { App } from "vue"
import { createApp } from "vue"
import StatusBarPanel from "./index.vue"
import "./styles/index.scss"

/**
 * 状态栏实例：持有 Vue app 与状态栏 DOM，负责注销清理
 */
export class StatusBar {
  private app: App | null = null
  private statusBarElement: HTMLElement | null = null

  constructor(private plugin: Plugin) {}

  /** 挂载面板到思源状态栏（container 补 vp-dock-root 基准字号类） */
  mount(): void {
    if (this.app) { return }

    const container = document.createElement("div")
    // 全局基准字号类：index.scss 中 .vp-dock-root 统一设为 $font-size-xs(12px)
    container.classList.add("vp-dock-root")
    this.app = createApp(StatusBarPanel, { plugin: this.plugin })
    this.app.mount(container)

    // 思源官方 API：把组件根节点挂到状态栏右侧
    this.statusBarElement = this.plugin.addStatusBar({
      element: container.firstElementChild as HTMLElement,
      position: "right",
    })
  }

  destroy(): void {
    if (this.statusBarElement) {
      this.statusBarElement.remove()
      this.statusBarElement = null
    }
    if (this.app) {
      this.app.unmount()
      this.app = null
    }
  }
}

/**
 * 注册状态栏功能（实例在函数内部自挂载，供 onunload 统一销毁）
 */
export function registerStatusBar(plugin: Plugin): void {
  // 重复注册防护：先销毁旧实例，避免 DOM 与 Vue app 泄漏
  ;((plugin as unknown as { __statusBar?: StatusBar }).__statusBar)?.destroy()
  const instance = new StatusBar(plugin)
  ;(plugin as unknown as { __statusBar?: StatusBar }).__statusBar = instance
  instance.mount()
}
