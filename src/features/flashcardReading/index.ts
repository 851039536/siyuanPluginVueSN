/**
 * 单词阅读功能模块
 * 闪卡式阅读工具，支持CRUD操作和分类筛选
 */
import { Plugin } from 'siyuan'
import { createApp, h } from 'vue'
import FlashcardReadingPanel from './FlashcardReadingPanel.vue'
import { FlashcardStorage } from './storage'

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

    console.log('Flashcard Reading initialized')
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
        icon: 'iconCheck', //iconCheck
        title: this.plugin.i18n.flashcardReading?.panelTitle || '单词阅读',
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
    console.log('Flashcard Reading destroyed')
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
