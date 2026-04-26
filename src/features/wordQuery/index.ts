/**
 * 单词查询功能模块
 */
import { Plugin } from "siyuan";
import { WordQueryManager } from "./types";

/**
 * 注册单词查询功能
 */
export function registerWordQuery(plugin: Plugin) {
	const manager = new WordQueryManager(plugin);
	manager.init();
	(plugin as any).__wordQuery = manager;
	return manager;
}

export * from "./types";
