/**
 * 密码箱存储管理
 */
import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";
import { TypedStorage } from "@/utils/typedStorage";
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
  readonly masterPassword: TypedStorage<string>;
  readonly verifySalt: TypedStorage<string>;
  readonly encryptionSalt: TypedStorage<string>;
  readonly passwordHint: TypedStorage<string>;
  readonly entries: TypedStorage<StoredPasswordEntry[]>;
  readonly categories: TypedStorage<PasswordCategory[]>;

  private storage: PluginStorage;

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin);
    this.masterPassword = new TypedStorage(this.storage, STORAGE_KEYS.MASTER_PASSWORD);
    this.verifySalt = new TypedStorage(this.storage, STORAGE_KEYS.VERIFY_SALT);
    this.encryptionSalt = new TypedStorage(this.storage, STORAGE_KEYS.ENCRYPTION_SALT);
    this.passwordHint = new TypedStorage(this.storage, STORAGE_KEYS.PASSWORD_HINT);
    this.entries = new TypedStorage(this.storage, STORAGE_KEYS.ENTRIES);
    this.categories = new TypedStorage(this.storage, STORAGE_KEYS.CATEGORIES);
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
      this.masterPassword.save(data.hash),
      this.verifySalt.save(data.verifySalt),
      this.encryptionSalt.save(data.encryptionSalt),
      data.hint ? this.passwordHint.save(data.hint) : Promise.resolve(true),
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
      this.masterPassword.load(),
      this.verifySalt.load(),
      this.encryptionSalt.load(),
      this.passwordHint.load(),
    ]);

    return { hash, verifySalt, encryptionSalt, hint };
  }

  /**
   * 检查是否已设置主密码
   */
  async hasMasterPassword(): Promise<boolean> {
    const hash = await this.masterPassword.load();
    return !!hash;
  }

  /**
   * 清除所有数据
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.masterPassword.remove(),
      this.verifySalt.remove(),
      this.encryptionSalt.remove(),
      this.entries.remove(),
      this.categories.remove(),
      this.passwordHint.remove(),
    ]);
  }
}
