/**
 * WebDAV数据存储模块
 * 使用 PluginStorage 进行数据持久化
 */
import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";
import { TypedStorage } from "@/utils/typedStorage";
import type { WebDAVConfig } from "@/config/settings";

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
	readonly config: TypedStorage<WebDAVConfig>;
	readonly syncStatus: TypedStorage<SyncStatus>;

	constructor(plugin: Plugin) {
		const storage = new PluginStorage(plugin);
		this.config = new TypedStorage(storage, "webdav-config", DEFAULT_WEBDAV_CONFIG);
		this.syncStatus = new TypedStorage(storage, "webdav-sync-status", DEFAULT_SYNC_STATUS);
	}

	/**
	 * 重置WebDAV配置
	 */
	async resetConfig(): Promise<boolean> {
		return this.config.save(DEFAULT_WEBDAV_CONFIG);
	}
}
