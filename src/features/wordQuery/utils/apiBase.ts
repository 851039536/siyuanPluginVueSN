export interface ApiConfig {
	provider: string;
	model: string;
	apiKey: string;
	customEndpoint: string;
}

export const API_PROVIDERS = {
	tongyi: {
		url: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
		buildRequest: (model: string, messages: any[]) => ({
			model,
			input: { messages },
			parameters: { temperature: 0.7, top_p: 0.8, max_tokens: 800 },
		}),
	},
	openai: {
		url: "https://api.openai.com/v1/chat/completions",
		buildRequest: (model: string, messages: any[]) => ({
			model,
			messages,
			temperature: 0.7,
			max_tokens: 800,
		}),
	},
	deepseek: {
		url: "https://api.deepseek.com/v1/chat/completions",
		buildRequest: (model: string, messages: any[]) => ({
			model,
			messages,
			temperature: 0.7,
			max_tokens: 800,
		}),
	},
};

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

export async function callAPI(
	prompt: string,
	config: ApiConfig,
	options?: {
		systemPrompt?: string;
		temperature?: number;
		maxTokens?: number;
	},
): Promise<string> {
	const provider =
		config.provider === "custom" ? "openai" : config.provider;
	const providerConfig = API_PROVIDERS[provider as keyof typeof API_PROVIDERS];

	if (!providerConfig) {
		throw new Error(`不支持的API供应商: ${config.provider}`);
	}

	const apiUrl =
		config.provider === "custom" ? config.customEndpoint : providerConfig.url;
	if (!apiUrl) {
		throw new Error("API端点未设置");
	}

	if (!config.apiKey) {
		throw new Error("请先在超级面板中配置API密钥");
	}

	const model =
		config.model ||
		(config.provider === "tongyi" ? "qwen-plus" : "deepseek-chat");
	const messages = [
		{
			role: "system",
			content: options?.systemPrompt || "你是一个专业的AI助手。",
		},
		{ role: "user", content: prompt },
	];

	const temperature = options?.temperature ?? 0.7;
	const maxTokens = options?.maxTokens ?? 800;

	let requestBody: any;
	if (provider === "tongyi") {
		requestBody = {
			model,
			input: { messages },
			parameters: { temperature, top_p: 0.8, max_tokens: maxTokens },
		};
	} else {
		requestBody = {
			model,
			messages,
			temperature,
			max_tokens: maxTokens,
		};
	}

	const response = await fetch(apiUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API请求失败: ${response.status} ${errorText}`);
	}

	const data = await response.json();
	return extractResponseText(data);
}

export function getApiConfigFromPlugin(plugin: any): ApiConfig {
	const settings = plugin?.settings || {};
	return {
		provider: settings.aiApiProvider || "tongyi",
		model: settings.aiModel || "qwen-plus",
		apiKey: settings.aiApiKey || "",
		customEndpoint: settings.aiCustomEndpoint || "",
	};
}
