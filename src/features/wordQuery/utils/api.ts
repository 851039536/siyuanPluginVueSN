import { callAPI, type ApiConfig } from "./apiBase";

export type { ApiConfig };

export async function callWordQueryAPI(
  prompt: string,
  config: ApiConfig,
): Promise<string> {
  return callAPI(prompt, config, {
    systemPrompt:
      "你是一个专业的多语言教学助手，擅长提供单词的详细释义、音标、谐音和例句。",
  });
}
