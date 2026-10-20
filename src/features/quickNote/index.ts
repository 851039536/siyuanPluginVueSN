/**
 * 速记功能模块 — 入口
 * QuickNoteManager 管理 persistent Modal 生命周期、弹窗位置/尺寸（预设/拖拽/右下角缩放）与最小化应用，
 * registerQuickNote 供插件注册链调用，toggle 由 App.vue 中心调度触发
 */
import type { Plugin } from "siyuan"
import type { PanelSize } from "./pureUtils"
import type { QuickNotePlacement, QuickNotePosition } from "./types"
import type { PointerSession } from "./pointerSession"
import type { TimerHandle } from "@/utils/timerRegistry"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { emitCustomEvent } from "@/utils/eventBus"
import { TimerRegistry } from "@/utils/timerRegistry"
import { createModalVueApp } from "@/utils/vueAppHelper"
import QuickNotePanel from "./index.vue"
import {
  EDGE_PADDING,
  MASK_ID,
  PANEL_DEFAULT_HEIGHT_CSS,
  PANEL_MIN_HEIGHT,
  PANEL_MIN_WIDTH,
  PANEL_TOGGLE_TRANSITION_MS,
  applyPanelLayout,
  beginPanelToggleAnimation,
  disposePanelLayout,
  endPanelToggleAnimation,
  getQuickNoteMask,
} from "./layout"
import { beginPointerSession } from "./pointerSession"
import { clampBetween, resolvePanelPoint } from "./pureUtils"
import {
  QUICK_NOTE_MASK_MINIMIZE_EVENT,
  QUICK_NOTE_POSITIONS,
  QUICK_NOTE_STATE_EVENT,
} from "./types"
import { DEFAULT_QUICK_NOTE_SETTINGS, QuickNoteStorage } from "./types/storage"

/** 拖拽/缩放启动位移阈值（px，小于此值视为点击） */
const INTERACTION_THRESHOLD = 4

export class QuickNoteManager {
  readonly storage: QuickNoteStorage
  private modal: ModalAppInstance
  /** 当前位置缓存（init 时预加载，避免 open 时异步等待） */
  private position: QuickNotePlacement = DEFAULT_QUICK_NOTE_SETTINGS.position
  /** 自定义定位坐标（拖拽产生，position === "custom" 时生效） */
  private customX = DEFAULT_QUICK_NOTE_SETTINGS.customX
  private customY = DEFAULT_QUICK_NOTE_SETTINGS.customY
  /** 最小化状态（持久化，重启/自动打开时恢复图标形态） */
  private minimized = DEFAULT_QUICK_NOTE_SETTINGS.minimized
  /** 面板宽度（px，右下角缩放后持久化） */
  private panelWidth = DEFAULT_QUICK_NOTE_SETTINGS.panelWidth
  /** 面板高度（px；0 = 未手动缩放，按视口比例计算） */
  private panelHeight = DEFAULT_QUICK_NOTE_SETTINGS.panelHeight
  /** 刚完成一次拖拽/缩放（供图标按钮 click 与遮罩点击护栏读取） */
  private interactionMoved = false
  /** 当前拖拽 / 缩放会话（destroy 与新会话抢占时清理） */
  private dragSession: PointerSession | null = null
  private resizeSession: PointerSession | null = null
  /** 定时器托管（TimerRegistry 统一定时器入口） */
  private timerRegistry = new TimerRegistry()
  /** 交互标记的复位定时器句柄 */
  private interactionResetTimer: TimerHandle | null = null
  /** 最小化/展开尺寸过渡的收尾定时器句柄 */
  private toggleAnimationTimer: TimerHandle | null = null

  constructor(plugin: Plugin) {
    this.storage = new QuickNoteStorage(plugin)

    this.modal = createModalVueApp(QuickNotePanel, {
      maskId: MASK_ID,
      width: `${DEFAULT_QUICK_NOTE_SETTINGS.panelWidth}px`,
      height: PANEL_DEFAULT_HEIGHT_CSS,
      // 点击遮罩（面板外区域）收起为最小化图标而非关闭，关闭仅由头部关闭按钮/状态栏切换触发
      getCloseHandler: () => this.requestMinimize,
      persistent: true,
      buildProps: () => ({
        plugin,
        i18n: (plugin.i18n?.quickNote as unknown as Record<string, string>) || {},
        manager: this,
        onClose: this.close,
      }),
    })

    window.addEventListener("resize", this.handleWindowResize)
  }

  /** 预加载位置/尺寸/最小化设置到缓存（persistent Modal 无需预挂载） */
  async init(): Promise<void> {
    const settings = await this.storage.settings.loadOrDefault()
    this.position = isQuickNotePlacement(settings.position)
      ? settings.position
      : DEFAULT_QUICK_NOTE_SETTINGS.position
    this.customX = toFiniteNumber(settings.customX, DEFAULT_QUICK_NOTE_SETTINGS.customX)
    this.customY = toFiniteNumber(settings.customY, DEFAULT_QUICK_NOTE_SETTINGS.customY)
    this.minimized = typeof settings.minimized === "boolean"
      ? settings.minimized
      : DEFAULT_QUICK_NOTE_SETTINGS.minimized
    this.panelWidth = toFiniteNumber(settings.panelWidth, DEFAULT_QUICK_NOTE_SETTINGS.panelWidth)
    this.panelHeight = Math.max(0, toFiniteNumber(settings.panelHeight, DEFAULT_QUICK_NOTE_SETTINGS.panelHeight))

    // 用户可能在 init 完成前已手动打开面板（此时按默认状态渲染）：加载完成后按持久化设置重放并通知面板
    if (this.modal.visible) {
      this.applyLayout()
      this.emitStateChange()
    }
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
    // persistent 模式首次 open 才创建遮罩 DOM，布局必须在 open 之后应用
    this.modal.open()
    this.applyLayout()
    this.emitStateChange()
  }

  close = (): void => {
    // 关闭时终止进行中的拖拽/缩放与尺寸过渡，避免隐藏后会话/动画仍在改写样式
    this.endSessions()
    this.stopToggleAnimation()
    this.modal.close()
  }

  /**
   * 一键恢复兜底（状态栏恢复按钮调用）：位置/尺寸/最小化全部重置为默认展开态，
   * 清除自定义坐标与绝对定位残留后重新应用，确保弹窗可见且可交互
   */
  async reset(): Promise<void> {
    this.endSessions()
    this.stopToggleAnimation()
    this.position = DEFAULT_QUICK_NOTE_SETTINGS.position
    this.customX = DEFAULT_QUICK_NOTE_SETTINGS.customX
    this.customY = DEFAULT_QUICK_NOTE_SETTINGS.customY
    this.minimized = false
    this.panelWidth = DEFAULT_QUICK_NOTE_SETTINGS.panelWidth
    this.panelHeight = DEFAULT_QUICK_NOTE_SETTINGS.panelHeight
    // open() 内部会 applyLayout + 派发状态事件，面板据此同步本地 ref
    this.open()
    await this.persistSettings()
  }

  /**
   * 遮罩点击入口：请求收起为最小化图标
   * 最小化视图由面板组件渲染（v-if），故派发事件让面板同步切换并回调 setMinimized
   */
  private requestMinimize = (): void => {
    // 从头部起拖 / 从缩放把手起拖、松手落在遮罩上时 click 会派发到遮罩（共同祖先），不应误触收起
    if (this.minimized || this.interactionMoved) return
    emitCustomEvent(QUICK_NOTE_MASK_MINIMIZE_EVENT)
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
   * 收起：容器固定为 32×32 的纯图标按钮，遮罩变透明且点击穿透；
   * 展开：还原尺寸与遮罩。两者之间以 0.12s 宽高过渡衔接
   */
  setMinimized(minimized: boolean): void {
    this.endSessions()
    // 先挂过渡类再改尺寸：仅最小化/展开做动画，窗口 resize 与拖拽缩放保持即时
    this.startToggleAnimation()
    this.minimized = minimized
    this.applyLayout()
    this.emitStateChange()
    this.persistSettings().catch((err) => {
      console.error("[quickNote] 最小化状态保存失败:", err)
    })
  }

  /** 设置预设位置：退出自定义定位 + 更新缓存 + 立即应用 + 持久化（供面板预设菜单调用） */
  async setPosition(position: QuickNotePosition): Promise<void> {
    this.endSessions()
    this.position = position
    this.applyLayout()
    this.emitStateChange()
    await this.persistSettings()
  }

  /**
   * 拖拽移动入口（展开态头部与最小化图标按钮的 pointerdown 调用）
   * 位移超过阈值才切换为 custom 绝对定位并跟随移动；松手后持久化坐标并置交互标记供 click 护栏读取
   */
  startDrag(e: PointerEvent): void {
    const container = this.modal.container
    // 只响应鼠标左键 / 主触点；右键、中键与多指副触点不参与拖拽
    if (!container || e.button !== 0 || !e.isPrimary) return
    // 拖拽把手内的其它按钮（最小化/关闭/预设菜单）不触发拖拽；图标按钮自身是 button，不在此限
    const targetButton = e.target instanceof Element ? e.target.closest("button") : null
    if (targetButton && targetButton !== e.currentTarget) return
    // 阻止拖拽过程中选中面板文本
    e.preventDefault()
    this.endSessions()
    // 手动拖拽必须即时跟手，终止可能仍在进行的展开/收起尺寸过渡
    this.stopToggleAnimation()

    const rect = container.getBoundingClientRect()
    const size: PanelSize = {
      width: rect.width,
      height: rect.height,
    }
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false

    this.dragSession = beginPointerSession(e, {
      onMove: (ev) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!dragging) {
          if (Math.abs(dx) < INTERACTION_THRESHOLD && Math.abs(dy) < INTERACTION_THRESHOLD) return
          dragging = true
          // 起拖即切换为绝对定位（脱离遮罩 flex 流，保持当前视觉位置）
          container.style.position = "absolute"
        }
        const point = resolvePanelPoint(
          {
            x: rect.left + dx,
            y: rect.top + dy,
          },
          size,
          {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          EDGE_PADDING,
        )
        container.style.left = `${point.x}px`
        container.style.top = `${point.y}px`
        this.customX = point.x
        this.customY = point.y
      },
      onEnd: () => {
        this.dragSession = null
        if (!dragging) return
        this.position = "custom"
        this.markInteractionMoved()
        this.persistSettings().catch((err) => {
          console.error("[quickNote] 拖拽位置保存失败:", err)
        })
        this.emitStateChange()
      },
    })
  }

  /**
   * 右下角缩放入口（展开态缩放把手 pointerdown 调用）
   * 自定义定位时右下角受视口边界约束；预设档位尺寸变化会改变 flex 锚点，按视口整体约束
   */
  startResize(e: PointerEvent): void {
    const container = this.modal.container
    if (!container || this.minimized || e.button !== 0 || !e.isPrimary) return
    e.preventDefault()
    this.endSessions()
    // 手动缩放必须即时跟手，终止可能仍在进行的展开/收起尺寸过渡
    this.stopToggleAnimation()

    const rect = container.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const anchored = this.position === "custom"
    let resizing = false

    this.resizeSession = beginPointerSession(e, {
      onMove: (ev) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!resizing) {
          if (Math.abs(dx) < INTERACTION_THRESHOLD && Math.abs(dy) < INTERACTION_THRESHOLD) return
          resizing = true
          document.body.style.cursor = "nwse-resize"
        }
        const maxWidth = anchored
          ? window.innerWidth - rect.left - EDGE_PADDING
          : window.innerWidth - EDGE_PADDING * 2
        const maxHeight = anchored
          ? window.innerHeight - rect.top - EDGE_PADDING
          : window.innerHeight - EDGE_PADDING * 2
        const width = clampBetween(rect.width + dx, PANEL_MIN_WIDTH, maxWidth)
        const height = clampBetween(rect.height + dy, PANEL_MIN_HEIGHT, maxHeight)
        this.panelWidth = width
        this.panelHeight = height
        container.style.width = `${width}px`
        container.style.height = `${height}px`
      },
      onEnd: () => {
        this.resizeSession = null
        if (!resizing) return
        this.markInteractionMoved()
        this.persistSettings().catch((err) => {
          console.error("[quickNote] 面板尺寸保存失败:", err)
        })
      },
      onCleanup: () => {
        document.body.style.cursor = ""
      },
    })
  }

  /** 图标按钮 click 护栏：刚完成拖拽/缩放则返回 true（本次点击应被吞掉，不触发展开） */
  consumeDragClick(): boolean {
    const moved = this.interactionMoved
    this.interactionMoved = false
    return moved
  }

  /**
   * 把当前状态完整落到遮罩/容器样式（尺寸与定位的唯一应用入口）
   * 几何计算与 DOM 写入在 layout.ts，此处仅回写被视口钳制后的 custom 坐标
   */
  private applyLayout(): void {
    const mask = getQuickNoteMask()
    const container = this.modal.container
    if (!mask || !container) return
    const result = applyPanelLayout(mask, container, {
      position: this.position,
      minimized: this.minimized,
      customX: this.customX,
      customY: this.customY,
      panelWidth: this.panelWidth,
      panelHeight: this.panelHeight,
    })
    this.customX = result.customX
    this.customY = result.customY
  }

  /** 标记刚发生一次有效拖拽/缩放：click 事件在 pointerup 后同步派发，延时复位避免标记残留吞掉后续正常点击 */
  private markInteractionMoved(): void {
    this.interactionMoved = true
    this.timerRegistry.clear(this.interactionResetTimer)
    this.interactionResetTimer = this.timerRegistry.setTimeout(() => {
      this.interactionMoved = false
      this.interactionResetTimer = null
    }, 0)
  }

  /** 开启最小化/展开的尺寸过渡，并在过渡结束后移除动画类（样式保留复用） */
  private startToggleAnimation(): void {
    beginPanelToggleAnimation()
    this.timerRegistry.clear(this.toggleAnimationTimer)
    this.toggleAnimationTimer = this.timerRegistry.setTimeout(() => {
      endPanelToggleAnimation()
      this.toggleAnimationTimer = null
    }, PANEL_TOGGLE_TRANSITION_MS + 40)
  }

  /** 立即收尾尺寸过渡（关闭 / 恢复 / 销毁时调用，避免动画类残留） */
  private stopToggleAnimation(): void {
    this.timerRegistry.clear(this.toggleAnimationTimer)
    this.toggleAnimationTimer = null
    endPanelToggleAnimation()
  }

  /** 主动结束进行中的拖拽/缩放会话（不落盘、不派发状态） */
  private endSessions(): void {
    this.dragSession?.cleanup()
    this.dragSession = null
    this.resizeSession?.cleanup()
    this.resizeSession = null
  }

  /** 通知面板把本地 position/minimized 拉回 Manager 的权威状态 */
  private emitStateChange(): void {
    emitCustomEvent(QUICK_NOTE_STATE_EVENT)
  }

  /**
   * 视口变化（窗口缩放 / 界面缩放 / 拖动窗口跨屏）后重新钳制：
   * 展开态重算尺寸与坐标；最小化 custom 图标重算坐标；预设档位由遮罩 flex 自动回流
   */
  private handleWindowResize = (): void => {
    if (!this.modal.visible) return
    // 视口变化需即时重排，先终止可能仍在进行的展开/收起尺寸过渡
    this.stopToggleAnimation()
    // 最小化预设图标由遮罩 flex 自动回流；展开态与 custom 图标需重算尺寸/坐标
    if (this.minimized && this.position !== "custom") return
    this.applyLayout()
  }

  /** 持久化当前设置（定位 + 尺寸 + 最小化状态全量写入） */
  private async persistSettings(): Promise<void> {
    await this.storage.settings.save({
      position: this.position,
      customX: this.customX,
      customY: this.customY,
      minimized: this.minimized,
      panelWidth: this.panelWidth,
      panelHeight: this.panelHeight,
    })
  }

  /** 彻底销毁（persistent Modal 必须 destroy 而非 close，否则残留 DOM） */
  destroy(): void {
    // 兜底清理拖拽/缩放会话（含 resize cursor）、尺寸过渡、复位定时器、视口监听与注入样式
    this.endSessions()
    this.stopToggleAnimation()
    this.timerRegistry.clear(this.interactionResetTimer)
    this.interactionResetTimer = null
    window.removeEventListener("resize", this.handleWindowResize)
    disposePanelLayout()
    this.modal.destroy()
  }
}

/** 校验持久化定位值（防止损坏数据命中 undefined 的 POSITION_ALIGN_MAP） */
function isQuickNotePlacement(value: unknown): value is QuickNotePlacement {
  return value === "custom" || QUICK_NOTE_POSITIONS.some((position) => position === value)
}

/** 数字字段兜底（损坏/旧版本缺失时回落到默认值） */
function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

/**
 * 注册速记功能
 */
export function registerQuickNote(plugin: Plugin): void {
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
}
