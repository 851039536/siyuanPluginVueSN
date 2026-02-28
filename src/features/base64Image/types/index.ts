/**
 * Base64 图片转换器功能主入口
 */
import { Plugin } from 'siyuan'
import { createApp, h } from 'vue'
import Base64ImagePanel from '../index.vue'

/**
 * 注册 Base64 图片转换器功能
 */
export function registerBase64Image(plugin: Plugin) {
  // 添加右侧边栏 Dock
  addBase64ImageDock(plugin)
}

/**
 * 添加右侧边栏 Dock
 */
function addBase64ImageDock(plugin: Plugin) {
  const self = { plugin }

  plugin.addDock({
    config: {
      position: 'RightTop',
      size: { width: 400, height: 0 },
      icon: 'iconImage',
      title: plugin.i18n.base64Image || 'Base64图片转换',
      show: false,
    },
    data: {},
    type: 'base64-image-dock',
    init: (dock: any) => {
      const container = document.createElement('div')
      container.style.height = '100%'
      container.style.overflow = 'hidden'

      const app = createApp({
        setup() {
          return () => h(Base64ImagePanel, {
            i18n: self.plugin.i18n,
            plugin: self.plugin,
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
