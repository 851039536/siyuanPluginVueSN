/**
 * API参考模块
 * 功能：通过快捷键居中弹出多API使用方式参考
 */
import { Plugin } from 'siyuan'
import { createApp, h } from 'vue'
import ApiReferencePanel from './ApiReferencePanel.vue'

/**
 * 注册API参考模块
 */
export function registerApiReference(plugin: Plugin) {
  // 添加快捷键命令
  plugin.addCommand({
    langKey: 'openApiReference',
    hotkey: 'Ctrl+Alt+A',
    callback: () => {
      openApiReference()
    }
  })

}

/**
 * 打开API参考面板
 */
function openApiReference() {
  // 通过全局事件触发打开API参考面板
  window.dispatchEvent(new CustomEvent('openApiReference'))
}

/**
 * 显示API参考面板
 */
export function showApiReferencePanel(plugin: Plugin) {
  // 创建遮罩层
  const overlay = document.createElement('div')
  overlay.id = 'api-reference-overlay'
  overlay.style.position = 'fixed'
  overlay.style.top = '0'
  overlay.style.left = '0'
  overlay.style.width = '100vw'
  overlay.style.height = '100vh'
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
  overlay.style.zIndex = '9999'
  overlay.style.display = 'flex'
  overlay.style.justifyContent = 'center'
  overlay.style.alignItems = 'center'

  // 创建面板容器
  const panelContainer = document.createElement('div')
  panelContainer.style.width = '90%'
  panelContainer.style.maxWidth = '1400px'
  panelContainer.style.height = '90%'
  panelContainer.style.backgroundColor = 'var(--b3-theme-background)'
  overlay.appendChild(panelContainer)

  // 创建Vue应用
  const app = createApp({
    setup() {
      return () => h(ApiReferencePanel, {
        i18n: plugin.i18n,
        plugin: plugin,
        onClose: () => {
          // 清理并移除遮罩层
          app.unmount()
          document.body.removeChild(overlay)
        }
      })
    }
  })

  app.mount(panelContainer)

  // 点击遮罩层关闭面板
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      app.unmount()
      document.body.removeChild(overlay)
    }
  })

  // 添加到页面
  document.body.appendChild(overlay)

}
