import { callAPI, type ApiConfig } from "./apiBase";

export type { ApiConfig };

export interface NamingStyle {
  id: string;
  label: string;
  description: string;
  example: string;
}

export interface CodeTranslationResult {
  original: string;
  translated: string;
  namingStyle: string;
  suggestions: string[];
}

export const NAMING_STYLES: NamingStyle[] = [
  {
    id: "camelCase",
    label: "驼峰命名",
    description: "首个单词小写，后续单词首字母大写",
    example: "getUserInfo",
  },
  {
    id: "PascalCase",
    label: "帕斯卡命名",
    description: "每个单词首字母大写",
    example: "GetUserInfo",
  },
  {
    id: "snake_case",
    label: "下划线命名",
    description: "单词间用下划线连接，全小写",
    example: "get_user_info",
  },
  {
    id: "kebab-case",
    label: "短横线命名",
    description: "单词间用短横线连接，全小写",
    example: "get-user-info",
  },
  {
    id: "SCREAMING_SNAKE_CASE",
    label: "常量命名",
    description: "单词间用下划线连接，全大写",
    example: "GET_USER_INFO",
  },
];

function buildPrompt(chinese: string, namingStyle: NamingStyle): string {
  return `请将中文"${chinese}"翻译成英文，并按照${namingStyle.label}格式输出。

要求：
1. 翻译要准确、专业，符合编程命名规范
2. 提供多个备选方案（至少3个）
3. ${namingStyle.description}
4. 只返回JSON格式，不要有其他文字说明

返回格式：
{
  "translated": "主要翻译结果",
  "suggestions": ["备选方案1", "备选方案2", "备选方案3"]
}`;
}

function parseTranslationResult(text: string): {
  translated: string;
  suggestions: string[];
} {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        translated: result.translated || "",
        suggestions: Array.isArray(result.suggestions)
          ? result.suggestions
          : [],
      };
    }
  } catch (error) {
    console.error("解析翻译结果失败:", error);
  }

  return {
    translated: text.split("\n")[0] || text,
    suggestions: [],
  };
}

export async function translateCodeField(
  chinese: string,
  namingStyle: NamingStyle,
  config: ApiConfig,
): Promise<CodeTranslationResult> {
  if (!chinese.trim()) {
    throw new Error("请输入中文内容");
  }

  const text = await callAPI(buildPrompt(chinese, namingStyle), config, {
    systemPrompt:
      "你是一个专业的编程翻译助手，擅长将中文翻译成符合编程命名规范的英文。",
    temperature: 0.3,
    maxTokens: 2000,
  });

  const parsed = parseTranslationResult(text);

  return {
    original: chinese,
    translated: parsed.translated,
    namingStyle: namingStyle.id,
    suggestions: parsed.suggestions,
  };
}
