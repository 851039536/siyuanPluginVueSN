/**
 * AI内容生成功能模块
 */
import { Plugin } from "siyuan";
import { AIContentGenerator } from "./types";

/**
 * 注册AI内容生成模块
 */
export function registerAIContentGenerator(plugin: Plugin) {
	const generator = new AIContentGenerator(plugin);
	generator.init();

	(plugin as any).__aiContentGenerator = generator;

	return generator;
}

export * from "./types";
