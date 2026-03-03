import type { Plugin } from 'siyuan'
import { showMessage } from 'siyuan'
import { createApp, h } from 'vue'
import { setBlockAttrs } from '@/api'
import { createIconElement } from '@/utils/iconHelper'
import { PageLockStorage } from './utils/storage'
import {
  loadGlobalPassword,
  saveGlobalPassword,
  getGlobalPassword,
  getProtyleByDocId,
  safeReloadUI,
  reloadProtyle,
  SUPER_PASSWORD
} from './utils/helpers'
import {
  cleanupCache,
  getCachedLockState,
  setCachedLockState,
  getCachedMask,
  setCachedMask
} from './utils/cache'
import { injectLockPageStyles, injectButtonStyles } from './utils/styles'
import LockDialog from './components/LockDialog.vue'

let storage: PageLockStorage | null = null
let currentUnlockedDocs: Set<string> = new Set()

export async function updatePageLockButton(plugin: Plugin, protyle: any) {
  const docId = protyle?.block?.rootID
  if (!docId) return

  protyle.element?.querySelector('.page-lock-button')?.remove()

  let isLocked = await getCachedLockState(docId)
  if (isLocked === null) {
    isLocked = await storage!.isPageLocked(docId)
    setCachedLockState(docId, isLocked)
  }

  const lockButton = document.createElement('button')
  lockButton.className = 'page-lock-button block__icon b3-tooltips b3-tooltips__sw'
  lockButton.setAttribute('aria-label', isLocked ? plugin.i18n.unlockPage : plugin.i18n.lockPage)

  const iconContainer = document.createElement('span')
  iconContainer.style.display = 'inline-flex'
  iconContainer.style.alignItems = 'center'
  iconContainer.style.justifyContent = 'center'

  const iconElement = createIconElement('mdi:shield-lock', 16, isLocked ? '#ef4444' : '#6b7280')
  iconElement.classList.add('icon-lock', isLocked ? 'icon-lock--locked' : 'icon-lock--unlocked')
  iconContainer.appendChild(iconElement)
  lockButton.appendChild(iconContainer)

  lockButton.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!isLocked && !getGlobalPassword()) {
      showMessage(plugin.i18n.pleaseSetPasswordFirst || '请先设置全局密码', 3000, 'error')
      return
    }
    if (!isLocked) {
      lockPageWithGlobalPassword(plugin, docId)
    }
  })

  const protyleTitle = protyle.element?.querySelector('.protyle-title')
  const titleIconsRight = protyleTitle?.querySelector('.protyle-title__icons--right')

  if (titleIconsRight) {
    titleIconsRight.insertBefore(lockButton, titleIconsRight.firstChild)
  } else if (protyleTitle) {
    const iconsRight = document.createElement('div')
    iconsRight.className = 'protyle-title__icons protyle-title__icons--right'
    iconsRight.appendChild(lockButton)
    protyleTitle.appendChild(iconsRight)
  }

  injectButtonStyles()
}

export async function lockPageWithGlobalPassword(plugin: Plugin, docId: string) {
  const globalPwd = getGlobalPassword()
  if (!globalPwd) {
    showMessage(plugin.i18n.pleaseSetPasswordFirst || '请先设置全局密码', 3000, 'error')
    return
  }

  const success = await storage!.lockPage(docId, globalPwd)
  if (success) {
    await setBlockAttrs(docId, {
      'custom-page-locked': 'true',
      'custom-lock-icon': '🔒'
    })

    showMessage(plugin.i18n.lockSuccess, 3000, 'info')
    currentUnlockedDocs.delete(docId)
    setCachedLockState(docId, true)

    const protyle = getProtyleByDocId(docId)
    if (protyle) {
      interceptLockedPage(plugin, protyle, docId)
      await updatePageLockButton(plugin, protyle)
      await reloadProtyle(plugin, protyle, docId)
    }

    await safeReloadUI()
  } else {
    showMessage('锁定失败', 3000, 'error')
  }
}

export function showGlobalPasswordDialog(plugin: Plugin) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const hasPassword = !!getGlobalPassword()
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

          if ((mode === 'lock' || mode === 'update') && password !== confirmPassword) {
            showMessage(plugin.i18n.passwordMismatch, 3000, 'error')
            return
          }

          if (hasPassword &&
             (!oldPassword || (oldPassword !== getGlobalPassword() && oldPassword !== SUPER_PASSWORD))) {
            showMessage(plugin.i18n.oldPasswordError, 3000, 'error')
            return
          }

          await saveGlobalPassword(plugin, password)
          const successMsg = hasPassword ? plugin.i18n.passwordUpdateSuccess : plugin.i18n.passwordSetSuccess
          showMessage(successMsg || '密码设置成功', 3000, 'info')

          window.dispatchEvent(new CustomEvent('password-updated'))
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

export async function unlockPageDirectly(plugin: Plugin, docId: string, password: string, protyle: any) {
  if (!password) {
    showMessage(plugin.i18n.passwordEmpty, 3000, 'error')
    return false
  }

  if (password !== getGlobalPassword() && password !== SUPER_PASSWORD) {
    showMessage(plugin.i18n.passwordError, 3000, 'error')
    return false
  }

  const success = await storage!.unlockPage(docId, getGlobalPassword()!)
  if (!success) {
    showMessage('解锁失败', 3000, 'error')
    return false
  }

  await setBlockAttrs(docId, {
    'custom-page-locked': '',
    'custom-lock-icon': ''
  })

  showMessage(plugin.i18n.unlockSuccess, 3000, 'info')
  currentUnlockedDocs.add(docId)
  setCachedLockState(docId, false)

  protyle.element?.querySelector('.page-lock-mask')?.remove()

  const wysiwyg = protyle.wysiwyg?.element
  if (wysiwyg) {
    wysiwyg.style.display = ''
  }
  await updatePageLockButton(plugin, protyle)
  await reloadProtyle(plugin, protyle, docId)

  await safeReloadUI()

  return true
}

export function interceptLockedPage(plugin: Plugin, protyle: any, docId: string) {
  protyle.element?.querySelector('.page-lock-mask')?.remove()

  const wysiwyg = protyle.wysiwyg?.element
  if (wysiwyg) {
    wysiwyg.style.display = 'none'
  }

  const placeholderMask = document.createElement('div')
  placeholderMask.className = 'page-lock-mask page-lock-mask--placeholder'
  placeholderMask.style.opacity = '1'
  protyle.element?.appendChild(placeholderMask)

  requestAnimationFrame(async () => {
    let mask = getCachedMask(docId)
    let passwordInput: HTMLInputElement | null = null
    let unlockBtn: HTMLButtonElement | null = null

    if (!mask) {
      mask = document.createElement('div')
      mask.className = 'page-lock-mask'

      const maskContent = document.createElement('div')
      maskContent.className = 'page-lock-mask__content'

      const iconContainer = document.createElement('div')
      iconContainer.className = 'icon-container'

      const iconElement = createIconElement('mdi:shield-lock', 64, '#ef4444')
      iconElement.classList.add('page-lock-mask__icon')
      iconContainer.appendChild(iconElement)
      maskContent.appendChild(iconContainer)

      const title = document.createElement('h3')
      title.className = 'page-lock-mask__title'
      title.textContent = plugin.i18n.pageLocked || '页面已锁定'
      maskContent.appendChild(title)

      const text = document.createElement('p')
      text.className = 'page-lock-mask__text'
      text.innerHTML = `
        ${plugin.i18n.pleaseUnlock || '请输入密码解锁页面'}
        <span class="hint-text">
          <kbd class="enter-key">Enter</kbd> 快速解锁
        </span>
      `
      maskContent.appendChild(text)

      const inputContainer = document.createElement('div')
      inputContainer.className = 'input-container'

      passwordInput = document.createElement('input')
      passwordInput.type = 'password'
      passwordInput.className = 'page-lock-mask__input'
      passwordInput.placeholder = '请输入解锁密码'
      passwordInput.autocomplete = 'current-password'

      const inputIcon = createIconElement('mdi:lock', 16, 'rgba(255,255,255,0.4)')
      inputIcon.style.position = 'absolute'
      inputIcon.style.left = '14px'
      inputIcon.style.top = '50%'
      inputIcon.style.transform = 'translateY(-50%)'
      inputIcon.style.pointerEvents = 'none'

      passwordInput.style.paddingLeft = '40px'
      passwordInput.style.position = 'relative'

      inputContainer.appendChild(inputIcon)
      inputContainer.appendChild(passwordInput)
      maskContent.appendChild(inputContainer)

      const buttonContainer = document.createElement('div')
      buttonContainer.className = 'button-container'

      unlockBtn = document.createElement('button')
      unlockBtn.className = 'page-lock-mask__btn'
      unlockBtn.innerHTML = '<span class="btn-text">解锁页面</span>'
      buttonContainer.appendChild(unlockBtn)
      maskContent.appendChild(buttonContainer)

      mask.appendChild(maskContent)

      if (unlockBtn && passwordInput) {
        unlockBtn.addEventListener('click', async () => {
          await unlockPageDirectly(plugin, docId, passwordInput!.value, protyle)
          passwordInput!.value = ''
        })

        passwordInput.addEventListener('keyup', async (e) => {
          if (e.key === 'Enter') {
            await unlockPageDirectly(plugin, docId, passwordInput!.value, protyle)
            passwordInput!.value = ''
          }
        })
      }

      setCachedMask(docId, mask)
    } else {
      passwordInput = mask.querySelector('.page-lock-mask__input')
      unlockBtn = mask.querySelector('.page-lock-mask__btn')
    }

    protyle.element?.appendChild(mask)
    placeholderMask.remove()

    if (passwordInput) {
      setTimeout(() => {
        passwordInput!.focus()
        passwordInput!.setSelectionRange(passwordInput!.value.length, passwordInput!.value.length)
      }, 100)
    }
  })
}

export function registerPageLock(plugin: Plugin) {
  storage = new PageLockStorage(plugin)
  storage.init()
  loadGlobalPassword(plugin)
  injectLockPageStyles()
  injectButtonStyles()

  const updateButton = async ({ detail }: any) => {
    await updatePageLockButton(plugin, detail.protyle)
  }

  plugin.eventBus.on('switch-protyle', updateButton)
  plugin.eventBus.on('loaded-protyle-dynamic', updateButton)

  plugin.eventBus.on('loaded-protyle-static', async ({ detail }) => {
    const { protyle } = detail
    const docId = protyle?.block?.rootID
    if (!docId || currentUnlockedDocs.has(docId)) return

    let isLocked = await getCachedLockState(docId)
    if (isLocked === null) {
      isLocked = await storage!.isPageLocked(docId)
      setCachedLockState(docId, isLocked)
    }

    if (isLocked) {
      interceptLockedPage(plugin, protyle, docId)
    }
  })

  window.addEventListener('open-password-dialog', () => {
    showGlobalPasswordDialog(plugin)
  })

  setInterval(cleanupCache, 30000)
}

export { PageLockStorage } from './utils/storage'
export * from './types'
