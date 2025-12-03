/**
 * 本地磁盘浏览器功能模块
 * 在右侧边栏显示本地磁盘，支持查看和打开
 */
import { Plugin } from 'siyuan'
import { createApp, h } from 'vue'
import DiskBrowserPanel from './DiskBrowserPanel.vue'

/**
 * 注册本地磁盘浏览器功能
 */
export function registerDiskBrowser(plugin: Plugin) {
  console.log('注册本地磁盘浏览器功能')

  // 添加右侧边栏 Dock
  plugin.addDock({
    config: {
      position: 'RightTop',
      size: { width: 380, height: 0 }, // 增加宽度以适应两行布局
      icon: 'iconFiles',
      title: plugin.i18n.diskBrowser || '本地磁盘',
      show: false,
    },
    data: {},
    type: 'disk-browser-dock',
    init(dock: any) {
      // 创建 Vue 应用
      const container = document.createElement('div')
      container.style.height = '100%'
      container.style.overflow = 'hidden'

      const app = createApp({
        setup() {
          return () => h(DiskBrowserPanel, {
            i18n: plugin.i18n,
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

  console.log('本地磁盘浏览器功能已注册')
}
