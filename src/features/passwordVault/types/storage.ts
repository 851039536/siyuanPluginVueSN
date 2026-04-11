/**
 * 密码箱存储管理
 */
import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";
import type { PasswordCategory, StoredPasswordEntry } from "./index";

/**
 * 密码箱存储数据结构
 */
export interface PasswordVaultData {
	masterPasswordHash: string;
	verifySalt: string;
	encryptionSalt: string;
	passwordHint: string;
	entries: StoredPasswordEntry[];
	categories: PasswordCategory[];
}

/**
 * 存储键常量
 */
export const STORAGE_KEYS = {
	MASTER_PASSWORD: "password-vault-master-password",
	VERIFY_SALT: "password-vault-verify-salt",
	ENCRYPTION_SALT: "password-vault-encryption-salt",
	ENTRIES: "password-vault-entries",
	CATEGORIES: "password-vault-categories",
	PASSWORD_HINT: "password-vault-hint",
} as const;

/**
 * 密码箱存储管理类
 */
export class PasswordVaultStorage {
	private storage: PluginStorage;

	constructor(plugin: Plugin) {
		this.storage = new PluginStorage(plugin);
	}

	/**
	 * 保存主密码哈希
	 */
	async saveMasterPasswordHash(hash: string): Promise<boolean> {
		return this.storage.save(STORAGE_KEYS.MASTER_PASSWORD, hash);
	}

	/**
	 * 加载主密码哈希
	 */
	async loadMasterPasswordHash(): Promise<string | null> {
		return this.storage.load<string>(STORAGE_KEYS.MASTER_PASSWORD);
	}

	/**
	 * 保存验证盐值
	 */
	async saveVerifySalt(salt: string): Promise<boolean> {
		return this.storage.save(STORAGE_KEYS.VERIFY_SALT, salt);
	}

	/**
	 * 加载验证盐值
	 */
	async loadVerifySalt(): Promise<string | null> {
		return this.storage.load<string>(STORAGE_KEYS.VERIFY_SALT);
	}

	/**
	 * 保存加密盐值
	 */
	async saveEncryptionSalt(salt: string): Promise<boolean> {
		return this.storage.save(STORAGE_KEYS.ENCRYPTION_SALT, salt);
	}

	/**
	 * 加载加密盐值
	 */
	async loadEncryptionSalt(): Promise<string | null> {
		return this.storage.load<string>(STORAGE_KEYS.ENCRYPTION_SALT);
	}

	/**
	 * 保存密码提示
	 */
	async savePasswordHint(hint: string): Promise<boolean> {
		return this.storage.save(STORAGE_KEYS.PASSWORD_HINT, hint);
	}

	/**
	 * 加载密码提示
	 */
	async loadPasswordHint(): Promise<string | null> {
		return this.storage.load<string>(STORAGE_KEYS.PASSWORD_HINT);
	}

	/**
	 * 保存密码条目
	 */
	async saveEntries(entries: StoredPasswordEntry[]): Promise<boolean> {
		return this.storage.save(STORAGE_KEYS.ENTRIES, entries);
	}

	/**
	 * 加载密码条目
	 */
	async loadEntries(): Promise<StoredPasswordEntry[] | null> {
		return this.storage.load<StoredPasswordEntry[]>(STORAGE_KEYS.ENTRIES);
	}

	/**
	 * 保存分类
	 */
	async saveCategories(categories: PasswordCategory[]): Promise<boolean> {
		return this.storage.save(STORAGE_KEYS.CATEGORIES, categories);
	}

	/**
	 * 加载分类
	 */
	async loadCategories(): Promise<PasswordCategory[] | null> {
		return this.storage.load<PasswordCategory[]>(STORAGE_KEYS.CATEGORIES);
	}

	/**
	 * 批量保存初始化数据
	 */
	async saveInitData(data: {
		hash: string;
		verifySalt: string;
		encryptionSalt: string;
		hint?: string;
	}): Promise<void> {
		await Promise.all([
			this.saveMasterPasswordHash(data.hash),
			this.saveVerifySalt(data.verifySalt),
			this.saveEncryptionSalt(data.encryptionSalt),
			data.hint ? this.savePasswordHint(data.hint) : Promise.resolve(true),
		]);
	}

	/**
	 * 加载所有验证数据
	 */
	async loadVerificationData(): Promise<{
		hash: string | null;
		verifySalt: string | null;
		encryptionSalt: string | null;
		hint: string | null;
	}> {
		const [hash, verifySalt, encryptionSalt, hint] = await Promise.all([
			this.loadMasterPasswordHash(),
			this.loadVerifySalt(),
			this.loadEncryptionSalt(),
			this.loadPasswordHint(),
		]);

		return { hash, verifySalt, encryptionSalt, hint };
	}

	/**
	 * 检查是否已设置主密码
	 */
	async hasMasterPassword(): Promise<boolean> {
		const hash = await this.loadMasterPasswordHash();
		return !!hash;
	}

	/**
	 * 清除所有数据
	 */
	async clearAll(): Promise<void> {
		await Promise.all([
			this.storage.remove(STORAGE_KEYS.MASTER_PASSWORD),
			this.storage.remove(STORAGE_KEYS.VERIFY_SALT),
			this.storage.remove(STORAGE_KEYS.ENCRYPTION_SALT),
			this.storage.remove(STORAGE_KEYS.ENTRIES),
			this.storage.remove(STORAGE_KEYS.CATEGORIES),
			this.storage.remove(STORAGE_KEYS.PASSWORD_HINT),
		]);
	}
}
