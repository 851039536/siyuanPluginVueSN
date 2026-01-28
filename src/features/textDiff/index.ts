import { Plugin } from 'siyuan'
import { createApp, type App as VueApp } from 'vue'
import TextDiffModal from './components/TextDiffModal.vue'

let app: VueApp | null = null
let container: HTMLElement | null = null

/**
 * 注册文本对比功能
 */
export function registerTextDiff(plugin: Plugin): void {
  // 文本对比功能通过超级面板访问，不需要添加顶部栏按钮
}

/**
 * 切换文本对比工具显示/隐藏
 */
export function toggleTextDiff(plugin: Plugin) {
  if (app && container) {
    // 如果工具已存在，关闭它
    closeTextDiff()
  } else {
    // 创建并显示工具
    openTextDiff(plugin)
  }
}

/**
 * 打开文本对比工具
 */
function openTextDiff(plugin: Plugin) {
  // 创建遮罩层
  const mask = document.createElement('div')
  mask.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `
  mask.id = 'text-diff-mask'

  // 创建容器
  container = document.createElement('div')
  container.style.cssText = `
    width: 90vw;
    height: 80vh;
    background: var(--b3-theme-background);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  `

  // 添加关闭按钮
  const closeBtn = document.createElement('button')
  closeBtn.innerHTML = '✕'
  closeBtn.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border: none;
    background: rgba(0, 0, 0, 0.1);
    color: var(--b3-theme-on-background);
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    z-index: 1;
  `
  closeBtn.onclick = closeTextDiff

  mask.appendChild(closeBtn)
  mask.appendChild(container)
  document.body.appendChild(mask)

  // 点击遮罩层关闭
  mask.onclick = (e) => {
    if (e.target === mask) {
      closeTextDiff()
    }
  }

  // 创建 Vue 应用
  app = createApp(TextDiffModal, {
    onClose: closeTextDiff,
    i18n: plugin.i18n,
    plugin: plugin  // 传递 plugin 实例用于 API 调用
  })

  app.mount(container)
}

/**
 * 关闭文本对比工具
 */
function closeTextDiff() {
  if (app) {
    app.unmount()
    app = null
  }

  const mask = document.getElementById('text-diff-mask')
  if (mask) {
    mask.remove()
  }

  container = null
}
