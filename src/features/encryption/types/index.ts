/**
 * 加密/解密功能模块 - 类型定义与加密工具
 */

import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  arrayBufferToBase64,
  base64ToUint8Array,
  deriveAESKey,
} from "@/utils/cryptoPrimitives"

const SALT = "siyuan-encryption-salt-v1"

export const CONSTANTS = {
  ENCRYPTED_PATTERN: /^\[encrypted\](.*)\[\/encrypted\]$/,
  ENCRYPTED_WRAPPER: (text: string) => `[encrypted]${text}[/encrypted]`,
} as const

/**
 * 从密码派生加密密钥
 */
export async function deriveKey(password: string): Promise<CryptoKey> {
  const passwordData = new TextEncoder().encode(password)
  const salt = new TextEncoder().encode(SALT)
  return deriveAESKey(passwordData, salt)
}

/**
 * 使用 AES-256-GCM 加密算法加密文本
 */
export async function encryptText(
  text: string,
  key: CryptoKey,
): Promise<string> {
  const {
    iv,
    ciphertext,
  } = await aesGcmEncrypt(
    new TextEncoder().encode(text),
    key,
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(ciphertext, iv.length)
  return arrayBufferToBase64(combined)
}

/**
 * 使用 AES-256-GCM 加密算法解密文本
 */
export async function decryptText(
  encryptedText: string,
  key: CryptoKey,
): Promise<string> {
  // IV 固定为 AES-GCM 标准 12 字节（与 cryptoPrimitives.generateIV 一致）
  const IV_LENGTH = 12
  const combined = base64ToUint8Array(encryptedText)
  const iv = combined.slice(0, IV_LENGTH)
  const encryptedData = combined.slice(IV_LENGTH)
  const decrypted = await aesGcmDecrypt(encryptedData, key, iv)
  return new TextDecoder().decode(decrypted)
}
