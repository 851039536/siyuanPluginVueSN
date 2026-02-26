/**
 * 本地磁盘浏览器功能模块
 * 在右侧边栏显示本地磁盘，支持查看和打开
 */
import { Plugin } from 'siyuan'
import { createApp, h } from 'vue'
import DiskBrowserPanel from './DiskBrowserPanel.vue'
import { PluginStorage } from '@/utils/pluginStorage'

/**
 * 磁盘浏览器设置接口
 */
interface DiskBrowserSettings {
  favoriteFolders: string[]
}

/**
 * 注册本地磁盘浏览器功能
 */
export function registerDiskBrowser(plugin: Plugin) {
  const STORAGE_KEY = 'disk-browser-settings'

  const storage = new PluginStorage(plugin)

  const loadFavorites = async (): Promise<string[]> => {
    const settings = await storage.loadWithDefault<DiskBrowserSettings>(STORAGE_KEY, { favoriteFolders: [] })
    return settings.favoriteFolders
  }

  const saveFavorites = async (favorites: string[]): Promise<boolean> => {
    const settings: DiskBrowserSettings = { favoriteFolders: favorites }
    return storage.save(STORAGE_KEY, settings)
  }

  const initStorage = async (): Promise<void> => {
    try {
      const settings = await storage.load<DiskBrowserSettings>(STORAGE_KEY)
      if (!settings) {
        const defaultSettings: DiskBrowserSettings = {
          favoriteFolders: []
        }
        await storage.save(STORAGE_KEY, defaultSettings)
      }
    } catch (error) {
      console.error('初始化磁盘浏览器存储失败:', error)
    }
  }

  initStorage()

  plugin.addDock({
    config: {
      position: 'RightTop',
      size: { width: 380, height: 0 },
      icon: 'iconFiles',
      title: (plugin.i18n as any).diskBrowser?.panelTitle || '本地磁盘',
      show: false,
    },
    data: {},
    type: 'disk-browser-dock',
    init(dock: any) {
      const container = document.createElement('div')
      container.style.height = '100%'
      container.style.overflow = 'hidden'

      const app = createApp({
        setup() {
          return () => h(DiskBrowserPanel, {
            i18n: plugin.i18n.diskBrowser,
            loadFavorites,
            saveFavorites,
          })
        }
      })

      app.mount(container)
      dock.element?.appendChild(container)

      dock.__app = app
      dock.__container = container
    },
  })

}
