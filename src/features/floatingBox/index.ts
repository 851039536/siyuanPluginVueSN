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
  console.log('开始注册悬浮框功能')

  // 创建容器
  container = document.createElement('div')
  container.id = 'floating-box-container'

  // 多种选择器尝试
  const selectors = [
    '.layout__center.fn__flex.fn__flex-1',
    '.layout__center',
    '#workspace',
    'body'
  ]

  let inserted = false

  for (const selector of selectors) {
    const target = document.querySelector(selector)
    if (target) {
      console.log(`找到目标容器: ${selector}`)
      target.appendChild(container)
      inserted = true
      break
    }
  }

  if (!inserted) {
    console.error('未能找到合适的容器插入悬浮框')
  }

  // 创建 Vue 应用
  vueApp = createApp(FloatingBox, {
    i18n: (plugin.i18n as any).floatingBox || {},
    plugin: plugin
  })

  try {
    vueApp.mount(container)
    console.log('悬浮框 Vue 应用已挂载')
  } catch (error) {
    console.error('悬浮框挂载失败:', error)
  }

  // 保存实例以便清理
  ;(plugin as any).__floatingBox = {
    destroy: () => {
      if (vueApp && container) {
        vueApp.unmount()
        container.remove()
        vueApp = null
        container = null
        console.log('悬浮框已销毁')
      }
    }
  }
}
