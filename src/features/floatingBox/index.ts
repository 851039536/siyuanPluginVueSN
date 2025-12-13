/**
 * 悬浮框功能模块
 * 在 layout__center 区域右侧居中显示一个可展开的悬浮框
 */
import { Plugin } from 'siyuan'
import { createApp, type App as VueApp } from 'vue'
import FloatingBox from './FloatingBox.vue'

let vueApp: VueApp | null = null
let container: HTMLElement | null = null

/**
 * 注册悬浮框功能
 */
export function registerFloatingBox(plugin: Plugin): void {
  // 创建容器
  container = document.createElement('div')
  container.id = 'floating-box-container'

  // 找到 layout__center 并插入
  const layoutCenter = document.querySelector('.layout__center.fn__flex.fn__flex-1')
  if (layoutCenter) {
    layoutCenter.appendChild(container)
  } else {
    // 如果找不到，延迟插入
    setTimeout(() => {
      const center = document.querySelector('.layout__center.fn__flex.fn__flex-1')
      if (center && container) {
        center.appendChild(container)
      }
    }, 1000)
  }

  // 创建 Vue 应用
  vueApp = createApp(FloatingBox, {
    i18n: (plugin.i18n as any).floatingBox || {}
  })

  vueApp.mount(container)

  // 保存实例以便清理
  ;(plugin as any).__floatingBox = {
    destroy: () => {
      if (vueApp && container) {
        vueApp.unmount()
        container.remove()
        vueApp = null
        container = null
      }
    }
  }
}
