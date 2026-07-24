// 密码箱数据层 composable — 唯一 Storage 实例 + 共享状态 refs + 条目/类别 CRUD + 导出
import type { Plugin } from "siyuan"
import type {
  LegacyStoredPasswordEntry,
  PasswordCategory,
  PasswordEntry,
  StoredPasswordEntry,
} from "../types"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
} from "vue"
import { triggerBlobDownload } from "@/utils/domUtils"
import {
  DATA_VERSION,
  PasswordVaultStorage,
} from "../types/storage"
import {
  decryptEntryPayload,
  decryptPassword,
  encryptEntryPayload,
} from "../utils/crypto"

// ============================================================
// 模块级单例状态（父组件与各弹窗子组件、认证 composable 共享同一份引用）
// ============================================================

let storage: PasswordVaultStorage | null = null

/** 获取已初始化的 Storage（认证 composable 亦复用此实例） */
export function requireStorage(): PasswordVaultStorage {
  if (!storage) {
    throw new Error("[PasswordVault] storage not initialized")
  }
  return storage
}

/** 登录状态（会话内保持） */
export const isLoggedIn = ref(false)
/** 是否首次创建主密码 */
export const isFirstTime = ref(false)
/** 保存的验证哈希 */
export const savedHash = ref("")
/** 当前会话的加密密钥 */
export const encryptionKey = ref<CryptoKey | null>(null)
/** 密码提示 */
export const passwordHint = ref("")

/** 运行时条目（已解密，仅内存） */
export const entries = ref<PasswordEntry[]>([])
/** 类别列表 */
export const categories = ref<PasswordCategory[]>([
  {
    id: "default",
    name: "默认",
    color: "#b0aea5",
  },
])

/** 类别查找缓存 O(1) */
export const categoriesMap = computed(() => {
  const map = new Map<string, PasswordCategory>()
  for (const cat of categories.value) {
    map.set(cat.id, cat)
  }
  return map
})

/** 表单敏感字段集合 */
export interface EntryFormData {
  category: string
  name: string
  account: string
  password: string
  description: string
}

// ============================================================
// 条目 / 类别 CRUD
// ============================================================

/** 加载条目（解密敏感字段，自动迁移旧格式） */
export async function loadEntries(): Promise<void> {
  if (!encryptionKey.value) return

  try {
    const stored = await requireStorage().entries.load()
    if (!stored || stored.length === 0) {
      entries.value = []
      return
    }

    let needsMigration = false
    const decrypted: PasswordEntry[] = await Promise.all(
      stored.map(async (entry: StoredPasswordEntry | LegacyStoredPasswordEntry) => {
        // 旧格式（v1：仅 password 加密）
        if ("encryptedPassword" in entry && entry.encryptedPassword) {
          needsMigration = true
          const legacy = entry as LegacyStoredPasswordEntry
          const password = await decryptPassword(
            legacy.encryptedPassword,
            legacy.iv,
            encryptionKey.value!,
          )
          return {
            id: legacy.id,
            category: legacy.category,
            name: legacy.name,
            account: legacy.account,
            password,
            description: legacy.description ?? "",
            createdAt: legacy.createdAt,
            updatedAt: legacy.updatedAt,
          }
        }

        // 新格式（v2）：所有敏感字段整体加密
        const v2 = entry as StoredPasswordEntry
        const payload = await decryptEntryPayload(
          v2.encryptedPayload,
          v2.iv,
          encryptionKey.value!,
        )
        return {
          id: v2.id,
          category: v2.category,
          name: payload.name,
          account: payload.account,
          password: payload.password,
          description: payload.description,
          createdAt: v2.createdAt,
          updatedAt: v2.updatedAt,
        }
      }),
    )

    entries.value = decrypted

    if (needsMigration) {
      await saveEntries()
      console.info("[PasswordVault] 旧格式数据已自动迁移至 v2 加密格式")
    }
  } catch (error) {
    console.error("Failed to load entries:", error)
    entries.value = []
  }
}

export async function loadCategories(): Promise<void> {
  try {
    const stored = await requireStorage().categories.load()
    if (stored) categories.value = stored
  } catch (error) {
    console.error("Failed to load categories:", error)
  }
}

/** 保存条目（加密所有敏感字段） */
export async function saveEntries(): Promise<void> {
  if (!encryptionKey.value) {
    console.error("No encryption key available")
    return
  }
  try {
    const storedEntries: StoredPasswordEntry[] = await Promise.all(
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
          encryptionKey.value!,
        )
        return {
          id: entry.id,
          category: entry.category,
          encryptedPayload,
          iv,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          version: DATA_VERSION,
        }
      }),
    )
    await requireStorage().entries.save(storedEntries)
  } catch (error) {
    console.error("Failed to save entries:", error)
  }
}

export async function saveCategories(): Promise<void> {
  try {
    await requireStorage().categories.save(categories.value)
  } catch (error) {
    console.error("Failed to save categories:", error)
  }
}

const getCategoryById = (id: string): PasswordCategory | undefined => categoriesMap.value.get(id)

const getCategoryEntryCount = (categoryId: string): number => {
  let count = 0
  for (const e of entries.value) {
    if (e.category === categoryId) count++
  }
  return count
}

/** 新增类别（返回是否成功） */
async function addCategory(name: string, color: string): Promise<boolean> {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (categories.value.some((c) => c.name === trimmed)) {
    showMessage("类别已存在", 2000, "error")
    return false
  }
  categories.value.push({
    id: Date.now().toString(),
    name: trimmed,
    color,
  })
  await saveCategories()
  showMessage("类别已添加", 2000, "info")
  return true
}

/** 删除类别，将其下条目迁移到默认类别，返回受影响条目数 */
async function deleteCategory(categoryId: string): Promise<number> {
  if (categoryId === "default") {
    showMessage("默认类别不能删除", 2000, "error")
    return 0
  }

  const affectedEntries = entries.value.filter((e) => e.category === categoryId)
  for (const entry of affectedEntries) {
    entry.category = "default"
  }
  if (affectedEntries.length > 0) {
    await saveEntries()
  }

  categories.value = categories.value.filter((c) => c.id !== categoryId)
  await saveCategories()
  return affectedEntries.length
}

/** 新增或更新条目 */
async function upsertEntry(form: EntryFormData, editingId?: string): Promise<void> {
  if (editingId) {
    const index = entries.value.findIndex((e) => e.id === editingId)
    if (index !== -1) {
      entries.value[index] = {
        ...entries.value[index],
        category: form.category,
        name: form.name,
        account: form.account,
        password: form.password,
        description: form.description,
        updatedAt: Date.now(),
      }
    }
  } else {
    entries.value.push({
      id: Date.now().toString(),
      category: form.category,
      name: form.name,
      account: form.account,
      password: form.password,
      description: form.description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }
  await saveEntries()
}

/** 删除条目 */
async function removeEntry(id: string): Promise<void> {
  entries.value = entries.value.filter((e) => e.id !== id)
  await saveEntries()
}

/** 判断条目是否已存在（名称 + 账号 均一致） */
function isEntryDuplicate(data: { name: string, account: string }): boolean {
  if (!data.account) return false
  return entries.value.some((e) => e.name === data.name && e.account === data.account)
}

/** 导出所有数据（明文 JSON） */
function exportAllData(): void {
  if (!entries.value.length) {
    showMessage("没有数据可导出", 2000, "info")
    return
  }
  try {
    const exportData = {
      version: "2.0",
      exportDate: new Date().toISOString(),
      entries: entries.value,
      categories: categories.value,
    }
    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    triggerBlobDownload(blob, `password-vault-backup-${new Date().toISOString().split("T")[0]}.json`)
    showMessage("数据已导出，请妥善保管", 3000, "info")
  } catch (error) {
    console.error("Export failed:", error)
    showMessage("导出失败", 2000, "error")
  }
}

// ============================================================
// composable 入口
// ============================================================

/**
 * 密码箱数据层 composable（单例状态）
 * 父组件首次调用时传入 plugin 完成 Storage 初始化，子组件后续无参调用复用同一状态
 */
export function usePasswordVaultData(plugin?: Plugin) {
  if (plugin && !storage) {
    storage = new PasswordVaultStorage(plugin)
  }

  const storagePath = computed(() => {
    const dataDir = plugin ? (plugin as any).dataDir || "" : ""
    const name = plugin?.name || ""
    return dataDir && name
      ? `${dataDir}/storage/petal/${name}/password-vault-entries.json`
      : `data/storage/petal/{plugin}/password-vault-entries.json`
  })

  return {
    // 状态
    isLoggedIn,
    entries,
    categories,
    categoriesMap,
    storagePath,
    // 数据 CRUD
    loadEntries,
    loadCategories,
    saveEntries,
    saveCategories,
    getCategoryById,
    getCategoryEntryCount,
    addCategory,
    deleteCategory,
    upsertEntry,
    removeEntry,
    isEntryDuplicate,
    // 导出
    exportAllData,
  }
}
