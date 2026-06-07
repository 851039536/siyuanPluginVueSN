/**
 * AES-GCM + PBKDF2 加密基元
 *
 * 统一 settingsCrypto、encryption、passwordVault 三个模块的通用加密操作。
 * 各模块保留自己的密钥派生策略和序列化格式，仅共享底层原语。
 */

const AES_GCM = "AES-GCM" as const
const IV_LENGTH = 12

/**
 * ArrayBuffer 转 Base64 字符串
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Base64 字符串转 Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * 生成随机 IV（12 字节，AES-GCM 推荐）
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

/**
 * 生成随机盐值
 * @param length 盐值字节长度，默认 16
 */
export function generateSalt(length: number = 16): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * 使用 PBKDF2 派生 AES-GCM 密钥
 * @param keyMaterial 密钥材料（原始字节）
 * @param salt 盐值
 * @param iterations 迭代次数，默认 100000
 * @param keyLength 密钥长度（位），默认 256
 * @param usages 密钥用途，默认 ["encrypt", "decrypt"]
 */
export async function deriveAESKey(
  keyMaterial: Uint8Array,
  salt: Uint8Array,
  iterations: number = 100000,
  keyLength: number = 256,
  usages: KeyUsage[] = ["encrypt", "decrypt"],
): Promise<CryptoKey> {
  const imported = await crypto.subtle.importKey(
    "raw",
    keyMaterial as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    imported,
    { name: AES_GCM, length: keyLength },
    false,
    usages as KeyUsage[],
  )
}

/**
 * 使用 PBKDF2 派生密钥比特（用于哈希验证等场景）
 */
export async function deriveBits(
  keyMaterial: Uint8Array,
  salt: Uint8Array,
  iterations: number = 100000,
  bitLength: number = 256,
): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey(
    "raw",
    keyMaterial as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  )

  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    imported,
    bitLength,
  )
}

/**
 * AES-GCM 加密
 * @param data 明文字节数据
 * @param key AES-GCM 密钥
 * @param iv 初始化向量（默认随机生成）
 * @returns IV + 密文的 Uint8Array
 */
export async function aesGcmEncrypt(
  data: Uint8Array,
  key: CryptoKey,
  iv?: Uint8Array,
): Promise<{ iv: Uint8Array, ciphertext: Uint8Array }> {
  const actualIV = iv ?? generateIV()
  const encrypted = await crypto.subtle.encrypt(
    { name: AES_GCM, iv: actualIV as BufferSource },
    key,
    data as BufferSource,
  )
  return { iv: new Uint8Array(encrypted as ArrayBufferLike), ciphertext: new Uint8Array(encrypted) }
}

/**
 * AES-GCM 解密
 */
export async function aesGcmDecrypt(
  ciphertext: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    { name: AES_GCM, iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  )
  return new Uint8Array(decrypted)
}