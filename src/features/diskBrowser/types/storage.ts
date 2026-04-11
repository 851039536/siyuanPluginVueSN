import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";
import { DiskBrowserSettings, STORAGE_KEY } from "./index";

export class DiskBrowserStorage {
	private storage: PluginStorage;

	constructor(plugin: Plugin) {
		this.storage = new PluginStorage(plugin);
	}

	async saveSettings(settings: DiskBrowserSettings): Promise<boolean> {
		return this.storage.save(STORAGE_KEY, settings);
	}

	async loadSettings(): Promise<DiskBrowserSettings | null> {
		return this.storage.load<DiskBrowserSettings>(STORAGE_KEY);
	}

	async loadFavorites(): Promise<string[]> {
		const settings = await this.storage.loadWithDefault<DiskBrowserSettings>(
			STORAGE_KEY,
			{ favoriteFolders: [] },
		);
		return settings.favoriteFolders;
	}

	async saveFavorites(favorites: string[]): Promise<boolean> {
		const settings: DiskBrowserSettings = { favoriteFolders: favorites };
		return this.storage.save(STORAGE_KEY, settings);
	}

	async init(): Promise<void> {
		try {
			const settings = await this.loadSettings();
			if (!settings) {
				const defaultSettings: DiskBrowserSettings = {
					favoriteFolders: [],
				};
				await this.saveSettings(defaultSettings);
			}
		} catch (error) {
			console.error("初始化磁盘浏览器存储失败:", error);
		}
	}
}
