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

const ALGORITHM = "AES-GCM" as const;
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 100000;
const IV_LENGTH = 12; // AES-GCM 推荐 IV 长度
const ENC_PREFIX = "enc:"; // 加密值前缀，用于区分加密值与明文

/** 内置应用盐值（变更此值会导致已有加密数据无法解密） */
const APP_SALT = "siyuan-plugin-settings-crypto-v1";

/** 缓存派生密钥，避免每次加解密都重新派生 */
let cachedKey: CryptoKey | null = null;

/**
 * ArrayBuffer 转 Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 转 Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 派生 AES-GCM 加密密钥
 * 使用 PBKDF2 从内置密钥材料派生，结果缓存在内存中
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode("siyuan-plugin-settings-key-v1");
  const salt = encoder.encode(APP_SALT);

  const pkcsKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    pkcsKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );

  return cachedKey;
}

/**
 * 加密敏感设置值
 * @param value 明文字符串
 * @returns 加密后的字符串（enc:base64IV.base64Ciphertext 格式），空值原样返回
 */
export async function encryptSetting(value: string): Promise<string> {
  if (!value) return "";

  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoder = new TextEncoder();
    const data = encoder.encode(value);

    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      data,
    );

    return ENC_PREFIX + arrayBufferToBase64(iv) + "." + arrayBufferToBase64(encrypted);
  } catch (error) {
    console.error("设置加密失败:", error);
    // 加密失败时回退到明文（避免用户配置丢失）
    return value;
  }
}

/**
 * 解密敏感设置值
 * @param encryptedValue 加密字符串（enc:base64IV.base64Ciphertext 格式）或明文
 * @returns 明文字符串
 */
export async function decryptSetting(encryptedValue: string): Promise<string> {
  if (!encryptedValue) return "";

  // 没有前缀 → 未加密的旧数据，直接返回（向后兼容）
  if (!encryptedValue.startsWith(ENC_PREFIX)) {
    return encryptedValue;
  }

  const withoutPrefix = encryptedValue.slice(ENC_PREFIX.length);
  const dotIndex = withoutPrefix.indexOf(".");
  if (dotIndex === -1) {
    console.warn("加密数据格式异常，缺少分隔符");
    return encryptedValue;
  }

  const ivBase64 = withoutPrefix.slice(0, dotIndex);
  const dataBase64 = withoutPrefix.slice(dotIndex + 1);

  try {
    const key = await getEncryptionKey();
    const iv = base64ToUint8Array(ivBase64);
    const encrypted = base64ToUint8Array(dataBase64);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted,
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("设置解密失败:", error);
    // 解密失败时返回原值（不影响启动流程）
    return encryptedValue;
  }
}

/**
 * 清除缓存的加密密钥（内存安全）
 * 在插件卸载时调用
 */
export function clearCachedKey(): void {
  cachedKey = null;
}
