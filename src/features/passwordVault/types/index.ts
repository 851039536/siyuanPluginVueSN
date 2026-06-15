/**
 * 密码箱类型定义 — 仅包含类型和 Manager 类，不放运行时逻辑
 */

// ============================================================
// 类型定义
// ============================================================

/**
 * 运行时密码条目（密码已解密，仅在内存中）
 */
export interface PasswordEntry {
  id: string // 唯一标识
  category: string // 类别
  name: string // 名称
  account: string // 账号
  password: string // 密码（明文，仅在登录后存在于内存）
  description: string // 描述
  createdAt: number // 创建时间
  updatedAt: number // 更新时间
}

/**
 * 存储的加密密码条目（持久化存储 - v2 新格式）
 * 所有敏感字段整体加密，name/account/description 不再明文泄露
 */
export interface StoredPasswordEntry {
  id: string // 明文 — 唯一标识
  category: string // 明文 — 分类筛选需要
  encryptedPayload: string // Base64 — AES-GCM({ name, account, password, description })
  iv: string // 初始化向量 (Base64)
  createdAt: number // 明文
  updatedAt: number // 明文
  version?: number // 数据格式版本（2=新格式）
}

/**
 * 旧格式条目（v1，仅 password 字段加密）
 * 用于自动迁移检测，loadEntries 遇到此格式会自动升级
 */
export interface LegacyStoredPasswordEntry {
  id: string
  category: string
  name: string
  account: string
  encryptedPassword: string
  iv: string
  description: string
  createdAt: number
  updatedAt: number
}

/**
 * 密码分类
 */
export interface PasswordCategory {
  id: string // 分类ID
  name: string // 分类名称
  color: string // 分类颜色
}

/**
 * 密码提示设置
 */
export interface PasswordHint {
  hint: string // 密码提示文本
}

// 导出存储管理
export {
  PasswordVaultStorage,
  STORAGE_KEYS,
} from "./storage"
