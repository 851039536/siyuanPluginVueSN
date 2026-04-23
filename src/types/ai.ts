/**
 * AI 相关的统一类型定义
 * 消除项目中多处重复的接口定义
 */

/** API 供应商类型 */
export type AiProvider = "tongyi" | "openai" | "deepseek" | "custom";

/** AI API 配置接口（统一） */
export interface AiApiConfig {
	provider: AiProvider;
	model: string;
	apiKey: string;
	customEndpoint: string;
}

/** AI API 调用选项 */
export interface AiCallOptions {
	systemPrompt?: string;
	temperature?: number;
	maxTokens?: number;
	signal?: AbortSignal;
	onChunk?: (chunk: string) => void;
}

/** AI 生成选项接口（用于 AIContentGenerator） */
export interface GenerateOptions {
	userInput: string;
	systemPrompt: string;
	temperature: number;
	maxTokens: number;
	context?: string;
	signal?: AbortSignal;
	onChunk?: (chunk: string) => void;
}

/** 目标文档接口 */
export interface TargetDoc {
	id: string;
	title: string;
	content: string;
	isBlock?: boolean;
}

/** AI 提示词配置接口 */
export interface SavedPrompt {
	id: string;
	name: string;
	systemPrompt: string;
	temperature: number;
	maxTokens: number;
	createdAt: number;
}
