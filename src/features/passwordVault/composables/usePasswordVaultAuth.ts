// 密码箱认证层 composable — 登录/首次创建、主密码校验、修改主密码（复用数据层单例状态）
import {
  DATA_VERSION,
} from "../types/storage"
import {
  deriveKey,
  encryptEntryPayload,
  generateSalt,
  hashMasterPassword,
} from "../utils/crypto"
import type { StoredPasswordEntry } from "../types"
import {
  encryptionKey,
  entries,
  isFirstTime,
  isLoggedIn,
  loadCategories,
  loadEntries,
  passwordHint,
  requireStorage,
  savedHash,
} from "./usePasswordVaultData"

/** 从存储加载验证信息（哈希、盐值、提示） */
async function loadMasterPasswordHash(): Promise<void> {
  try {
    const {
      hash,
      verifySalt,
      encryptionSalt: encSalt,
      hint,
    } = await requireStorage().loadVerificationData()

    if (hash && verifySalt && encSalt) {
      savedHash.value = hash
      passwordHint.value = hint || ""
      isFirstTime.value = false
    } else {
      isFirstTime.value = true
    }
  } catch (error) {
    console.error("Failed to load master password:", error)
    isFirstTime.value = true
  }
}

/**
 * 处理登录 / 首次创建主密码
 * @returns 错误文本（空字符串表示成功）
 */
async function login(inputPassword: string, hint?: string): Promise<string> {
  if (!inputPassword.trim()) return ""
  const storage = requireStorage()

  if (isFirstTime.value) {
    const verifySalt = generateSalt()
    const encryptSalt = generateSalt()
    const hash = await hashMasterPassword(inputPassword, verifySalt)

    if (hint) passwordHint.value = hint

    await storage.saveInitData({
      hash,
      verifySalt,
      encryptionSalt: encryptSalt,
      hint: passwordHint.value,
    })

    savedHash.value = hash
    isFirstTime.value = false
    encryptionKey.value = await deriveKey(inputPassword, encryptSalt)

    await Promise.all([loadEntries(), loadCategories()])
    isLoggedIn.value = true
    return ""
  }

  const verifySalt = await storage.verifySalt.load()
  const encryptSalt = await storage.encryptionSalt.load()
  if (!verifySalt || !encryptSalt) {
    return "数据损坏，请联系开发者"
  }

  const hash = await hashMasterPassword(inputPassword, verifySalt)
  if (hash !== savedHash.value) {
    return "密码错误，请重试"
  }

  encryptionKey.value = await deriveKey(inputPassword, encryptSalt)
  await Promise.all([loadEntries(), loadCategories()])
  isLoggedIn.value = true
  return ""
}

/** 校验主密码是否正确（用于导出等二次确认） */
async function verifyMasterPassword(inputPassword: string): Promise<boolean> {
  const verifySalt = await requireStorage().verifySalt.load()
  if (!verifySalt) return false
  const hash = await hashMasterPassword(inputPassword, verifySalt)
  return hash === savedHash.value
}

/**
 * 修改主密码（重新加密所有条目）
 * @returns 错误文本（空字符串表示成功）
 */
async function changePassword(oldPassword: string, newPassword: string): Promise<string> {
  const storage = requireStorage()
  const verifySalt = await storage.verifySalt.load()
  if (!verifySalt) return "数据损坏"

  const oldHash = await hashMasterPassword(oldPassword, verifySalt)
  if (oldHash !== savedHash.value) return "当前密码错误"

  const newVerifySalt = generateSalt()
  const newEncryptSalt = generateSalt()
  const newHash = await hashMasterPassword(newPassword, newVerifySalt)
  const newKey = await deriveKey(newPassword, newEncryptSalt)

  const reEncryptedEntries: StoredPasswordEntry[] = await Promise.all(
    entries.value.map(async (entry) => {
      const {
        encryptedPayload,
        iv,
      } = await encryptEntryPayload(
        {
          name: entry.name,
          account: entry.account,
          password: entry.password,
          description: entry.description,
        },
        newKey,
      )
      return {
        id: entry.id,
        category: entry.category,
        encryptedPayload,
        iv,
        createdAt: entry.createdAt,
        updatedAt: Date.now(),
        version: DATA_VERSION,
      }
    }),
  )

  await Promise.all([
    storage.masterPassword.save(newHash),
    storage.verifySalt.save(newVerifySalt),
    storage.encryptionSalt.save(newEncryptSalt),
    storage.entries.save(reEncryptedEntries),
  ])

  savedHash.value = newHash
  encryptionKey.value = newKey
  return ""
}

/**
 * 密码箱认证层 composable（复用数据层单例状态）
 */
export function usePasswordVaultAuth() {
  return {
    // 状态
    isFirstTime,
    passwordHint,
    // 认证操作
    loadMasterPasswordHash,
    login,
    verifyMasterPassword,
    changePassword,
  }
}
