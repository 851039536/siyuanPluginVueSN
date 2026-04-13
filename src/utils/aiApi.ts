/**
 * 统一 AI API 模块
 * 基于 wordQuery/utils/apiBase.ts 扩展，增加流式输出支持
 * 所有功能模块统一调用此模块，消除重复的 API 调用逻辑
 */
import type { AiApiConfig, AiProvider, AiCallOptions } from "@/types/ai";

// 重新导出类型，方便外部直接从本模块导入
export type { AiApiConfig, AiCallOptions } from "@/types/ai";

// ============ Provider 配置 ============

interface ProviderConfig {
	url: string;
	defaultModel: string;
}

const API_PROVIDERS: Record<AiProvider, ProviderConfig> = {
	tongyi: {
		url: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
		defaultModel: "qwen-plus",
	},
	openai: {
		url: "https://api.openai.com/v1/chat/completions",
		defaultModel: "gpt-3.5-turbo",
	},
	deepseek: {
		url: "https://api.deepseek.com/v1/chat/completions",
		defaultModel: "deepseek-chat",
	},
	custom: {
		url: "",
		defaultModel: "default",
	},
};

// ============ 工具函数 ============

/**
 * 从 API 响应中提取文本内容（统一响应解析）
 */
export function extractResponseText(data: any): string {
	const possiblePaths = [
		() => data.output?.text,
		() => data.output?.choices?.[0]?.message?.content,
		() => data.choices?.[0]?.message?.content,
		() => data.text,
		() => data.content,
	];

	for (const getText of possiblePaths) {
		const text = getText();
		if (text) return text;
	}

	throw new Error("API返回数据格式错误");
}

/**
 * 获取解析后的 provider key（custom 映射到 openai 格式）
 */
function resolveProvider(provider: AiProvider): AiProvider {
	return provider === "custom" ? "openai" : provider;
}

/**
 * 获取 API URL
 */
function getApiUrl(config: AiApiConfig, providerConfig: ProviderConfig): string {
	const url =
		config.provider === "custom" ? config.customEndpoint : providerConfig.url;
	if (!url) {
		throw new Error("API端点未设置");
	}
	return url;
}

/**
 * 构建请求体（区分通义和 OpenAI 格式）
 */
function buildRequestBody(
	provider: AiProvider,
	model: string,
	messages: Array<{ role: string; content: string }>,
	temperature: number,
	maxTokens: number,
	stream: boolean = false,
): any {
	const resolvedProvider = resolveProvider(provider);

	if (resolvedProvider === "tongyi") {
		return {
			model,
			input: { messages },
			parameters: {
				temperature,
				top_p: 0.8,
				max_tokens: maxTokens,
				...(stream
					? { incremental_output: true, result_format: "message" }
					: {}),
			},
		};
	}

	// OpenAI / DeepSeek / Custom 格式
	return {
		model,
		messages,
		temperature,
		max_tokens: maxTokens,
		...(stream ? { stream: true } : {}),
	};
}

/**
 * 构建请求头
 */
function buildHeaders(
	apiKey: string,
	provider: AiProvider,
	stream: boolean = false,
): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Authorization: `Bearer ${apiKey}`,
	};

	// 通义千问流式需要 SSE header
	if (stream && resolveProvider(provider) === "tongyi") {
		headers["X-DashScope-SSE"] = "enable";
	}

	return headers;
}

// ============ 流式解析 ============

/**
 * 解析通义千问 SSE 流数据
 */
async function parseTongyiStream(
	response: Response,
	onChunk: (chunk: string) => void,
	signal?: AbortSignal,
): Promise<string> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("无法读取响应流");

	const decoder = new TextDecoder("utf-8");
	let fullContent = "";
	let buffer = "";

	try {
		while (true) {
			if (signal?.aborted) break;

			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (!line.trim() || !line.startsWith("data:")) continue;

				const data = line.slice(5).trim();
				if (data === "[DONE]") continue;

				try {
					const json = JSON.parse(data);
					let content = "";
					if (json.output?.choices?.[0]?.message?.content) {
						content = json.output.choices[0].message.content;
					} else if (json.output?.text) {
						content = json.output.text;
					}

					if (content) {
						onChunk(content);
						fullContent += content;
					}
				} catch {
					// 忽略解析错误的行
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	return fullContent;
}

/**
 * 解析 OpenAI/DeepSeek SSE 流数据
 */
async function parseOpenAIStream(
	response: Response,
	onChunk: (chunk: string) => void,
	signal?: AbortSignal,
): Promise<string> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("无法读取响应流");

	const decoder = new TextDecoder("utf-8");
	let fullContent = "";
	let buffer = "";

	try {
		while (true) {
			if (signal?.aborted) break;

			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (!line.trim()) continue;

				let dataStr = line;
				if (line.startsWith("data:")) {
					dataStr = line.slice(5).trim();
				}

				if (dataStr === "[DONE]") continue;

				try {
					const json = JSON.parse(dataStr);
					const content = json.choices?.[0]?.delta?.content;

					if (content) {
						onChunk(content);
						fullContent += content;
					}
				} catch {
					// 忽略解析错误的行
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	return fullContent;
}

// ============ 核心调用函数 ============

/**
 * 统一 AI API 调用（非流式）
 */
export async function callAI(
	prompt: string,
	config: AiApiConfig,
	options?: AiCallOptions,
): Promise<string> {
	const providerConfig = API_PROVIDERS[config.provider];
	if (!providerConfig) {
		throw new Error(`不支持的API供应商: ${config.provider}`);
	}

	const apiUrl = getApiUrl(config, providerConfig);

	if (!config.apiKey) {
		throw new Error("请先在超级面板中配置API密钥");
	}

	const model = config.model || providerConfig.defaultModel;
	const temperature = options?.temperature ?? 0.7;
	const maxTokens = options?.maxTokens ?? 800;

	const messages = [
		{
			role: "system",
			content: options?.systemPrompt || "你是一个专业的AI助手。",
		},
		{ role: "user", content: prompt },
	];

	const requestBody = buildRequestBody(
		config.provider,
		model,
		messages,
		temperature,
		maxTokens,
	);

	const headers = buildHeaders(config.apiKey, config.provider);

	const response = await fetch(apiUrl, {
		method: "POST",
		headers,
		body: JSON.stringify(requestBody),
		signal: options?.signal,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API请求失败: ${response.status} ${errorText}`);
	}

	const data = await response.json();
	return extractResponseText(data);
}

/**
 * 统一 AI API 调用（流式输出）
 */
export async function callAIStream(
	prompt: string,
	config: AiApiConfig,
	onChunk: (chunk: string) => void,
	options?: Omit<AiCallOptions, "onChunk">,
): Promise<string> {
	const providerConfig = API_PROVIDERS[config.provider];
	if (!providerConfig) {
		throw new Error(`不支持的API供应商: ${config.provider}`);
	}

	const apiUrl = getApiUrl(config, providerConfig);

	if (!config.apiKey) {
		throw new Error("请先在超级面板中配置API密钥");
	}

	const model = config.model || providerConfig.defaultModel;
	const temperature = options?.temperature ?? 0.7;
	const maxTokens = options?.maxTokens ?? 800;

	const messages = [
		{
			role: "system",
			content: options?.systemPrompt || "你是一个专业的AI助手。",
		},
		{ role: "user", content: prompt },
	];

	const requestBody = buildRequestBody(
		config.provider,
		model,
		messages,
		temperature,
		maxTokens,
		true, // stream
	);

	const headers = buildHeaders(config.apiKey, config.provider, true);

	const response = await fetch(apiUrl, {
		method: "POST",
		headers,
		body: JSON.stringify(requestBody),
		signal: options?.signal,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API请求失败: ${response.status} ${errorText}`);
	}

	// 根据 provider 类型选择不同的流解析器
	const resolvedProvider = resolveProvider(config.provider);
	if (resolvedProvider === "tongyi") {
		return parseTongyiStream(response, onChunk, options?.signal);
	}
	return parseOpenAIStream(response, onChunk, options?.signal);
}

/**
 * 智能调用 AI API：有 onChunk 回调时使用流式，否则使用非流式
 */
export async function callAISmart(
	prompt: string,
	config: AiApiConfig,
	options?: AiCallOptions,
): Promise<string> {
	if (options?.onChunk) {
		return callAIStream(prompt, config, options.onChunk, {
			systemPrompt: options.systemPrompt,
			temperature: options.temperature,
			maxTokens: options.maxTokens,
			signal: options.signal,
		});
	}
	return callAI(prompt, config, options);
}

/**
 * 从插件实例获取 AI API 配置
 */
export function getApiConfigFromPlugin(plugin: any): AiApiConfig {
	const settings = plugin?.settings || {};
	return {
		provider: settings.aiApiProvider || "tongyi",
		model: settings.aiModel || "qwen-plus",
		apiKey: settings.aiApiKey || "",
		customEndpoint: settings.aiCustomEndpoint || "",
	};
}
