/**
 * 加密/解密功能模块 - 类型定义与加密工具
 */

export const CONSTANTS = {
	STORAGE_KEY: "encryption_password.json",
	ENCRYPTED_PATTERN: /^\[encrypted\](.*)\[\/encrypted\]$/,
	ENCRYPTED_WRAPPER: (text: string) => `[encrypted]${text}[/encrypted]`,
	SALT: "siyuan-encryption-salt-v1",
	IV_LENGTH: 12,
	PBKDF2_ITERATIONS: 100000,
	KEY_LENGTH: 256,
} as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * 从密码派生加密密钥
 */
export async function deriveKey(password: string): Promise<CryptoKey> {
	const passwordData = textEncoder.encode(password);
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		passwordData,
		{ name: "PBKDF2" },
		false,
		["deriveKey"],
	);
	const salt = textEncoder.encode(CONSTANTS.SALT);
	return await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt,
			iterations: CONSTANTS.PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: CONSTANTS.KEY_LENGTH },
		false,
		["encrypt", "decrypt"],
	);
}

/**
 * 使用 AES-256-GCM 加密算法加密文本
 */
export async function encryptText(
	text: string,
	key: CryptoKey,
): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(CONSTANTS.IV_LENGTH));
	const data = textEncoder.encode(text);
	const encryptedData = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		data,
	);
	const combined = new Uint8Array(iv.length + encryptedData.byteLength);
	combined.set(iv, 0);
	combined.set(new Uint8Array(encryptedData), iv.length);
	return btoa(String.fromCharCode(...combined));
}

/**
 * 使用 AES-256-GCM 加密算法解密文本
 */
export async function decryptText(
	encryptedText: string,
	key: CryptoKey,
): Promise<string> {
	const binary = atob(encryptedText);
	const combined = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		combined[i] = binary.charCodeAt(i);
	}
	const iv = combined.slice(0, CONSTANTS.IV_LENGTH);
	const encryptedData = combined.slice(CONSTANTS.IV_LENGTH);
	const decryptedData = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		key,
		encryptedData,
	);
	return textDecoder.decode(decryptedData);
}
