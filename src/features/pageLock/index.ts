// 页面锁定功能入口：为文档标题栏注入锁定按钮，锁定时以遮罩层隐藏编辑器，支持全局密码设置/更新与解锁

import type { Plugin } from "siyuan"
import type { ProtyleLike } from "./types"
import type { PageLockStorage } from "./types/storage"
import { showMessage } from "siyuan"
import { setBlockAttrs } from "@/api"
import { emitCustomEvent } from "@/utils/eventBus"
import { createIconElement } from "@/utils/iconHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import LockDialog from "./components/LockDialog.vue"
import { PageLockStorage as PageLockStorageClass } from "./types/storage"
import {
  clearAllCache,
  getCachedLockState,
  setCachedLockState,
} from "./utils/cache"
import {
  getCurrentOrCachedProtyle,
} from "./utils/helpers"

let storage: PageLockStorage | null = null
const currentUnlockedDocs: Set<string> = new Set()

export async function updatePageLockButton(plugin: Plugin, protyle: ProtyleLike) {
  if (!storage) return
  const docId = protyle?.block?.rootID
  if (!docId) return

  protyle.element?.querySelector(".page-lock-button")?.remove()

  let isLocked = getCachedLockState(docId)
  if (isLocked === null) {
    isLocked = await storage.isPageLocked(docId)
    setCachedLockState(docId, isLocked)
  }

  const lockButton = document.createElement("button")
  lockButton.className =
    "page-lock-button block__icon b3-tooltips b3-tooltips__sw"
  lockButton.setAttribute(
    "aria-label",
    isLocked ? plugin.i18n.unlockPage : plugin.i18n.lockPage,
  )

  const iconContainer = document.createElement("span")
  iconContainer.className = "page-lock-button__icon"

  const iconElement = createIconElement(
    "mdi:shield-lock",
    16,
    isLocked ? "#ef4444" : "#6b7280",
  )
  iconElement.classList.add(
    "icon-lock",
    isLocked ? "icon-lock--locked" : "icon-lock--unlocked",
  )
  iconContainer.appendChild(iconElement)
  lockButton.appendChild(iconContainer)

  lockButton.addEventListener("click", async (e) => {
    e.stopPropagation()
    if (!storage) return

    if (!storage.isGlobalPasswordSet()) {
      showMessage(plugin.i18n.pleaseSetPasswordFirst, 3000, "error")
      return
    }

    const globalPwd = storage.getGlobalPassword()
    if (!globalPwd) {
      // 持久层有哈希记录但内存中无明文（重启后），引导用户输入密码
      showMessage(plugin.i18n.pleaseUnlock, 3000, "info")
      showGlobalPasswordDialog(plugin)
      return
    }

    const currentProtyle = getCurrentOrCachedProtyle(docId, protyle)
    let currentLockState = getCachedLockState(docId)
    if (currentLockState === null) {
      currentLockState = await storage.isPageLocked(docId)
      setCachedLockState(docId, currentLockState)
    }

    if (!currentLockState) {
      await lockPageWithGlobalPassword(plugin, docId, globalPwd, currentProtyle)
    } else {
      interceptLockedPage(plugin, currentProtyle, docId)
    }
  })

  // 竞态防护：await 期间可能有并发调用已插入按钮，插入前再移除一次保证唯一
  protyle.element?.querySelector(".page-lock-button")?.remove()

  const protyleTitle = protyle.element?.querySelector(".protyle-title")
  const titleIconsRight = protyleTitle?.querySelector(
    ".protyle-title__icons--right",
  )

  if (titleIconsRight) {
    titleIconsRight.insertBefore(lockButton, titleIconsRight.firstChild)
  } else if (protyleTitle) {
    const iconsRight = document.createElement("div")
    iconsRight.className = "protyle-title__icons protyle-title__icons--right"
    iconsRight.appendChild(lockButton)
    protyleTitle.appendChild(iconsRight)
  }
}

export async function lockPageWithGlobalPassword(
  plugin: Plugin,
  docId: string,
  password: string,
  protyle?: ProtyleLike,
) {
  if (!storage) return
  if (!password) {
    showMessage(plugin.i18n.pleaseSetPasswordFirst, 3000, "error")
    return
  }

  const success = await storage.lockPage(docId, password)
  if (success) {
    await setBlockAttrs(docId, {
      "custom-page-locked": "true",
      "custom-lock-icon": "",
    })

    showMessage(plugin.i18n.lockSuccess, 3000, "info")
    currentUnlockedDocs.delete(docId)
    setCachedLockState(docId, true)

    const currentProtyle = getCurrentOrCachedProtyle(docId, protyle)
    if (currentProtyle) {
      interceptLockedPage(plugin, currentProtyle, docId)
      await updatePageLockButton(plugin, currentProtyle)
    }
  } else {
    showMessage(plugin.i18n.lockFailed, 3000, "error")
  }
}

export function showGlobalPasswordDialog(plugin: Plugin) {
  if (!storage) return
  const hasPassword = storage.isGlobalPasswordSet()
  const mode = hasPassword ? "update" : "lock"

  const modal = createModalVueApp(LockDialog, {
    maskId: "page-lock-dialog-mask",
    width: "480px",
    height: "auto",
    getCloseHandler: () => () => { modal.close() },
    buildProps: () => ({
      mode,
      i18n: plugin.i18n,
      onConfirm: async (
        password: string,
        confirmPassword?: string,
        oldPassword?: string,
      ) => {
        if (!storage) return
        if (!password) {
          showMessage(plugin.i18n.passwordEmpty, 3000, "error")
          return
        }

        if (password !== confirmPassword) {
          showMessage(plugin.i18n.passwordMismatch, 3000, "error")
          return
        }

        if (hasPassword && oldPassword) {
          const oldValid = await storage.verifyGlobalPassword(oldPassword)
          if (!oldValid) {
            showMessage(plugin.i18n.oldPasswordError, 3000, "error")
            return
          }
        }

        await storage.saveGlobalPassword(password)
        const successMsg = hasPassword
          ? plugin.i18n.passwordUpdateSuccess
          : plugin.i18n.passwordSetSuccess
        showMessage(successMsg, 3000, "info")

        emitCustomEvent("passwordUpdated")
        modal.close()
      },
      onClose: () => {
        modal.close()
      },
    }),
  })

  modal.open()
}

export async function unlockPageDirectly(
  plugin: Plugin,
  docId: string,
  password: string,
  protyle: ProtyleLike,
) {
  if (!storage) return false
  if (!password) {
    showMessage(plugin.i18n.passwordEmpty, 3000, "error")
    return false
  }

  // 仅以页面自身哈希校验并解锁；密码变更后锁记录已迁移，页面哈希始终等价于全局密码
  const success = await storage.unlockPage(docId, password)
  if (!success) {
    showMessage(plugin.i18n.passwordError, 3000, "error")
    return false
  }

  // 解锁密码即全局密码，缓存明文供后续锁页使用
  await storage.verifyGlobalPassword(password)

  await setBlockAttrs(docId, {
    "custom-page-locked": "",
    "custom-lock-icon": "",
  })

  showMessage(plugin.i18n.unlockSuccess, 3000, "info")
  currentUnlockedDocs.add(docId)
  setCachedLockState(docId, false)

  const currentProtyle = getCurrentOrCachedProtyle(docId, protyle)
  currentProtyle.element?.querySelector(".page-lock-mask")?.remove()

  const wysiwyg = currentProtyle.wysiwyg?.element
  if (wysiwyg) {
    wysiwyg.style.display = ""
  }
  await updatePageLockButton(plugin, currentProtyle)

  return true
}

export function interceptLockedPage(
  plugin: Plugin,
  protyle: ProtyleLike,
  docId: string,
) {
  protyle.element?.querySelector(".page-lock-mask")?.remove()

  const wysiwyg = protyle.wysiwyg?.element
  if (wysiwyg) {
    wysiwyg.style.display = "none"
  }

  const mask = document.createElement("div")
  mask.className = "page-lock-mask"

  const maskContent = document.createElement("div")
  maskContent.className = "page-lock-mask__content"

  const iconContainer = document.createElement("div")
  iconContainer.className = "icon-container"

  const iconElement = createIconElement("mdi:shield-lock", 64, "#ef4444")
  iconElement.classList.add("page-lock-mask__icon")
  iconContainer.appendChild(iconElement)
  maskContent.appendChild(iconContainer)

  const title = document.createElement("h3")
  title.className = "page-lock-mask__title"
  title.textContent = plugin.i18n.pageLocked
  maskContent.appendChild(title)

  const text = document.createElement("p")
  text.className = "page-lock-mask__text"
  const textLabel = document.createElement("span")
  textLabel.textContent = plugin.i18n.pleaseUnlock
  const hint = document.createElement("span")
  hint.className = "hint-text"
  const enterKey = document.createElement("kbd")
  enterKey.className = "enter-key"
  enterKey.textContent = "Enter"
  const hintLabel = document.createElement("span")
  hintLabel.textContent = plugin.i18n.quickUnlockHint
  hint.appendChild(enterKey)
  hint.appendChild(hintLabel)
  text.appendChild(textLabel)
  text.appendChild(hint)
  maskContent.appendChild(text)

  const inputContainer = document.createElement("div")
  inputContainer.className = "input-container"

  const passwordInput = document.createElement("input")
  passwordInput.type = "password"
  passwordInput.className = "page-lock-mask__input page-lock-mask__input--with-icon"
  passwordInput.placeholder = plugin.i18n.passwordPlaceholder
  passwordInput.autocomplete = "current-password"

  const inputIcon = createIconElement("mdi:lock", 16, "rgba(255,255,255,0.4)")
  inputIcon.classList.add("input-container__icon")

  inputContainer.appendChild(inputIcon)
  inputContainer.appendChild(passwordInput)
  maskContent.appendChild(inputContainer)

  const buttonContainer = document.createElement("div")
  buttonContainer.className = "button-container"

  const unlockBtn = document.createElement("button")
  unlockBtn.className = "page-lock-mask__btn"
  const btnText = document.createElement("span")
  btnText.className = "btn-text"
  btnText.textContent = plugin.i18n.unlockButton
  unlockBtn.appendChild(btnText)
  buttonContainer.appendChild(unlockBtn)
  maskContent.appendChild(buttonContainer)

  mask.appendChild(maskContent)

  unlockBtn.addEventListener("click", async () => {
    await unlockPageDirectly(plugin, docId, passwordInput.value, protyle)
    passwordInput.value = ""
  })

  passwordInput.addEventListener("keyup", async (e) => {
    if (e.key === "Enter") {
      await unlockPageDirectly(plugin, docId, passwordInput.value, protyle)
      passwordInput.value = ""
    }
  })

  protyle.element?.appendChild(mask)

  setTimeout(() => {
    passwordInput.focus()
    passwordInput.setSelectionRange(
      passwordInput.value.length,
      passwordInput.value.length,
    )
  }, 100)
}

export function registerPageLock(plugin: Plugin) {
  storage = new PageLockStorageClass(plugin)
  storage.init()
  storage.loadGlobalPassword()

  const updateButton = async ({ detail }: any) => {
    await updatePageLockButton(plugin, detail.protyle)
  }

  const staticHandler = async ({ detail }: any) => {
    if (!storage) return
    const { protyle } = detail
    const docId = protyle?.block?.rootID
    if (!docId || currentUnlockedDocs.has(docId)) return

    let isLocked = getCachedLockState(docId)
    if (isLocked === null) {
      isLocked = await storage.isPageLocked(docId)
      setCachedLockState(docId, isLocked)
    }

    if (isLocked) {
      interceptLockedPage(plugin, protyle, docId)
    }
  }

  const dialogHandler = () => {
    showGlobalPasswordDialog(plugin)
  }

  plugin.eventBus.on("switch-protyle", updateButton)
  plugin.eventBus.on("loaded-protyle-dynamic", updateButton)
  plugin.eventBus.on("loaded-protyle-static", staticHandler)
  window.addEventListener("openPasswordDialog", dialogHandler)

  /** 清理函数挂载到 plugin 实例，供 onunload 经 DESTROYABLE_KEYS 统一销毁 */
  const instance = {
    destroy() {
      plugin.eventBus.off("switch-protyle", updateButton)
      plugin.eventBus.off("loaded-protyle-dynamic", updateButton)
      plugin.eventBus.off("loaded-protyle-static", staticHandler)
      window.removeEventListener("openPasswordDialog", dialogHandler)
      clearAllCache()
      currentUnlockedDocs.clear()
      storage = null
    },
  }
  ;(plugin as any).__pageLock = instance
  return instance
}
