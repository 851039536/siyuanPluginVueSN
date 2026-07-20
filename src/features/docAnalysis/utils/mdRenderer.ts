/**
 * Markdown 渲染器（微信兼容）
 * 实际实现委托至 @/utils/mdRenderer.ts
 */
import { parseMarkdown as sharedParseMarkdown } from "@/utils/mdRenderer"

/** 解析 Markdown 为带内联样式 hljs 的 HTML（微信兼容） */
export function parseMarkdown(mdText: string): string {
  return sharedParseMarkdown(mdText, "wechat")
}
