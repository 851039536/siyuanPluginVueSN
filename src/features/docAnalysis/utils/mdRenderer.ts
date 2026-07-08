/**
 * Markdown 渲染器（向后兼容重导出）
 * 实际实现已提取至 @/utils/mdRenderer.ts，本文件保持导出签名不变
 */
export {
  convertHljsToInlineStyles,
  parseMarkdown as parseMarkdownRaw,
} from "@/utils/mdRenderer"

import { parseMarkdown as sharedParseMarkdown } from "@/utils/mdRenderer"

/**
 * 解析 Markdown 为带内联样式 hljs 的 HTML（微信兼容）
 * 保持原有签名不变，内部调用共享模块
 */
export function parseMarkdown(mdText: string): string {
  return sharedParseMarkdown(mdText, { codeHighlight: true, inlineStyles: true })
}
