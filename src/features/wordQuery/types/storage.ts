import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";

export interface WordQuerySettings {
	pronunciationType: "uk" | "us";
	autoPlayPronunciation: boolean;
	showRelatedWords: boolean;
}

const DEFAULT_SETTINGS: WordQuerySettings = {
	pronunciationType: "uk",
	autoPlayPronunciation: false,
	showRelatedWords: true,
};

export class WordQueryStorage {
	private storage: PluginStorage;
	private readonly SETTINGS_KEY = "word-query-settings";

	constructor(plugin: Plugin) {
		this.storage = new PluginStorage(plugin);
	}

	async saveSettings(settings: WordQuerySettings): Promise<boolean> {
		return this.storage.save(this.SETTINGS_KEY, settings);
	}

	async loadSettings(): Promise<WordQuerySettings> {
		const saved = await this.storage.load<WordQuerySettings>(this.SETTINGS_KEY);
		return saved || DEFAULT_SETTINGS;
	}

	async init(): Promise<void> {
		const settings = await this.loadSettings();
		if (!settings) {
			await this.saveSettings(DEFAULT_SETTINGS);
		}
	}
}
