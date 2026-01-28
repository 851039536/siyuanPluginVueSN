/**
 * 单词阅读功能模块
 * 闪卡式阅读工具，支持CRUD操作和分类筛选
 */
import { Plugin } from 'siyuan'
import { createApp, h } from 'vue'
import FlashcardReadingPanel from './FlashcardReadingPanel.vue'
import FlashcardDialog from './FlashcardDialog.vue'
import { FlashcardStorage } from './storage'

// 弹窗显示状态
let dialogInstance: any = null
let dialogApp: any = null
let dialogPlugin: Plugin | null = null
let dialogI18n: any = null

/**
 * 显示单词阅读弹窗
 */
export function showFlashcardDialog(plugin?: Plugin, i18n?: any) {
  // 更新 plugin 和 i18n
  if (plugin) dialogPlugin = plugin
  if (i18n) dialogI18n = i18n

  if (!dialogInstance) {
    // 创建弹窗容器
    const container = document.createElement('div')
    container.id = 'flashcard-dialog-container'
    document.body.appendChild(container)

    // 创建 Vue 应用
    dialogApp = createApp({
      setup() {
        return () => h(FlashcardDialog, {
          i18n: dialogI18n || {},
          plugin: dialogPlugin,
          ref: (el: any) => {
            dialogInstance = el
          }
        })
      }
    })

    dialogApp.mount(container)
  }

  if (dialogInstance) {
    dialogInstance.open()
  }
}

/**
 * 隐藏单词阅读弹窗
 */
export function hideFlashcardDialog() {
  if (dialogInstance) {
    dialogInstance.close()
  }
}

/**
 * 切换单词阅读弹窗显示状态
 */
export function toggleFlashcardDialog(plugin?: Plugin, i18n?: any) {
  // 更新 plugin 和 i18n
  if (plugin) dialogPlugin = plugin
  if (i18n) dialogI18n = i18n

  if (dialogInstance) {
    // 如果弹窗实例存在，切换显示状态
    // 检查当前是否可见，如果可见则关闭，否则打开
    if (dialogInstance.visible) {
      dialogInstance.close()
    } else {
      dialogInstance.open()
    }
  } else {
    showFlashcardDialog(plugin, i18n)
  }
}

/**
 * 单词阅读类
 */
export class FlashcardReading {
  private plugin: Plugin
  private storage: FlashcardStorage

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new FlashcardStorage(plugin)
  }

  /**
   * 初始化单词阅读功能
   */
  public async init() {
    // 先添加到右侧边栏（同步执行，确保 dock 立即注册）
    this.addDock()

    // 异步初始化存储
    await this.storage.init()

    // 初始化弹窗所需的 plugin 和 i18n
    if (!dialogPlugin) dialogPlugin = this.plugin
    if (!dialogI18n) dialogI18n = this.plugin.i18n?.flashcardReading || {}

  }

  /**
   * 添加到右侧边栏
   */
  private addDock() {
    const self = this

    this.plugin.addDock({
      config: {
        position: 'RightTop',
        size: { width: 400, height: 0 },
        icon: 'iconBookmark', // 书签图标，适合卡片收藏/阅读功能
        title: (this.plugin.i18n as any)?.flashcardReading?.panelTitle || '单词阅读',
        show: false,
      },
      data: {},
      type: 'flashcardreading-dock',
      init: (dock: any) => {
        // 创建 Vue 应用
        const container = document.createElement('div')
        container.style.height = '100%'
        container.style.overflow = 'hidden'

        const app = createApp({
          setup() {
            return () => h(FlashcardReadingPanel, {
              i18n: self.plugin.i18n.flashcardReading || {},
              plugin: self.plugin
            })
          }
        })

        app.mount(container)
        dock.element?.appendChild(container)

        // 保存应用引用，以便卸载时清理
        dock.__app = app
        dock.__container = container
      },
    })
  }

  /**
   * 获取存储实例（供外部使用）
   */
  public getStorage(): FlashcardStorage {
    return this.storage
  }

  /**
   * 销毁功能
   */
  public destroy() {
  }
}

/**
 * 注册单词阅读模块
 */
export function registerFlashcardReading(plugin: Plugin) {
  const flashcardReading = new FlashcardReading(plugin)
  flashcardReading.init()

  // 保存实例到插件对象中，以便在其他地方使用
  ;(plugin as any).__flashcardReading = flashcardReading

  return flashcardReading
}
