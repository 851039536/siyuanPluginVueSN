/**
 * 速记功能模块 — 入口
 * QuickNoteManager 管理 persistent Modal 生命周期与弹窗位置应用，
 * registerQuickNote 供插件注册链调用，toggle 由 App.vue 中心调度触发
 */
import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import type { QuickNotePosition } from "./types"
import { createModalVueApp } from "@/utils/vueAppHelper"
import { POSITION_ALIGN_MAP } from "./types"
import { DEFAULT_QUICK_NOTE_SETTINGS, QuickNoteStorage } from "./types/storage"
import QuickNotePanel from "./index.vue"

/** 贴边档位与屏幕边缘的间距 */
const EDGE_PADDING = "8px"

export class QuickNoteManager {
  readonly storage: QuickNoteStorage
  private modal: ModalAppInstance
  /** 当前位置缓存（init 时预加载，避免 open 时异步等待） */
  private position: QuickNotePosition = DEFAULT_QUICK_NOTE_SETTINGS.position

  constructor(plugin: Plugin) {
    this.storage = new QuickNoteStorage(plugin)

    this.modal = createModalVueApp(QuickNotePanel, {
      maskId: "quick-note-mask",
      width: "420px",
      height: "70vh",
      persistent: true,
      getCloseHandler: () => this.close,
      buildProps: () => ({
        plugin,
        i18n: (plugin.i18n?.quickNote as unknown as Record<string, string>) || {},
        manager: this,
        onClose: this.close,
      }),
    })
  }

  /** 预加载位置设置到缓存（persistent Modal 无需预挂载） */
  async init(): Promise<void> {
    const settings = await this.storage.settings.loadOrDefault()
    this.position = settings.position
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
    // persistent 模式首次 open 才创建遮罩 DOM，位置必须在 open 之后应用
    this.modal.open()
    this.applyPosition()
  }

  close = (): void => {
    this.modal.close()
  }

  /** 获取当前位置（供面板初始化选择器选中值） */
  getPosition(): QuickNotePosition {
    return this.position
  }

  /** 设置位置：更新缓存 + 持久化 + 立即应用（供面板位置选择器调用） */
  async setPosition(position: QuickNotePosition): Promise<void> {
    this.position = position
    this.applyPosition()
    await this.storage.settings.save({ position })
  }

  /**
   * 按当前位置改写遮罩层 flex 对齐实现贴边/居中
   * 注意：依赖 vueAppHelper createModalVueApp 的遮罩 DOM 结构
   * （全屏 fixed flex 容器，id 为 maskId），helper 重构时需同步调整此处
   */
  private applyPosition(): void {
    const mask = document.getElementById("quick-note-mask")
    if (!mask) return
    const align = POSITION_ALIGN_MAP[this.position]
    mask.style.alignItems = align.alignItems
    mask.style.justifyContent = align.justifyContent
    // 贴边档位留出与屏幕边缘的间距，居中无需
    mask.style.padding = this.position === "center" ? "0" : EDGE_PADDING
  }

  /** 彻底销毁（persistent Modal 必须 destroy 而非 close，否则残留 DOM） */
  destroy(): void {
    this.modal.destroy()
  }
}

/**
 * 注册速记功能
 */
export function registerQuickNote(plugin: Plugin): QuickNoteManager {
  const manager = new QuickNoteManager(plugin)
  manager.init().catch((err) => {
    console.error("[quickNote] 初始化失败:", err)
  })
  return manager
}
