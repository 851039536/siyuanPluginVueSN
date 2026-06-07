/**
 * 插件配置加密工具
 *
 * 使用 Web Crypto API (AES-GCM + PBKDF2) 对敏感配置字段进行加密存储，
 * 防止 API Key、密码等敏感信息在磁盘上明文暴露。
 *
 * 加密流程：
 *   1. 使用内置应用密钥材料 + 固定盐值通过 PBKDF2 派生 AES-GCM 密钥
 *   2. 对敏感值执行 AES-GCM 加密（每次使用随机 IV）
 *   3. 存储格式为 "enc:base64IV.base64Ciphertext"（enc: 前缀用于区分）
 *
 * 解密流程：
 *   1. 检测 enc: 前缀，若无则视为未加密的旧数据（向后兼容）
 *   2. 提取 IV 和密文，用派生密钥解密
 *   3. 返回原始明文
 *
 * 注意：本方案不依赖外部口令，属于"应用层加密"——密钥材料内置于代码中，
 * 可防止偶然的文件浏览泄露，但无法防御针对源码的反汇编攻击。
 * 更高级的保护（如 keytar/操作系统凭据管理器）需配合 Electron 原生模块使用。
 */

import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  arrayBufferToBase64,
  base64ToUint8Array,
  deriveAESKey,
} from "@/utils/cryptoPrimitives"

const PBKDF2_ITERATIONS = 100000
const ENC_PREFIX = "enc:" // 加密值前缀，用于区分加密值与明文

/** 内置应用盐值（变更此值会导致已有加密数据无法解密） */
const APP_SALT = new TextEncoder().encode("siyuan-plugin-settings-crypto-v1")

/** 缓存派生密钥，避免每次加解密都重新派生 */
let cachedKey: CryptoKey | null = null

/**
 * 派生 AES-GCM 加密密钥
 * 使用 PBKDF2 从内置密钥材料派生，结果缓存在内存中
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey

  const keyMaterial = new TextEncoder().encode("siyuan-plugin-settings-key-v1")
  cachedKey = await deriveAESKey(keyMaterial, APP_SALT, PBKDF2_ITERATIONS)

  return cachedKey
}

/**
 * 加密敏感设置值
 * @param value 明文字符串
 * @returns 加密后的字符串（enc:base64IV.base64Ciphertext 格式），空值原样返回
 */
export async function encryptSetting(value: string): Promise<string> {
  if (!value) return ""

  try {
    const key = await getEncryptionKey()
    const { iv, ciphertext } = await aesGcmEncrypt(
      new TextEncoder().encode(value),
      key,
    )

    return `${ENC_PREFIX + arrayBufferToBase64(iv)}.${arrayBufferToBase64(ciphertext)}`
  } catch (error) {
    console.error("设置加密失败:", error)
    return value
  }
}

/**
 * 解密敏感设置值
 * @param encryptedValue 加密字符串（enc:base64IV.base64Ciphertext 格式）或明文
 * @returns 明文字符串
 */
export async function decryptSetting(encryptedValue: string): Promise<string> {
  if (!encryptedValue) return ""

  if (!encryptedValue.startsWith(ENC_PREFIX)) {
    return encryptedValue
  }

  const withoutPrefix = encryptedValue.slice(ENC_PREFIX.length)
  const dotIndex = withoutPrefix.indexOf(".")
  if (dotIndex === -1) {
    console.warn("加密数据格式异常，缺少分隔符")
    return encryptedValue
  }

  try {
    const key = await getEncryptionKey()
    const iv = base64ToUint8Array(withoutPrefix.slice(0, dotIndex))
    const ciphertext = base64ToUint8Array(withoutPrefix.slice(dotIndex + 1))

    const decrypted = await aesGcmDecrypt(ciphertext, key, iv)
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error("设置解密失败:", error)
    return encryptedValue
  }
}

/**
 * 清除缓存的加密密钥（内存安全）
 * 在插件卸载时调用
 */
export function clearCachedKey(): void {
  cachedKey = null
}
