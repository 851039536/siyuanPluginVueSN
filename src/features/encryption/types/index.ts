/**
 * 加密/解密功能模块 - 类型定义与加密工具
 */

import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  deriveAESKey,
} from "@/utils/cryptoPrimitives"

export const CONSTANTS = {
  STORAGE_KEY: "encryption_password.json",
  ENCRYPTED_PATTERN: /^\[encrypted\](.*)\[\/encrypted\]$/,
  ENCRYPTED_WRAPPER: (text: string) => `[encrypted]${text}[/encrypted]`,
  SALT: "siyuan-encryption-salt-v1",
  PBKDF2_ITERATIONS: 100000,
  KEY_LENGTH: 256,
} as const

/**
 * 从密码派生加密密钥
 */
export async function deriveKey(password: string): Promise<CryptoKey> {
  const passwordData = new TextEncoder().encode(password)
  const salt = new TextEncoder().encode(CONSTANTS.SALT)
  return deriveAESKey(passwordData, salt, CONSTANTS.PBKDF2_ITERATIONS, CONSTANTS.KEY_LENGTH)
}

/**
 * 使用 AES-256-GCM 加密算法加密文本
 */
export async function encryptText(
  text: string,
  key: CryptoKey,
): Promise<string> {
  const { iv, ciphertext } = await aesGcmEncrypt(
    new TextEncoder().encode(text),
    key,
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(ciphertext, iv.length)
  return btoa(String.fromCharCode(...combined))
}

/**
 * 使用 AES-256-GCM 加密算法解密文本
 */
export async function decryptText(
  encryptedText: string,
  key: CryptoKey,
): Promise<string> {
  const binary = atob(encryptedText)
  const combined = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    combined[i] = binary.charCodeAt(i)
  }
  const iv = combined.slice(0, 12)
  const encryptedData = combined.slice(12)
  const decrypted = await aesGcmDecrypt(encryptedData, key, iv)
  return new TextDecoder().decode(decrypted)
}