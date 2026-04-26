/**
 * WebDAV数据存储模块
 * 使用 PluginStorage 进行数据持久化
 */
import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";
import type { WebDAVConfig } from "@/config/settings";

const WEBDAV_CONFIG_KEY = "webdav-config";

const DEFAULT_WEBDAV_CONFIG: WebDAVConfig = {
	serverUrl: "",
	username: "",
	password: "",
	basePath: "/",
	autoSync: false,
	syncInterval: 30,
	lastSyncTime: "",
};

/**
 * 同步状态接口
 */
export interface SyncStatus {
	lastSyncTime: string;
	lastSyncResult: "success" | "error" | "none";
	lastSyncMessage: string;
	syncedFiles: number;
}

const SYNC_STATUS_KEY = "webdav-sync-status";

const DEFAULT_SYNC_STATUS: SyncStatus = {
	lastSyncTime: "",
	lastSyncResult: "none",
	lastSyncMessage: "",
	syncedFiles: 0,
};

/**
 * WebDAV存储管理类
 */
export class WebDAVStorage {
	private storage: PluginStorage;

	constructor(plugin: Plugin) {
		this.storage = new PluginStorage(plugin);
	}

	/**
	 * 加载WebDAV配置
	 */
	async loadConfig(): Promise<WebDAVConfig> {
		const data = await this.storage.load<WebDAVConfig>(WEBDAV_CONFIG_KEY);
		if (!data) {
			return { ...DEFAULT_WEBDAV_CONFIG };
		}
		return { ...DEFAULT_WEBDAV_CONFIG, ...data };
	}

	/**
	 * 保存WebDAV配置
	 */
	async saveConfig(config: WebDAVConfig): Promise<boolean> {
		return this.storage.save(WEBDAV_CONFIG_KEY, config);
	}

	/**
	 * 重置WebDAV配置
	 */
	async resetConfig(): Promise<boolean> {
		return this.storage.save(WEBDAV_CONFIG_KEY, DEFAULT_WEBDAV_CONFIG);
	}

	/**
	 * 加载同步状态
	 */
	async loadSyncStatus(): Promise<SyncStatus> {
		const data = await this.storage.load<SyncStatus>(SYNC_STATUS_KEY);
		if (!data) {
			return { ...DEFAULT_SYNC_STATUS };
		}
		return { ...DEFAULT_SYNC_STATUS, ...data };
	}

	/**
	 * 保存同步状态
	 */
	async saveSyncStatus(status: SyncStatus): Promise<boolean> {
		return this.storage.save(SYNC_STATUS_KEY, status);
	}
}
