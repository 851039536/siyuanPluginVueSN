/**
 * AI内容生成器数据存储管理
 */
import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";
import type { SavedPrompt } from "@/types/ai";

export type { SavedPrompt };

/**
 * AI内容生成器存储管理器
 */
export class AIGeneratorStorage {
	private storage: PluginStorage;
	private readonly SETTINGS_STORAGE_KEY = "ai-content-generator-settings";
	private readonly PROMPTS_STORAGE_KEY = "ai-content-generator-prompts";
	private readonly CURRENT_PROMPT_STORAGE_KEY =
		"ai-content-generator-current-prompt";

	constructor(plugin: Plugin) {
		this.storage = new PluginStorage(plugin);
	}

	async saveSettings(settings: {
		systemPrompt: string;
		temperature: number;
		maxTokens: number;
		contextMessageLimit: number;
	}): Promise<boolean> {
		return this.storage.save(this.SETTINGS_STORAGE_KEY, settings);
	}

	async loadSettings(): Promise<{
		systemPrompt: string;
		temperature: number;
		maxTokens: number;
		contextMessageLimit: number;
	} | null> {
		return this.storage.load(this.SETTINGS_STORAGE_KEY);
	}

	async savePrompts(prompts: SavedPrompt[]): Promise<boolean> {
		return this.storage.save(this.PROMPTS_STORAGE_KEY, prompts);
	}

	async loadPrompts(): Promise<SavedPrompt[]> {
		return this.storage.loadWithDefault<SavedPrompt[]>(
			this.PROMPTS_STORAGE_KEY,
			[],
		);
	}

	async saveCurrentPrompt(promptName: string): Promise<boolean> {
		return this.storage.save(this.CURRENT_PROMPT_STORAGE_KEY, promptName);
	}

	async loadCurrentPrompt(): Promise<string | null> {
		return this.storage.load<string>(this.CURRENT_PROMPT_STORAGE_KEY);
	}

	async clearCurrentPrompt(): Promise<boolean> {
		return this.storage.remove(this.CURRENT_PROMPT_STORAGE_KEY);
	}

	async init(): Promise<void> {
		try {
			const settings = await this.loadSettings();
			if (!settings) {
				await this.saveSettings({
					systemPrompt: "",
					temperature: 0.7,
					maxTokens: 10000,
					contextMessageLimit: 5,
				});
			}

			const prompts = await this.loadPrompts();
			if (!prompts) {
				await this.savePrompts([]);
			}
		} catch (error) {
			console.error("初始化AI生成器存储失败:", error);
		}
	}
}
