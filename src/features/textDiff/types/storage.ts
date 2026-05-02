import { Plugin } from "siyuan";
import { PluginStorage } from "@/utils/pluginStorage";
import { TypedStorage } from "@/utils/typedStorage";

/**
 * 文本对比设置接口
 */
export interface TextDiffSettings {
	fontSize: number; // 字体大小
	diffMode: "split" | "unified"; // 显示模式：分栏或统一
	theme: "light" | "dark"; // 主题：浅色或深色
}

/**
 * 默认文本对比设置
 */
export const DEFAULT_TEXTDIFF_SETTINGS: TextDiffSettings = {
	fontSize: 14,
	diffMode: "split",
	theme: "light",
};

/**
 * 文本对比存储管理类
 */
export class TextDiffStorage {
	readonly settings: TypedStorage<TextDiffSettings>;

	constructor(plugin: Plugin) {
		const storage = new PluginStorage(plugin);
		this.settings = new TypedStorage(storage, "textdiff-settings", DEFAULT_TEXTDIFF_SETTINGS);
	}
}
