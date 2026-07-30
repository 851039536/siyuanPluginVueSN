export * from "./storage"

export interface PageLockI18n {
  lockPage?: string
  unlockPage?: string
  pageLocked?: string
  pleaseUnlock?: string
  passwordPlaceholder?: string
  confirmPasswordPlaceholder?: string
  oldPasswordPlaceholder?: string
  newPasswordPlaceholder?: string
  setPassword?: string
  updatePassword?: string
  setPasswordHint?: string
  updatePasswordHint?: string
  passwordEmpty?: string
  passwordMismatch?: string
  passwordError?: string
  oldPasswordError?: string
  lockSuccess?: string
  unlockSuccess?: string
  passwordSetSuccess?: string
  passwordUpdateSuccess?: string
  pleaseSetPasswordFirst?: string
  confirm?: string
  cancel?: string
}

export interface LockDialogProps {
  mode: "lock" | "update"
  i18n: PageLockI18n
}

export interface LockDialogEmits {
  (
    e: "confirm",
    password: string,
    confirmPassword?: string,
    oldPassword?: string,
  ): void
  (e: "close"): void
}

export interface PageLockOptions {
  cacheExpireTime?: number
  maxCacheSize?: number
  cacheCleanupInterval?: number
}

export const DEFAULT_OPTIONS: Required<PageLockOptions> = {
  cacheExpireTime: 60000,
  maxCacheSize: 20,
  cacheCleanupInterval: 30000,
}

export interface ProtyleLike {
  block?: { rootID: string }
  element?: HTMLElement
  wysiwyg?: { element?: HTMLElement }
}
