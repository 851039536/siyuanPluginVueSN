import type { Plugin } from "siyuan"
/**
 * Vue 应用辅助工具
 *
 * 封装重复的 Vue 应用创建模式，包括：
 * - Dock 侧边栏面板挂载
 * - Modal 遮罩弹窗挂载
 */
import type {
  Component,
  App as VueApp,
} from "vue"
import {
  createApp,
  h,
} from "vue"

// ============================================================
// Dock 侧边栏面板
// ============================================================

/** Dock 配置选项 */
export interface DockAppOptions {
  /** 侧边栏位置 */
  position?: "RightTop" | "RightBottom" | "LeftTop" | "LeftBottom"
  /** 宽度 */
  width?: number
  /** 图标名称 */
  icon: string
  /** 标题 */
  title: string
  /** Dock 类型标识 */
  type: string
  /** 传递给组件的 i18n 对象 */
  i18n?: Record<string, any>
  /** 额外传递给组件的 props */
  extraProps?: Record<string, any>
}

/**
 * 创建并注册一个基于 Vue 组件的 Dock 侧边栏面板
 *
 * 消除 resourceManager / rssReader / wordQuery / unitConverter / statistics / imageCompressor
 * 中重复的 container + createApp + mount + appendChild 模式。
 */
export function createVueDockApp(
  plugin: Plugin,
  component: Component,
  options: DockAppOptions,
): void {
  const {
    position = "RightTop",
    width = 380,
    icon,
    title,
    type,
    i18n = {},
    extraProps = {},
  } = options

  plugin.addDock({
    config: {
      position,
      size: {
        width,
        height: 0,
      },
      icon,
      title,
      show: false,
    },
    data: {},
    type,
    init: (dock: any) => {
      const container = document.createElement("div")
      container.style.height = "100%"
      container.style.overflow = "hidden"

      const app = createApp({
        setup() {
          return () => h(component as any, {
            i18n,
            plugin,
            ...extraProps,
          })
        },
      })

      app.mount(container)
      dock.element?.appendChild(container)

      // 保存引用以便后续清理
      dock.__app = app
      dock.__container = container
    },
  })
}

// ============================================================
// Modal 遮罩弹窗
// ============================================================

/** Modal 弹窗配置选项 */
export interface ModalAppOptions {
  /** 遮罩层 DOM ID（用于清理时查找） */
  maskId: string
  /** 弹窗宽度 */
  width?: string
  /** 弹窗高度 */
  height?: string
  /** 传递给组件的 props */
  props?: Record<string, any>
  /**
   * 持久模式：关闭时仅隐藏 DOM，不销毁 Vue 实例。
   * 适用于需要保留组件内部状态（如进行中的任务、表单内容）的场景。
   * 默认 false（关闭即销毁）。
   */
  persistent?: boolean
}

/** Modal 弹窗实例（用于外部控制开关闭） */
export interface ModalAppInstance {
  app: VueApp | null
  container: HTMLElement | null
  /** 当前是否可见（仅 persistent 模式有意义） */
  visible: boolean
  open: () => void
  close: () => void
  /** 彻底销毁（persistent 模式下用于插件卸载时清理） */
  destroy: () => void
}

/**
 * 创建一个基于 Vue 组件的遮罩弹窗
 *
 * 消除 formatAssistant / textDiff 中重复的 mask + container + createApp 模式。
 * 返回 ModalAppInstance 以便外部控制开关闭。
 */
export function createModalVueApp(
  component: Component,
  options: ModalAppOptions & {
    /** 关闭回调（由调用方传入 close 方法引用） */
    getCloseHandler: () => () => void
    /** Vue 组件 props 构建函数 */
    buildProps: () => Record<string, any>
  },
): ModalAppInstance {
  const {
    maskId,
    width = "90vw",
    height = "85vh",
    persistent = false,
  } = options

  let app: VueApp | null = null
  let container: HTMLElement | null = null
  let mask: HTMLElement | null = null
  let _visible = false

  // 彻底销毁：unmount Vue + 移除 DOM
  const destroy = () => {
    if (app) {
      app.unmount()
      app = null
    }
    if (mask) {
      mask.remove()
      mask = null
    }
    container = null
    _visible = false
  }

  const close = () => {
    if (persistent && mask) {
      // 持久模式：仅隐藏，保留 Vue 实例
      mask.style.display = "none"
      _visible = false
    } else {
      // 默认模式：彻底销毁
      destroy()
    }
  }

  const open = () => {
    if (persistent && mask) {
      // 持久模式：已存在则仅显示
      mask.style.display = "flex"
      _visible = true
      return
    }

    // 如果已打开则先关闭（非持久模式会销毁重建）
    if (app && container) {
      close()
    }

    // 创建遮罩层
    mask = document.createElement("div")
    mask.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `
    mask.id = maskId

    // 创建容器
    container = document.createElement("div")
    container.style.cssText = `
      width: ${width};
      height: ${height};
      background: var(--b3-theme-background);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    `

    mask.appendChild(container)
    document.body.appendChild(mask)

    // 点击遮罩层关闭
    mask.onclick = (e) => {
      if (e.target === mask) {
        options.getCloseHandler()()
      }
    }

    // 创建 Vue 应用
    app = createApp({
      setup: () => {
        return () => h(component as any, options.buildProps())
      },
    })

    app.mount(container)
    _visible = true
  }

  return {
    get app() { return app },
    get container() { return container },
    get visible() { return _visible },
    open,
    close,
    destroy,
  }
}
