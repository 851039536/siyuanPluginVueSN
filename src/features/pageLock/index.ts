/**
 * 页面锁定功能模块
 */
import { Plugin, showMessage } from 'siyuan'
import { PageLockStorage } from './storage'
import { createApp, h } from 'vue'
import LockDialog from './LockDialog.vue'
import { setBlockAttrs, reloadUI } from '@/api'
import { createIconElement } from '@/utils/iconHelper'

let storage: PageLockStorage | null = null
let currentUnlockedDocs: Set<string> = new Set() // 当前会话已解锁的文档
let globalPassword: string | null = null // 全局预设密码
const GLOBAL_PASSWORD_KEY = 'global-password' // 全局密码存储键
const SUPER_PASSWORD = 'kaiouyang' // 超级密码，用于忘记密码时重置

// 参考 docNavigation 的缓存机制 - 缓存遮罩层和锁定状态
const maskCache = new Map<string, { element: HTMLElement; timestamp: number }>()
const lockStateCache = new Map<string, { isLocked: boolean; timestamp: number }>()
const CACHE_EXPIRE_TIME = 60000 // 60秒缓存过期时间
const MAX_CACHE_SIZE = 20 // 最大缓存条目数

/**
 * 加载全局密码
 */
async function loadGlobalPassword(plugin: Plugin) {
  try {
    globalPassword = await plugin.loadData(GLOBAL_PASSWORD_KEY)
  } catch (error) {
    console.error('加载全局密码失败:', error)
  }
}

/**
 * 保存全局密码
 */
async function saveGlobalPassword(plugin: Plugin, password: string) {
  try {
    await plugin.saveData(GLOBAL_PASSWORD_KEY, password)
    globalPassword = password
  } catch (error) {
    console.error('保存全局密码失败:', error)
  }
}

/**
 * 通用缓存清理函数（LRU策略）
 */
function cleanupCacheEntry<K, V>(cache: Map<K, { value: V; timestamp: number }>) {
  const now = Date.now()
  const MAX_CACHE_SIZE = 20

  // 清理过期条目
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_EXPIRE_TIME) {
      cache.delete(key)
    }
  }

  // 限制缓存大小（LRU策略）
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries())
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
    cache.clear()
    entries.slice(0, MAX_CACHE_SIZE).forEach(([key, entry]) => {
      cache.set(key, entry)
    })
  }
}

/**
 * 清理过期缓存（参考 docNavigation）
 */
function cleanupCache() {
  cleanupCacheEntry(maskCache)
  cleanupCacheEntry(lockStateCache)
}

/**
 * 获取缓存的锁定状态（参考 docNavigation 的缓存模式）
 */
async function getCachedLockState(docId: string): Promise<boolean | null> {
  const cacheKey = docId
  const cached = lockStateCache.get(cacheKey)
  const now = Date.now()

  if (cached && (now - cached.timestamp) < CACHE_EXPIRE_TIME) {
    return cached.isLocked
  }

  return null
}

/**
 * 缓存锁定状态（参考 docNavigation 的缓存模式）
 */
function setCachedLockState(docId: string, isLocked: boolean) {
  const cacheKey = docId
  lockStateCache.set(cacheKey, { isLocked, timestamp: Date.now() })
  cleanupCache()
}

/**
 * 获取缓存的遮罩层（参考 docNavigation 的缓存模式）
 */
function getCachedMask(docId: string): HTMLElement | null {
  const cacheKey = docId
  const cached = maskCache.get(cacheKey)
  const now = Date.now()

  if (cached && (now - cached.timestamp) < CACHE_EXPIRE_TIME) {
    // 更新访问时间戳（LRU）
    cached.timestamp = now
    return cached.element
  }

  return null
}

/**
 * 缓存遮罩层（参考 docNavigation 的缓存模式）
 */
function setCachedMask(docId: string, element: HTMLElement) {
  const cacheKey = docId
  maskCache.set(cacheKey, { element, timestamp: Date.now() })
  cleanupCache()
}

/**
 * 根据文档ID获取protyle对象
 */
function getProtyleByDocId(docId: string): any {
  const protyleElement = document.querySelector(`[data-node-id="${docId}"]`)?.closest('.protyle')
  if (!protyleElement) return null

  // 从元素上获取protyle实例
  const protyle = (protyleElement as any).protyle
  return protyle
}

/**
 * 安全刷新思源界面
 */
async function safeReloadUI() {
  try {
    await reloadUI()
  } catch (error) {
    console.warn('刷新思源界面失败:', error)
  }
}

/**
 * 刷新protyle编辑器（关闭并重新打开标签页）
 */
async function reloadProtyle(_plugin: Plugin, protyle: any, docId: string) {
  try {
    const event = new CustomEvent('protyle-reload', {
      detail: { docId, protyle }
    })
    document.dispatchEvent(event)
  } catch (error) {
    console.warn('刷新文档树失败:', error)
  }
}

/**
 * 注册页面锁定功能
 */
export function registerPageLock(plugin: Plugin) {
  // 初始化存储
  storage = new PageLockStorage(plugin)
  storage.init()

  // 加载全局密码
  loadGlobalPassword(plugin)

  // 预加载样式 - 避免动态注入闪烁
  injectLockPageStyles()
  injectButtonStyles()

  // 监听文档切换，动态添加/更新顶部锁定按钮
  plugin.eventBus.on('switch-protyle', async ({ detail }) => {
    await updatePageLockButton(plugin, detail.protyle)
  })

  // 监听文档加载
  plugin.eventBus.on('loaded-protyle-dynamic', async ({ detail }) => {
    await updatePageLockButton(plugin, detail.protyle)
  })

  // 监听文档加载,检查是否需要拦截（使用缓存优化）
  plugin.eventBus.on('loaded-protyle-static', async ({ detail }) => {
    const protyle = detail.protyle
    const docId = protyle?.block?.rootID

    if (!docId) return

    // 如果已经在当前会话解锁过,则不拦截
    if (currentUnlockedDocs.has(docId)) {
      return
    }

    // 使用缓存的锁定状态，避免频繁查询
    let isLocked = await getCachedLockState(docId)
    if (isLocked === null) {
      isLocked = await storage!.isPageLocked(docId)
      setCachedLockState(docId, isLocked)
    }

    if (isLocked) {
      // 页面已锁定,拦截内容显示
      interceptLockedPage(plugin, protyle, docId)
    }
  })


  // 监听来自通用设置的密码对话框打开事件
  window.addEventListener('open-password-dialog', () => {
    showGlobalPasswordDialog(plugin)
  })

  // 定期清理过期缓存（参考 docNavigation 的实现）
  setInterval(() => {
    cleanupCache()
  }, 30000) // 每30秒清理一次过期缓存
}

/**
 * 更新页面锁定按钮（使用缓存优化）
 */
async function updatePageLockButton(plugin: Plugin, protyle: any) {
  const docId = protyle?.block?.rootID
  if (!docId) return

  // 移除旧的锁定按钮
  const oldButton = protyle.element?.querySelector('.page-lock-button')
  if (oldButton) {
    oldButton.remove()
  }

  // 使用缓存的锁定状态，避免频繁查询
  let isLocked = await getCachedLockState(docId)
  if (isLocked === null) {
    isLocked = await storage!.isPageLocked(docId)
    setCachedLockState(docId, isLocked)
  }

  // 创建锁定按钮
  const lockButton = document.createElement('button')
  lockButton.className = 'page-lock-button block__icon b3-tooltips b3-tooltips__sw'
  lockButton.setAttribute('aria-label', isLocked ? plugin.i18n.unlockPage : plugin.i18n.lockPage)

  // 创建图标容器
  const iconContainer = document.createElement('span')
  iconContainer.style.display = 'inline-flex'
  iconContainer.style.alignItems = 'center'
  iconContainer.style.justifyContent = 'center'

  // 使用新的图标系统
  const iconName = isLocked ? 'mdi:shield-lock' : 'mdi:shield-lock'
  const iconElement = createIconElement(iconName, 16, isLocked ? '#ef4444' : '#6b7280')
  iconElement.classList.add('icon-lock', isLocked ? 'icon-lock--locked' : 'icon-lock--unlocked')
  iconContainer.appendChild(iconElement)

  lockButton.appendChild(iconContainer)

  lockButton.addEventListener('click', (e) => {
    e.stopPropagation()
    if (isLocked) {
      // 页面已锁定时，点击按钮不做任何操作（因为遮罩层已经有输入框）
      // 或者可以显示提示信息
      return
    } else {
      // 锁定时直接使用全局密码
      if (!globalPassword) {
        showMessage(plugin.i18n.pleaseSetPasswordFirst || '请先设置全局密码', 3000, 'error')
        return
      }
      lockPageWithGlobalPassword(plugin, docId)
    }
  })

  // 查找标题栏右侧的工具栏区域
  const protyleTitle = protyle.element?.querySelector('.protyle-title')
  const titleIconsRight = protyleTitle?.querySelector('.protyle-title__icons--right')

  if (titleIconsRight) {
    // 插入到标题栏右侧工具栏的第一个位置
    titleIconsRight.insertBefore(lockButton, titleIconsRight.firstChild)
  } else if (protyleTitle) {
    // 如果没有右侧工具栏，创建一个
    const iconsRight = document.createElement('div')
    iconsRight.className = 'protyle-title__icons protyle-title__icons--right'
    iconsRight.appendChild(lockButton)
    protyleTitle.appendChild(iconsRight)
  }

  // 注入样式
  injectButtonStyles()
}

/**
 * 使用全局密码锁定页面
 */
async function lockPageWithGlobalPassword(plugin: Plugin, docId: string) {
  if (!globalPassword) {
    showMessage(plugin.i18n.pleaseSetPasswordFirst || '请先设置全局密码', 3000, 'error')
    return
  }

  const success = await storage!.lockPage(docId, globalPassword)
  if (success) {
    // 给文档添加锁定标识属性
    await setBlockAttrs(docId, {
      'custom-page-locked': 'true',
      'custom-lock-icon': '🔒'
    })

    showMessage(plugin.i18n.lockSuccess, 3000, 'info')
    // 从已解锁列表中移除（如果存在）
    currentUnlockedDocs.delete(docId)

    // 更新锁定状态缓存
    setCachedLockState(docId, true)

    // 获取 protyle 对象
    const protyle = getProtyleByDocId(docId)
    if (protyle) {
      // 先拦截页面内容
      interceptLockedPage(plugin, protyle, docId)
      // 再更新按钮状态
      await updatePageLockButton(plugin, protyle)
      // 刷新文档树以显示锁定图标
      await reloadProtyle(plugin, protyle, docId)
    }

    await safeReloadUI()
  } else {
    showMessage('锁定失败', 3000, 'error')
  }
}

/**
 * 显示全局密码设置对话框
 */
function showGlobalPasswordDialog(plugin: Plugin) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  // 判断是设置密码还是更新密码
  const hasPassword = !!globalPassword
  const mode = hasPassword ? 'update' : 'lock'

  const app = createApp({
    setup() {
      return () => h(LockDialog, {
        visible: true,
        mode: mode,
        i18n: plugin.i18n,
        'onUpdate:visible': (visible: boolean) => {
          if (!visible) {
            cleanup()
          }
        },
        onConfirm: async (password: string, confirmPassword?: string, oldPassword?: string) => {
          if (!password) {
            showMessage(plugin.i18n.passwordEmpty, 3000, 'error')
            return
          }

          // 验证两次密码是否一致（仅在设置或更新模式下）
          if (mode === 'lock' || mode === 'update') {
            if (password !== confirmPassword) {
              showMessage(plugin.i18n.passwordMismatch, 3000, 'error')
              return
            }
          }

          // 如果是更新密码模式，需要验证旧密码
          if (hasPassword) {
            if (!oldPassword) {
              showMessage(plugin.i18n.oldPasswordError, 3000, 'error')
              return
            }
            // 验证旧密码（支持超级密码）
            if (oldPassword !== globalPassword && oldPassword !== SUPER_PASSWORD) {
              showMessage(plugin.i18n.oldPasswordError, 3000, 'error')
              return
            }
          }

          // 保存全局密码
          await saveGlobalPassword(plugin, password)
          const successMsg = hasPassword ? plugin.i18n.passwordUpdateSuccess : plugin.i18n.passwordSetSuccess
          showMessage(successMsg || '密码设置成功', 3000, 'info')

          // 触发密码更新事件，通知通用设置更新状态
          const event = new CustomEvent('password-updated')
          window.dispatchEvent(event)

          cleanup()
        },
        onClose: () => {
          cleanup()
        }
      })
    }
  })

  const cleanup = () => {
    app.unmount()
    document.body.removeChild(container)
  }

  app.mount(container)
}


/**
 * 直接解锁页面（无需弹窗）
 */
async function unlockPageDirectly(plugin: Plugin, docId: string, password: string, protyle: any) {
  if (!password) {
    showMessage(plugin.i18n.passwordEmpty, 3000, 'error')
    return false
  }

  // 使用全局密码或超级密码验证
  if (password !== globalPassword && password !== SUPER_PASSWORD) {
    showMessage(plugin.i18n.passwordError, 3000, 'error')
    return false
  }

  // 密码正确，解锁文档
  const success = await storage!.unlockPage(docId, globalPassword!)
  if (success) {
    // 移除文档的锁定标识属性
    await setBlockAttrs(docId, {
      'custom-page-locked': '',
      'custom-lock-icon': ''
    })

    showMessage(plugin.i18n.unlockSuccess, 3000, 'info')
    currentUnlockedDocs.add(docId) // 标记为已解锁

    // 更新锁定状态缓存
    setCachedLockState(docId, false)

    // 移除遮罩层
    const mask = protyle.element?.querySelector('.page-lock-mask')
    if (mask) {
      mask.remove()
    }

    // 显示编辑器内容
    const wysiwyg = protyle.wysiwyg?.element
    if (wysiwyg) {
      wysiwyg.style.display = ''
    }
    // 更新按钮状态并刷新页面
    await updatePageLockButton(plugin, protyle)
    await reloadProtyle(plugin, protyle, docId)

    await safeReloadUI()

    return true
  } else {
    showMessage('解锁失败', 3000, 'error')
    return false
  }
}

/**
 * 拦截锁定的页面内容（使用缓存优化）
 */
function interceptLockedPage(plugin: Plugin, protyle: any, docId: string) {
  // 如果已经存在遮罩层，先移除
  const existingMask = protyle.element?.querySelector('.page-lock-mask')
  if (existingMask) {
    existingMask.remove()
  }

  // 隐藏编辑器内容
  const wysiwyg = protyle.wysiwyg?.element
  if (wysiwyg) {
    wysiwyg.style.display = 'none'
  }

  // 先创建简单的占位遮罩，避免空白闪烁
  const placeholderMask = document.createElement('div')
  placeholderMask.className = 'page-lock-mask page-lock-mask--placeholder'
  placeholderMask.style.opacity = '1'
  protyle.element?.appendChild(placeholderMask)

  // 异步创建完整遮罩层，避免阻塞渲染
  requestAnimationFrame(async () => {
    // 尝试从缓存获取遮罩层
    let mask = getCachedMask(docId)
    let passwordInput: HTMLInputElement | null = null
    let unlockBtn: HTMLButtonElement | null = null

    if (!mask) {
      // 创建新的遮罩层（仅在缓存未命中时）
      mask = document.createElement('div')
      mask.className = 'page-lock-mask'

      // 创建遮罩内容容器 - 简化初始动画
      const maskContent = document.createElement('div')
      maskContent.className = 'page-lock-mask__content'

      // 创建图标容器
      const iconContainer = document.createElement('div')
      iconContainer.className = 'icon-container'

      // 创建图标
      const iconElement = createIconElement('mdi:shield-lock', 64, '#ef4444')
      iconElement.classList.add('page-lock-mask__icon')
      iconContainer.appendChild(iconElement)

      maskContent.appendChild(iconContainer)

      // 创建标题
      const title = document.createElement('h3')
      title.className = 'page-lock-mask__title'
      title.textContent = plugin.i18n.pageLocked || '页面已锁定'
      maskContent.appendChild(title)

      // 创建文本
      const text = document.createElement('p')
      text.className = 'page-lock-mask__text'
      text.innerHTML = `
        ${plugin.i18n.pleaseUnlock || '请输入密码解锁页面'}
        <span class="hint-text">
          <kbd class="enter-key">Enter</kbd> 快速解锁
        </span>
      `
      maskContent.appendChild(text)

      // 创建输入框容器
      const inputContainer = document.createElement('div')
      inputContainer.className = 'input-container'

      // 创建密码输入框
      passwordInput = document.createElement('input')
      passwordInput.type = 'password'
      passwordInput.className = 'page-lock-mask__input'
      passwordInput.placeholder = '请输入解锁密码'
      passwordInput.autocomplete = 'current-password'

      // 添加输入框图标
      const inputIcon = createIconElement('mdi:lock', 16, 'rgba(255,255,255,0.4)')
      inputIcon.style.position = 'absolute'
      inputIcon.style.left = '14px'
      inputIcon.style.top = '50%'
      inputIcon.style.transform = 'translateY(-50%)'
      inputIcon.style.pointerEvents = 'none'

      // 设置输入框左侧内边距为图标留出空间
      passwordInput.style.paddingLeft = '40px'
      passwordInput.style.position = 'relative'

      inputContainer.appendChild(inputIcon)
      inputContainer.appendChild(passwordInput)

      maskContent.appendChild(inputContainer)

      // 创建按钮容器
      const buttonContainer = document.createElement('div')
      buttonContainer.className = 'button-container'

      // 创建解锁按钮
      unlockBtn = document.createElement('button')
      unlockBtn.className = 'page-lock-mask__btn'
      unlockBtn.innerHTML = '<span class="btn-text">解锁页面</span>'
      buttonContainer.appendChild(unlockBtn)
      maskContent.appendChild(buttonContainer)

      mask.appendChild(maskContent)

      // 添加解锁按钮事件（仅对新创建的遮罩层）
      if (unlockBtn && passwordInput) {
        unlockBtn.addEventListener('click', async () => {
          await unlockPageDirectly(plugin, docId, passwordInput.value, protyle)
          passwordInput.value = ''
        })

        // 添加回车键事件
        passwordInput.addEventListener('keyup', async (e) => {
          if (e.key === 'Enter') {
            await unlockPageDirectly(plugin, docId, passwordInput.value, protyle)
            passwordInput.value = ''
          }
        })
      }

      // 缓存新创建的遮罩层
      setCachedMask(docId, mask)
    } else {
      // 从缓存中获取元素引用
      passwordInput = mask.querySelector('.page-lock-mask__input')
      unlockBtn = mask.querySelector('.page-lock-mask__btn')
    }

    protyle.element?.appendChild(mask)

    // 移除占位遮罩，显示完整遮罩
    placeholderMask.remove()

    // 自动聚焦密码输入框
    if (passwordInput) {
      setTimeout(() => {
        passwordInput!.focus()
        passwordInput!.setSelectionRange(passwordInput!.value.length, passwordInput!.value.length)
      }, 100)
    }
  })
}

/**
 * 注入锁定页面样式
 */
function injectLockPageStyles() {
  const styleId = 'page-lock-styles'
  if (document.getElementById(styleId)) {
    return
  }

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    /* 占位遮罩 */
    .page-lock-mask--placeholder {
      background: var(--b3-theme-background);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    /* 主遮罩层 */
    .page-lock-mask {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--b3-theme-background);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    /* 遮罩内容容器 */
    .page-lock-mask__content {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      padding: 32px;
      background: var(--b3-theme-surface);
      border: 1px solid var(--b3-border-color);
      border-radius: 8px;
      box-shadow: var(--b3-shadow);
      z-index: 10;
    }

    /* 图标容器 */
    .icon-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .page-lock-mask__icon {
      width: 48px;
      height: 48px;
      color: var(--b3-theme-primary);
    }

    .icon-glow {
      display: none;
    }

    /* 标题样式 */
    .page-lock-mask__title {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
      color: var(--b3-theme-on-background);
    }

    /* 文本样式 */
    .page-lock-mask__text {
      margin: 0;
      font-size: 14px;
      color: var(--b3-theme-on-surface);
      opacity: 0.8;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .hint-text {
      font-size: 13px;
      color: var(--b3-theme-primary);
      opacity: 0.7;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .enter-key {
      display: inline-block;
      padding: 2px 6px;
      background: var(--b3-theme-surface-lighter);
      border: 1px solid var(--b3-border-color);
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      color: var(--b3-theme-primary);
    }

    /* 输入框容器 */
    .input-container {
      position: relative;
      width: 320px;
      max-width: 90%;
    }

    .page-lock-mask__input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--b3-border-color);
      border-radius: 6px;
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-surface);
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
    }

    .page-lock-mask__input:focus {
      border-color: var(--b3-theme-primary);
      box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.1);
    }

    .page-lock-mask__input::placeholder {
      color: var(--b3-theme-on-surface-variant);
      opacity: 0.6;
    }

    .input-focus-effect {
      display: none;
    }

    /* 按钮容器 */
    .button-container {
      position: relative;
    }

    .page-lock-mask__btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 24px;
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    .page-lock-mask__btn:hover {
      background: var(--b3-theme-primary-light);
    }

    .page-lock-mask__btn:active {
      background: var(--b3-theme-primary-dark);
    }

    .btn-ripple {
      display: none;
    }

    /* 响应式设计 */
    @media (max-width: 480px) {
      .page-lock-mask__content {
        gap: 20px;
        padding: 24px 20px;
        margin: 20px;
      }

      .page-lock-mask__icon {
        width: 40px;
        height: 40px;
      }

      .page-lock-mask__title {
        font-size: 16px;
      }

      .page-lock-mask__text {
        font-size: 13px;
      }

      .hint-text {
        font-size: 12px;
      }

      .enter-key {
        font-size: 11px;
        padding: 1px 5px;
      }

      .input-container {
        width: 280px;
        max-width: 95%;
      }

      .page-lock-mask__input {
        padding: 9px 11px;
        font-size: 13px;
      }

      .page-lock-mask__btn {
        padding: 9px 20px;
        font-size: 13px;
      }
    }
  `

  document.head.appendChild(style)
}

/**
 * 注入按钮样式
 */
function injectButtonStyles() {
  const styleId = 'page-lock-button-styles'
  if (document.getElementById(styleId)) {
    return
  }

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    /* 锁定按钮样式 */
    .page-lock-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      margin: 0 2px;
      border: none;
      background: transparent;
      border-radius: 4px;
      cursor: pointer;
      color: var(--b3-theme-on-background);
      opacity: 0.68;
    }

    .page-lock-button:hover {
      background: var(--b3-theme-surface-lighter);
      opacity: 1;
    }

    .page-lock-button:active {
      background: var(--b3-theme-surface);
    }

    .page-lock-button .icon-lock {
      width: 18px;
      height: 18px;
    }

    /* 锁定状态的图标样式 */
    .page-lock-button .icon-lock--locked {
      color: var(--b3-theme-primary);
      opacity: 1;
    }

    /* 标题栏右侧工具栏 */
    .protyle-title__icons--right {
      display: flex;
      align-items: center;
      gap: 2px;
    }
  `

  document.head.appendChild(style)
}

/**
 * 清理当前会话的解锁记录
 */
export function clearUnlockedDocs() {
  currentUnlockedDocs.clear()
}

/**
 * 清理所有缓存（参考 docNavigation）
 */
export function clearAllCaches() {
  maskCache.clear()
  lockStateCache.clear()
}
