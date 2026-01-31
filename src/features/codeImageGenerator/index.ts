import type SiYuanPluginViteVueSN from '@/index'
import { createApp, type App as VueApp } from 'vue'
import CodeImageGeneratorPanel from './CodeImageGeneratorPanel.vue'

let app: VueApp | null = null
let container: HTMLElement | null = null

/**
 * 注册代码图片生成器功能
 */
export function registerCodeImageGenerator(plugin: SiYuanPluginViteVueSN) {
  plugin.addDock({
    config: {
      position: 'RightBottom',
      size: { width: 600, height: 0 },
      icon: 'iconCode',
      title: plugin.i18n.codeImageGenerator || '图片生成',
    },
    data: undefined,
    type: 'code-image-generator',
    init(dock) {
      container = document.createElement('div')
      Object.assign(container.style, {
        height: '100%',
        width: '100%',
        overflow: 'hidden'
      })
      dock.element.appendChild(container)

      app = createApp(CodeImageGeneratorPanel, {
        i18n: plugin.i18n
      })
      app.mount(container)
    },
    destroy() {
      app?.unmount()
      app = null
      container?.remove()
      container = null
    }
  })
}
