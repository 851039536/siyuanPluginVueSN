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
