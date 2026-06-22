import {
  arrayBufferToBase64,
  base64ToUint8Array,
  deriveBits,
  generateSalt,
} from "@/utils/cryptoPrimitives"

const SALT_LENGTH = 16
const ITERATIONS = 100_000
const BIT_LENGTH = 256

export interface PasswordHashResult {
  hash: string
  salt: string
}

/**
 * 使用 PBKDF2 对密码进行哈希
 * @param password 明文密码
 * @param salt 盐值（可选，用于验证时传入已知盐值）
 * @returns 哈希值 + 盐值的 Base64 表示
 */
export async function hashPassword(
  password: string,
  salt?: Uint8Array,
): Promise<PasswordHashResult> {
  const actualSalt = salt ?? generateSalt(SALT_LENGTH)
  const encoder = new TextEncoder()
  const keyMaterial = encoder.encode(password)
  const derived = await deriveBits(keyMaterial, actualSalt, ITERATIONS, BIT_LENGTH)
  const hashHex = Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return {
    hash: hashHex,
    salt: arrayBufferToBase64(actualSalt),
  }
}

/**
 * 验证密码是否与存储的哈希匹配
 */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  const saltBytes = base64ToUint8Array(salt)
  const result = await hashPassword(password, saltBytes)
  return result.hash === hash
}
