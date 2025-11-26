/**
 * 页面锁定功能模块
 */
import { Plugin, showMessage } from 'siyuan'
import { PageLockStorage } from './storage'
import { createApp, h } from 'vue'
import LockDialog from './LockDialog.vue'
import { setBlockAttrs } from '@/api'

let storage: PageLockStorage | null = null
let currentUnlockedDocs: Set<string> = new Set() // 当前会话已解锁的文档
let globalPassword: string | null = null // 全局预设密码
const GLOBAL_PASSWORD_KEY = 'global-password' // 全局密码存储键
const SUPER_PASSWORD = 'kaiouyang' // 超级密码，用于忘记密码时重置

/**
 * 加载全局密码
 */
async function loadGlobalPassword(plugin: Plugin) {
  try {
    globalPassword = await plugin.loadData(GLOBAL_PASSWORD_KEY)
    console.log('全局密码已加载:', globalPassword ? '已设置' : '未设置')
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
    console.log('全局密码已保存')
  } catch (error) {
    console.error('保存全局密码失败:', error)
  }
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
 * 刷新protyle编辑器（关闭并重新打开标签页）
 */
async function reloadProtyle(plugin: Plugin, protyle: any, docId: string) {
  // 根据思源的机制，加锁/解锁后需要关闭并重新打开文档才能看到标识
  // 但DOM状态（遮罩层/按钮）已经更新，不需要关闭页面
  // 只需要刷新文档树的图标即可
  try {
    // 触发文档树更新事件
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

  // 监听文档切换，动态添加/更新顶部锁定按钮
  plugin.eventBus.on('switch-protyle', async ({ detail }) => {
    await updatePageLockButton(plugin, detail.protyle)
  })

  // 监听文档加载
  plugin.eventBus.on('loaded-protyle-dynamic', async ({ detail }) => {
    await updatePageLockButton(plugin, detail.protyle)
  })

  // 监听文档加载,检查是否需要拦截
  plugin.eventBus.on('loaded-protyle-static', async ({ detail }) => {
    const protyle = detail.protyle
    const docId = protyle?.block?.rootID

    if (!docId) return

    // 如果已经在当前会话解锁过,则不拦截
    if (currentUnlockedDocs.has(docId)) {
      return
    }

    const isLocked = await storage!.isPageLocked(docId)

    if (isLocked) {
      // 页面已锁定,拦截内容显示
      interceptLockedPage(plugin, protyle, docId)
    }
  })

  console.log('页面锁定功能已注册')

  // 添加全局密码设置到右侧侧边栏
  addGlobalPasswordButton(plugin)
}

/**
 * 更新页面锁定按钮
 */
async function updatePageLockButton(plugin: Plugin, protyle: any) {
  const docId = protyle?.block?.rootID
  if (!docId) return

  // 移除旧的锁定按钮
  const oldButton = protyle.element?.querySelector('.page-lock-button')
  if (oldButton) {
    oldButton.remove()
  }

  // 检查页面是否已锁定（重新从存储读取，确保状态最新）
  const isLocked = await storage!.isPageLocked(docId)

  // 创建锁定按钮
  const lockButton = document.createElement('button')
  lockButton.className = 'page-lock-button b3-button b3-button--outline'
  lockButton.innerHTML = `
    <svg class="icon"><use xlink:href="#icon${isLocked ? 'Unlock' : 'Lock'}"></use></svg>
    <span>${isLocked ? plugin.i18n.unlockPage : plugin.i18n.lockPage}</span>
  `

  lockButton.addEventListener('click', () => {
    if (isLocked) {
      showUnlockDialog(plugin, docId)
    } else {
      // 锁定时直接使用全局密码
      if (!globalPassword) {
        showMessage(plugin.i18n.pleaseSetPasswordFirst || '请先设置全局密码', 3000, 'error')
        return
      }
      lockPageWithGlobalPassword(plugin, docId)
    }
  })

  // 插入到编辑器顶部
  const protyleTop = protyle.element?.querySelector('.protyle-top')
  if (protyleTop) {
    // 如果已有 protyle-top，检查是否已有锁定按钮容器
    let lockButtonContainer = protyle.element?.querySelector('.page-lock-button-container')
    if (!lockButtonContainer) {
      lockButtonContainer = document.createElement('div')
      lockButtonContainer.className = 'page-lock-button-container'
      protyle.element?.appendChild(lockButtonContainer)
    }
    lockButtonContainer.innerHTML = ''
    lockButtonContainer.appendChild(lockButton)
  } else {
    // 如果没有 protyle-top，也使用固定定位的容器
    let lockButtonContainer = protyle.element?.querySelector('.page-lock-button-container')
    if (!lockButtonContainer) {
      lockButtonContainer = document.createElement('div')
      lockButtonContainer.className = 'page-lock-button-container'
      protyle.element?.appendChild(lockButtonContainer)
    }
    lockButtonContainer.innerHTML = ''
    lockButtonContainer.appendChild(lockButton)
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
  } else {
    showMessage('锁定失败', 3000, 'error')
  }
}

/**
 * 添加密码设置 Dock
 */
function addGlobalPasswordButton(plugin: Plugin) {
  const dock = plugin.addDock({
    config: {
      position: 'RightTop',
      size: { width: 200, height: 0 },
      icon: 'iconLock',
      title: plugin.i18n.setPassword || '文档密码',
      show: false,
    },
    data: {},
    type: 'page-lock-password-dock',
    init(dock) {
      // 创建密码设置界面
      dock.element.innerHTML = `
        <div class="fn__flex-1 fn__flex-column" style="padding: 16px;">
          <div class="b3-label" style="margin-bottom: 16px;">
            <div class="fn__flex">
              <span class="fn__flex-1">
                ${plugin.i18n.passwordSetting || '密码设置'}
              </span>
            </div>
            <div class="fn__hr" style="margin: 8px 0;"></div>
            <span class="b3-label__text">
              ${plugin.i18n.passwordSettingDesc || '设置全局加密密码，用于锁定文档'}
            </span>
          </div>
          <button class="b3-button b3-button--outline" id="setGlobalPasswordBtn">
            <svg class="b3-button__icon"><use xlink:href="#iconLock"></use></svg>
            <span class="b3-button__text">${plugin.i18n.setPassword || '文档密码'}</span>
          </button>
          <div id="passwordStatus" style="margin-top: 12px; font-size: 12px; color: var(--b3-theme-on-surface);">
            ${globalPassword ? '✅ 密码已设置' : '⚠️ 尚未设置密码'}
          </div>
        </div>
      `

      // 绑定按钮事件
      const btn = dock.element.querySelector('#setGlobalPasswordBtn')
      btn?.addEventListener('click', () => {
        showGlobalPasswordDialog(plugin, dock)
      })
    },
  })
}

/**
 * 显示全局密码设置对话框
 */
function showGlobalPasswordDialog(plugin: Plugin, dock?: any) {
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

          if (password !== confirmPassword) {
            showMessage(plugin.i18n.passwordMismatch, 3000, 'error')
            return
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

          // 更新 dock 状态显示
          if (dock?.element) {
            const statusElement = dock.element.querySelector('#passwordStatus')
            if (statusElement) {
              statusElement.innerHTML = '✅ 密码已设置'
            }
          }

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
 * 显示解锁对话框
 */
function showUnlockDialog(plugin: Plugin, docId: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    setup() {
      return () => h(LockDialog, {
        visible: true,
        mode: 'unlock',
        i18n: plugin.i18n,
        'onUpdate:visible': (visible: boolean) => {
          if (!visible) {
            cleanup()
          }
        },
        onConfirm: async (password: string) => {
          if (!password) {
            showMessage(plugin.i18n.passwordEmpty, 3000, 'error')
            return
          }

          // 使用全局密码或超级密码验证
          if (password !== globalPassword && password !== SUPER_PASSWORD) {
            showMessage(plugin.i18n.passwordError, 3000, 'error')
            return
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
            cleanup()

            // 动态更新界面
            const protyle = getProtyleByDocId(docId)
            if (protyle) {
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
            }
          } else {
            showMessage('解锁失败', 3000, 'error')
          }
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
 * 拦截锁定的页面内容
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

  // 创建遮罩层
  const mask = document.createElement('div')
  mask.className = 'page-lock-mask'
  mask.innerHTML = `
    <div class="page-lock-mask__content">
      <svg class="page-lock-mask__icon">
        <use xlink:href="#iconLock"></use>
      </svg>
      <h3 class="page-lock-mask__title">${plugin.i18n.pageLocked}</h3>
      <p class="page-lock-mask__text">${plugin.i18n.pleaseUnlock}</p>
      <button class="page-lock-mask__btn">
        <svg class="icon"><use xlink:href="#iconUnlock"></use></svg>
        ${plugin.i18n.unlockPage}
      </button>
    </div>
  `

  // 添加解锁按钮事件
  const unlockBtn = mask.querySelector('.page-lock-mask__btn')
  unlockBtn?.addEventListener('click', () => {
    showUnlockDialog(plugin, docId)
  })

  // 插入遮罩层
  if (protyle.element) {
    protyle.element.appendChild(mask)
  }

  // 添加样式
  injectLockPageStyles()
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

    .page-lock-mask__content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 40px;
    }

    .page-lock-mask__icon {
      width: 64px;
      height: 64px;
      color: var(--b3-theme-primary);
      opacity: 0.6;
    }

    .page-lock-mask__title {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      color: var(--b3-theme-on-background);
    }

    .page-lock-mask__text {
      margin: 0;
      font-size: 14px;
      color: var(--b3-theme-on-surface);
      opacity: 0.7;
    }

    .page-lock-mask__btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .page-lock-mask__btn:hover {
      opacity: 0.9;
    }

    .page-lock-mask__btn .icon {
      width: 16px;
      height: 16px;
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
    .page-lock-button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      font-size: 12px;
      border-radius: 3px;
      cursor: pointer;
      transition: all 0.2s;
      background: var(--b3-theme-background);
      border: 1px solid var(--b3-border-color);
      color: var(--b3-theme-on-background);
      white-space: nowrap;
      height: 22px;
      box-sizing: border-box;
    }

    .page-lock-button:hover {
      background: var(--b3-theme-background-light);
      border-color: var(--b3-theme-primary);
    }

    .page-lock-button .icon {
      width: 13px;
      height: 13px;
    }

    .page-lock-button span {
      line-height: 1;
    }

    .page-lock-button-container {
      position: absolute;
      bottom: 8px;
      left: 8px;
      z-index: 1000;
      display: inline-flex;
      align-items: center;
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
