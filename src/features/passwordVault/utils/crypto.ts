/**
 * 密码保险柜加密工具
 * 使用 AES-GCM 加密算法和 PBKDF2 密钥派生
 */

import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  arrayBufferToBase64,
  base64ToUint8Array,
  deriveAESKey,
  deriveBits,
  generateSalt as generateSaltPrimitive,
} from "@/utils/cryptoPrimitives"

/**
 * 加密配置
 */
const CRYPTO_CONFIG = {
  algorithm: "AES-GCM" as const,
  keyLength: 256,
  pbkdf2Iterations: 100000,
  saltLength: 16,
  ivLength: 12,
}

/**
 * 生成随机盐值
 */
export function generateSalt(): string {
  return arrayBufferToBase64(generateSaltPrimitive(CRYPTO_CONFIG.saltLength))
}

/**
 * 从主密码派生加密密钥
 * @param masterPassword 主密码
 * @param salt 盐值 (Base64)
 */
export async function deriveKey(
  masterPassword: string,
  salt: string,
): Promise<CryptoKey> {
  const passwordData = new TextEncoder().encode(masterPassword)
  const saltData = base64ToUint8Array(salt)
  return deriveAESKey(
    passwordData,
    saltData,
    CRYPTO_CONFIG.pbkdf2Iterations,
    CRYPTO_CONFIG.keyLength,
    ["encrypt", "decrypt"],
  )
}

/**
 * 加密密码文本
 * @param password 明文密码
 * @param key 加密密钥
 * @returns 包含加密数据和 IV 的对象
 */
export async function encryptPassword(
  password: string,
  key: CryptoKey,
): Promise<{ encryptedData: string, iv: string }> {
  const { iv, ciphertext } = await aesGcmEncrypt(
    new TextEncoder().encode(password),
    key,
  )

  return {
    encryptedData: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
  }
}

/**
 * 解密密码文本
 * @param encryptedData 加密的数据 (Base64)
 * @param iv 初始化向量 (Base64)
 * @param key 解密密钥
 * @returns 明文密码
 */
export async function decryptPassword(
  encryptedData: string,
  iv: string,
  key: CryptoKey,
): Promise<string> {
  const data = base64ToUint8Array(encryptedData)
  const ivData = base64ToUint8Array(iv)
  const decrypted = await aesGcmDecrypt(data, key, ivData)
  return new TextDecoder().decode(decrypted)
}

/**
 * 生成主密码哈希（用于验证）
 * 使用 PBKDF2 + 固定盐值生成验证哈希
 * @param masterPassword 主密码
 * @param verifySalt 固定的验证盐值
 */
export async function hashMasterPassword(
  masterPassword: string,
  verifySalt: string,
): Promise<string> {
  const passwordData = new TextEncoder().encode(masterPassword)
  const saltData = base64ToUint8Array(verifySalt)
  const derivedBits = await deriveBits(
    passwordData,
    saltData,
    CRYPTO_CONFIG.pbkdf2Iterations,
    256,
  )
  return arrayBufferToBase64(derivedBits)
}