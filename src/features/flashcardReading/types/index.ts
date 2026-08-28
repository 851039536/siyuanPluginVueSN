/**
 * 单词阅读功能 - 类型定义
 */
import type { Plugin } from "siyuan"
import {
  openTab,
  openWindow,
} from "siyuan"
import type { App } from "vue"
import {
  createApp,
  h,
} from "vue"
import { DEFAULT_I18N } from "../composables/useI18n"
import FlashcardReadingPanel from "../index.vue"

// 共享类型从公共模块重导出
export type {
  Flashcard,
  CreateFlashcardDTO,
  UpdateFlashcardDTO,
  TypingSettings,
} from "@/utils/sharedStorage/flashcardStorage"

/**
 * 视图模式类型
 */
export type ViewMode = "list" | "statistics" | "typing"

/**
 * 统计数据类型
 */
export interface StatisticsData {
  totalPractice: number
  practicedCards: number
  totalCards: number
  categoryStats: Array<{ category: string, count: number }>
  cardStats: Array<{ title: string, category: string, count: number }>
}

/**
 * 表单错误类型
 */
export type FormErrors = Record<string, string>

/**
 * 卡片列表/表单共享配置（分页大小与预设类别）
 */
export const CARD_CONFIG = {
  PAGE_SIZE: 10,
  PRESET_CATEGORIES: [
    "C#",
    "编程单词",
    "JavaScript",
    "TypeScript",
    "Vue",
    "Rust",
  ] as string[],
}

/**
 * 国际化文本类型
 */
export interface I18n {
  panelTitle?: string
  category?: string
  allCategories?: string
  searchPlaceholder?: string
  total?: string
  filtered?: string
  listView?: string
  statisticsView?: string
  play?: string
  copyTitle?: string
  copyContent?: string
  copiedTitle?: string
  copiedContent?: string
  copied?: string
  copyFailed?: string
  openFileFailed?: string
  editCard?: string
  deleteCard?: string
  addCard?: string
  refresh?: string
  previous?: string
  next?: string
  randomCard?: string
  practiceCount?: string
  noCards?: string
  noPracticeData?: string
  startPracticeHint?: string
  title?: string
  content?: string
  selectCategory?: string
  customCategory?: string
  customCategoryPlaceholder?: string
  cancel?: string
  save?: string
  close?: string
  titlePlaceholder?: string
  contentPlaceholder?: string
  titleEmpty?: string
  titleDuplicate?: string
  loadFailed?: string
  updateSuccess?: string
  createSuccess?: string
  saveFailed?: string
  deleteSuccess?: string
  deleteFailed?: string
  confirmDelete?: string
  playFailed?: string
  categoryStats?: string
  topCards?: string
  totalPractice?: string
  practicedCards?: string
  totalCards?: string
  masteryProgress?: string
  typingView?: string
  typeTheWord?: string
  clickToStartTyping?: string
  correct?: string
  skipCard?: string
  caseInsensitive?: string
  caseSensitive?: string
  instantReset?: string
  delayedReset?: string
  coverMode?: string
  revealMode?: string
  sessionCorrect?: string
  timerLabel?: string
  sessionSizeLabel?: string
  roundComplete?: string
  /** 打字练习标题提示 */
  typingTitleCaseInsensitive?: string
  typingTitleCaseSensitive?: string
  typingTitleInstantReset?: string
  typingTitleDelayedReset?: string
  typingTitleCoverMode?: string
  typingTitleRevealMode?: string
  typingTitleTimerOn?: string
  typingTitleTimerOff?: string
  typingTimerOn?: string
  typingTimerOff?: string
  typingCardUnit?: string
  retryTyping?: string
  summaryCorrect?: string
  startNextRound?: string
  /** 边学边写标记过滤 */
  typingHideMarkedOn?: string
  typingHideMarkedOff?: string
  typingTitleHideMarkedOn?: string
  typingTitleHideMarkedOff?: string
  markForTypingHide?: string
  unmarkForTypingHide?: string
  /** 在独立窗口打开 */
  openInWindow?: string
}

// ========================================
// 独立窗口承载（addTab + openTab + openWindow 双形态）
// ========================================

/** 单词阅读自定义页签类型 */
export const FLASHCARD_READING_TAB_TYPE = "flashcard-reading-tab"

/** 自定义 Tab 模型实例的最小结构（init 回调的 this） */
interface TabCustom {
  element?: Element
}

/** 模块级重复注册防护：多窗口场景下每个渲染进程只注册一次 */
let tabRegistered = false

/**
 * Manager：管理单词阅读自定义页签与独立窗口生命周期。
 * 打开独立窗口：先创建/聚焦主窗口页签（openTab），再移入浮动窗口（openWindow），
 * 关闭浮动窗口时思源会自动把页签移回主窗口，无需反向操作。
 */
export class FlashcardTabManager {
  private plugin: Plugin
  private app: App | null = null
  private container: HTMLElement | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.registerTabModel()
  }

  /** 注册自定义 Tab 模型（init 的 this 指向 Custom 实例，this.element 为挂载点） */
  private registerTabModel() {
    if (tabRegistered) return
    tabRegistered = true

    const self = this
    const init = function (this: TabCustom) {
      if (this.element) {
        self.mountPanel(this.element as HTMLElement)
      }
    }
    const destroy = () => {
      self.unmountPanel()
    }

    this.plugin.addTab({
      type: FLASHCARD_READING_TAB_TYPE,
      init: init as () => void,
      destroy,
    })
  }

  /** 挂载 Vue 面板到 Tab 容器（容器补全局基准字号类 + 全高，与 createVueDockApp 一致） */
  private mountPanel(element: HTMLElement) {
    this.unmountPanel()
    const container = document.createElement("div")
    container.classList.add("vp-dock-root")
    container.style.height = "100%"
    container.style.overflow = "hidden"
    this.container = container
    element.appendChild(container)
    this.app = createApp({
      setup: () => () => h(FlashcardReadingPanel as any, this.buildProps()),
    })
    this.app.mount(container)
  }

  private buildProps(): Record<string, any> {
    return {
      plugin: this.plugin,
      mode: "tab",
    }
  }

  private unmountPanel() {
    if (this.app) {
      this.app.unmount()
      this.app = null
    }
    if (this.container) {
      this.container.remove()
      this.container = null
    }
  }

  /** 打开独立浮动窗口：先创建/聚焦主窗口页签，再移入浮动窗口；失败时页签留在主窗口 */
  public async openFloating() {
    const tab = await this.openTabInMainWindow()
    if (!tab) return
    try {
      openWindow({
        width: 480,
        height: 680,
        tab,
      })
    } catch (error) {
      console.error("[FlashcardReading] openWindow failed, tab stays in main window:", error)
    }
  }

  /** 在主窗口创建/聚焦单词阅读页签，返回 Tab（供移入浮动窗口）；失败返回 null */
  private async openTabInMainWindow() {
    try {
      const title
        = (this.plugin.i18n as any)?.flashcardReading?.panelTitle
          || DEFAULT_I18N.panelTitle
      return await openTab({
        app: this.plugin.app,
        custom: {
          id: `${this.plugin.name}${FLASHCARD_READING_TAB_TYPE}`,
          icon: "iconBookmark",
          title,
        },
        position: "right",
      })
    } catch (error) {
      console.error("[FlashcardReading] openTab failed:", error)
      return null
    }
  }

  public destroy() {
    this.unmountPanel()
  }
}

