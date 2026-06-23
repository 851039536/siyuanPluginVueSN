/**
 * 技能学习 - 语言标签映射（CategoryFilter & FlashcardView 共用）
 */
const LANG_MAP: Record<string, string> = {
  csharp: "C#",
  javascript: "JavaScript",
  typescript: "TypeScript",
  vue: "Vue",
}

export function langLabel(lang: string): string {
  return LANG_MAP[lang] || lang
}

/** 语言对应的颜色映射 */
export const LANG_COLORS: Record<string, string> = {
  csharp: "#a855f7",
  javascript: "#f59e0b",
  typescript: "#3b82f6",
  vue: "#10b981",
  other: "#94a3b8",
}

