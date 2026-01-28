import type SiYuanPluginViteVueSN from '@/index'
import { createApp, type App as VueApp } from 'vue'
import CodeImageGeneratorPanel from './CodeImageGeneratorPanel.vue'

let app: VueApp | null = null
let container: HTMLElement | null = null

/**
 * 注册代码图片生成器功能
 * @param plugin 插件实例
 */
export function registerCodeImageGenerator(plugin: SiYuanPluginViteVueSN) {

  // 添加右侧边栏面板
  plugin.addDock({
    config: {
      position: 'RightBottom',
      size: { width: 600, height: 0 },
      icon: 'iconCode',
      title: plugin.i18n.codeImageGenerator || '代码图片生成',
    },
    data: {},
    type: 'code-image-generator',
    init(dock) {

      // 创建容器
      container = document.createElement('div')
      container.style.height = '100%'
      container.style.width = '100%'
      container.style.overflow = 'hidden'
      dock.element.appendChild(container)

      // 创建 Vue 应用
      app = createApp(CodeImageGeneratorPanel, {
        visible: true,
        i18n: plugin.i18n,
        onClose: () => {
        }
      })

      app.mount(container)
    },
    destroy() {
      // 销毁 Vue 应用
      if (app) {
        app.unmount()
        app = null
      }
      if (container) {
        container.remove()
        container = null
      }
    }
  })

}
