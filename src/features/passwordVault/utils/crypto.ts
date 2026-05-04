/**
 * 密码保险柜加密工具
 * 使用 AES-GCM 加密算法和 PBKDF2 密钥派生
 */

/**
 * 加密配置
 */
const CRYPTO_CONFIG = {
  algorithm: "AES-GCM",
  keyLength: 256,
  pbkdf2Iterations: 100000,
  saltLength: 16,
  ivLength: 12,
} as const

/**
 * 生成随机盐值
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.saltLength))
}

/**
 * 生成随机 IV (初始化向量)
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.ivLength))
}

/**
 * ArrayBuffer 转 Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Base64 转 Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
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
  const encoder = new TextEncoder()
  const passwordData = encoder.encode(masterPassword)
  const saltData = base64ToUint8Array(salt)

  // 导入密码作为密钥材料
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordData,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  )

  // 派生 AES-GCM 密钥
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltData,
      iterations: CRYPTO_CONFIG.pbkdf2Iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: CRYPTO_CONFIG.algorithm,
      length: CRYPTO_CONFIG.keyLength,
    },
    false,
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
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const iv = generateIV()

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: CRYPTO_CONFIG.algorithm,
      iv,
    },
    key,
    data,
  )

  return {
    encryptedData: arrayBufferToBase64(encryptedData),
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

  const decryptedData = await crypto.subtle.decrypt(
    {
      name: CRYPTO_CONFIG.algorithm,
      iv: ivData,
    },
    key,
    data,
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedData)
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
  const encoder = new TextEncoder()
  const passwordData = encoder.encode(masterPassword)
  const saltData = base64ToUint8Array(verifySalt)

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordData,
    "PBKDF2",
    false,
    ["deriveBits"],
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltData,
      iterations: CRYPTO_CONFIG.pbkdf2Iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  )

  return arrayBufferToBase64(derivedBits)
}

/**
 * 生成初始验证盐值
 * 在首次设置主密码时调用
 */
export function generateVerifySalt(): string {
  return arrayBufferToBase64(generateSalt())
}
