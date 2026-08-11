/**
 * 速记功能模块 — 入口
 * QuickNoteManager 管理 persistent Modal 生命周期、弹窗位置（预设/拖拽自定义）与最小化应用，
 * registerQuickNote 供插件注册链调用，toggle 由 App.vue 中心调度触发
 */
import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import type { QuickNotePlacement, QuickNotePosition } from "./types"
import { injectStyle, removeStyle } from "@/utils/domUtils"
import { emitCustomEvent } from "@/utils/eventBus"
import { createModalVueApp } from "@/utils/vueAppHelper"
import { POSITION_ALIGN_MAP } from "./types"
import { DEFAULT_QUICK_NOTE_SETTINGS, QuickNoteStorage } from "./types/storage"
import QuickNotePanel from "./index.vue"

/** 贴边档位与屏幕边缘的间距 */
const EDGE_PADDING = "8px"
/** 弹窗展开态尺寸（构造 Modal 与最小化还原共用的单一数据源） */
const PANEL_WIDTH = "624px"
const PANEL_HEIGHT = "70vh"
/** 遮罩展开态背景（与 vueAppHelper 创建时的遮罩背景保持一致） */
const MASK_BACKGROUND = "rgba(0, 0, 0, 0.5)"
/** 拖拽启动位移阈值（px，小于此值视为点击，避免小条点击展开误触拖拽） */
const DRAG_THRESHOLD = 4
/** 最小化态动态样式的 style 标签 ID（injectStyle/removeStyle 配对） */
const MINIMIZED_STYLE_ID = "quick-note-minimized-style"
/** 最小化态半透明度（悬停恢复不透明，降低小条对背后界面的视觉干扰） */
const MINIMIZED_OPACITY = 0.5

export class QuickNoteManager {
  readonly storage: QuickNoteStorage
  private modal: ModalAppInstance
  /** 当前位置缓存（init 时预加载，避免 open 时异步等待） */
  private position: QuickNotePlacement = DEFAULT_QUICK_NOTE_SETTINGS.position
  /** 自定义定位坐标（拖拽产生，position === "custom" 时生效） */
  private customX = DEFAULT_QUICK_NOTE_SETTINGS.customX
  private customY = DEFAULT_QUICK_NOTE_SETTINGS.customY
  /** 最小化状态（持久化，重启/自动打开时恢复小条形态） */
  private minimized = DEFAULT_QUICK_NOTE_SETTINGS.minimized
  /** 刚完成一次拖拽（供小条 click 判断是否吞掉本次点击） */
  private dragMoved = false
  /** 当前拖拽会话的 window 监听清理函数（destroy 兜底） */
  private dragCleanup: (() => void) | null = null

  constructor(plugin: Plugin) {
    this.storage = new QuickNoteStorage(plugin)

    this.modal = createModalVueApp(QuickNotePanel, {
      maskId: "quick-note-mask",
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      // 点击遮罩（面板外区域）收起为最小化条而非关闭，关闭仅由头部关闭按钮/状态栏切换触发
      getCloseHandler: () => this.requestMinimize,
      persistent: true,
      buildProps: () => ({
        plugin,
        i18n: (plugin.i18n?.quickNote as unknown as Record<string, string>) || {},
        manager: this,
        onClose: this.close,
      }),
    })
  }

  /** 预加载位置与最小化设置到缓存（persistent Modal 无需预挂载） */
  async init(): Promise<void> {
    const settings = await this.storage.settings.loadOrDefault()
    this.position = settings.position
    this.customX = settings.customX
    this.customY = settings.customY
    this.minimized = settings.minimized
  }

  /** 切换弹窗显隐（状态栏按钮/功能抽屉入口） */
  toggle(): void {
    if (this.modal.visible) {
      this.close()
    } else {
      this.open()
    }
  }

  open(): void {
    // persistent 模式首次 open 才创建遮罩 DOM，位置/最小化必须在 open 之后应用（恢复持久化的小条形态）
    this.modal.open()
    this.applyPosition()
    this.applyMinimized()
  }

  close = (): void => {
    this.modal.close()
  }

  /**
   * 一键恢复兜底（状态栏恢复按钮调用）：弹窗被拖到异常位置（如顶部）导致
   * 无法点击/拖动时，重置为居中展开态——清除自定义坐标与绝对定位残留、
   * 退出最小化、持久化后重新应用，确保弹窗可见且可交互
   */
  async reset(): Promise<void> {
    this.position = DEFAULT_QUICK_NOTE_SETTINGS.position
    this.customX = DEFAULT_QUICK_NOTE_SETTINGS.customX
    this.customY = DEFAULT_QUICK_NOTE_SETTINGS.customY
    this.minimized = false
    // open() 内部依次 modal.open → applyPosition → applyMinimized，
    // 展开分支会还原遮罩交互并清除绝对定位残留，无需在此重复应用
    this.open()
    await this.persistSettings()
  }

  /**
   * 遮罩点击入口：请求收起为最小化条
   * 最小化条视图由面板组件渲染（v-if），故派发事件让面板同步切换并回调 setMinimized
   */
  private requestMinimize = (): void => {
    // 从头部起拖、松手落在遮罩上时 click 会派发到遮罩（共同祖先），不应误触收起
    if (this.minimized || this.dragMoved) return
    emitCustomEvent("quickNoteMaskMinimize")
  }

  /** 获取当前定位模式（供面板预设菜单高亮与最小化方向派生） */
  getPosition(): QuickNotePlacement {
    return this.position
  }

  /** 获取当前最小化状态（供面板初始化，persistent 下重开保持状态一致） */
  isMinimized(): boolean {
    return this.minimized
  }

  /**
   * 设置最小化状态（供面板最小化/展开按钮调用，持久化供重启恢复）
   * 收起：容器尺寸改为 auto（由面板最小化条的 CSS 决定收缩方向与尺寸），
   * 遮罩变透明且点击穿透，仅贴边小条可交互；展开：还原尺寸与遮罩
   */
  setMinimized(minimized: boolean): void {
    this.minimized = minimized
    this.applyMinimized()
    this.persistSettings().catch((err) => {
      console.error("[quickNote] 最小化状态保存失败:", err)
    })
  }

  /** 按当前最小化状态改写容器尺寸与遮罩交互（与 applyPosition 同样依赖遮罩 DOM 结构） */
  private applyMinimized(): void {
    const mask = document.getElementById("quick-note-mask")
    const container = this.modal.container
    if (!mask || !container) return
    if (this.minimized) {
      container.style.width = "auto"
      container.style.height = "auto"
      // 遮罩透明化 + 点击穿透，最小化期间不阻断背后界面操作
      mask.style.background = "transparent"
      mask.style.pointerEvents = "none"
      container.style.pointerEvents = "auto"
      // 小条外壳（容器 div）半透明，悬停恢复：:hover 无法用内联样式表达，经 injectStyle + 遮罩状态 class 实现
      mask.classList.add("quick-note-mask--minimized")
      injectStyle(MINIMIZED_STYLE_ID, `
        #quick-note-mask.quick-note-mask--minimized > div {
          opacity: ${MINIMIZED_OPACITY};
          transition: opacity 0.12s;
        }
        #quick-note-mask.quick-note-mask--minimized > div:hover {
          opacity: 1;
        }
      `)
    } else {
      container.style.width = PANEL_WIDTH
      container.style.height = PANEL_HEIGHT
      mask.style.background = MASK_BACKGROUND
      mask.style.pointerEvents = "auto"
      container.style.pointerEvents = ""
      mask.classList.remove("quick-note-mask--minimized")
      // 展开时按当前定位模式重新还原容器位置（清除拖拽绝对定位残留，避免与最小化小条坐标冲突）
      this.applyPosition()
    }
  }

  /** 设置预设位置：退出自定义定位 + 更新缓存 + 持久化 + 立即应用（供面板预设菜单调用） */
  async setPosition(position: QuickNotePosition): Promise<void> {
    this.position = position
    this.applyPosition()
    await this.persistSettings()
  }

  /**
   * 拖拽启动入口（展开态头部与最小化小条的 pointerdown 调用）
   * 位移超过 DRAG_THRESHOLD 才切换为 custom 绝对定位并跟随移动，
   * 松手后若确实发生拖动则持久化坐标，并置 dragMoved 供 click 护栏读取
   */
  startDrag(e: PointerEvent): void {
    const container = this.modal.container
    if (!container) return
    // 拖拽把手内的其它按钮（最小化/关闭/预设菜单）不触发拖拽；小条自身是 button，不在此限
    const targetButton = (e.target as HTMLElement).closest("button")
    if (targetButton && targetButton !== e.currentTarget) return
    // 阻止拖拽过程中选中面板文本
    e.preventDefault()

    const rect = container.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false

    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!dragging && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
      if (!dragging) {
        dragging = true
        // 起拖即切换为绝对定位（脱离遮罩 flex 流，保持当前视觉位置）
        container.style.position = "absolute"
      }
      const clamped = this.clampToViewport(rect.left + dx, rect.top + dy, rect.width, rect.height)
      container.style.left = `${clamped.x}px`
      container.style.top = `${clamped.y}px`
      this.customX = clamped.x
      this.customY = clamped.y
    }

    const onUp = (): void => {
      this.dragCleanup?.()
      if (!dragging) return
      this.position = "custom"
      this.dragMoved = true
      // click 事件在 pointerup 后同步派发，延时复位避免标记残留吞掉后续正常点击
      setTimeout(() => {
        this.dragMoved = false
      }, 0)
      this.persistSettings().catch((err) => {
        console.error("[quickNote] 拖拽位置保存失败:", err)
      })
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    this.dragCleanup = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      this.dragCleanup = null
    }
  }

  /** 小条 click 护栏：刚完成拖拽则返回 true（本次点击应被吞掉，不触发展开） */
  consumeDragClick(): boolean {
    const moved = this.dragMoved
    this.dragMoved = false
    return moved
  }

  /** 坐标 clamp 到视口内（防止面板被拖出屏幕无法找回） */
  private clampToViewport(x: number, y: number, width: number, height: number): { x: number, y: number } {
    return {
      x: Math.min(Math.max(x, 0), Math.max(window.innerWidth - width, 0)),
      y: Math.min(Math.max(y, 0), Math.max(window.innerHeight - height, 0)),
    }
  }

  /** 持久化当前设置（定位 + 最小化状态全量写入） */
  private async persistSettings(): Promise<void> {
    await this.storage.settings.save({
      position: this.position,
      customX: this.customX,
      customY: this.customY,
      minimized: this.minimized,
    })
  }

  /**
   * 按当前定位模式应用位置
   * 预设档：清除绝对定位内联样式，改写遮罩 flex 对齐实现贴边/居中；
   * custom：容器绝对定位到 clamp 后的自定义坐标（绝对定位脱离 flex 流，对齐属性无影响）。
   * 注意：依赖 vueAppHelper createModalVueApp 的遮罩 DOM 结构，helper 重构时需同步调整此处
   */
  private applyPosition(): void {
    const mask = document.getElementById("quick-note-mask")
    const container = this.modal.container
    if (!mask || !container) return
    if (this.position === "custom") {
      const rect = container.getBoundingClientRect()
      const clamped = this.clampToViewport(this.customX, this.customY, rect.width, rect.height)
      container.style.position = "absolute"
      container.style.left = `${clamped.x}px`
      container.style.top = `${clamped.y}px`
      return
    }
    // 退出自定义定位：清除拖拽产生的绝对定位内联样式，回归 flex 对齐
    container.style.position = ""
    container.style.left = ""
    container.style.top = ""
    const align = POSITION_ALIGN_MAP[this.position]
    mask.style.alignItems = align.alignItems
    mask.style.justifyContent = align.justifyContent
    // 贴边档位留出与屏幕边缘的间距，居中无需
    mask.style.padding = this.position === "center" ? "0" : EDGE_PADDING
  }

  /** 彻底销毁（persistent Modal 必须 destroy 而非 close，否则残留 DOM） */
  destroy(): void {
    // 兜底清理拖拽会话未释放的 window 监听与最小化动态样式
    this.dragCleanup?.()
    removeStyle(MINIMIZED_STYLE_ID)
    this.modal.destroy()
  }
}

/**
 * 注册速记功能
 */
export function registerQuickNote(plugin: Plugin): QuickNoteManager {
  const manager = new QuickNoteManager(plugin)
  manager.init().then(() => {
    // 超级面板子开关「启动时自动打开」：init 完成后再 open，保证持久化位置缓存已加载
    if ((plugin as any).settings?.enableQuickNoteAutoOpen) {
      manager.open()
    }
  }).catch((err) => {
    console.error("[quickNote] 初始化失败:", err)
  })
  // 挂载到 plugin 实例：onunload 经 DESTROYABLE_KEYS 销毁，App.vue 经 __quickNote.toggle() 调度
  ;(plugin as any).__quickNote = manager
  return manager
}
