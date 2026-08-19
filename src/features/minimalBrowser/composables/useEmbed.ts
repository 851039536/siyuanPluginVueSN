/**
 * 极简浏览器 — 嵌入思源（纯官方 API）
 *
 * 浏览器页签运行在思源主窗口内（openTab custom 页签），嵌入按钮直接走官方链：
 * getActiveEditor() → protyle.block.rootID → appendBlock()，把当前 URL 以
 * iframe 块追加到活动文档末尾，无任何自建跨窗口通信。
 */
import { getActiveEditor } from "siyuan"
import { appendBlock } from "@/api"

/** 活动编辑器最小结构（仅声明本文件用到的字段） */
interface EditorLike {
  protyle?: {
    block?: { rootID?: string }
  }
}

/** HTML 转义（iframe src 中的 & 等字符；target 为 ES2020，用 replace 正则代替 replaceAll） */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** 生成思源 iframe 块 markdown（格式对齐思源原生「嵌入网页」输出） */
function buildIframeMarkdown(url: string): string {
  return `<iframe src="${escapeHtml(url)}" sandbox="allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation allow-forms allow-downloads" style="width: 100%; height: 484px; border: 0px;"></iframe>`
}

export type EmbedResult = "ok" | "no-doc" | "failed"

/**
 * 把当前 URL 嵌入思源当前活动文档：
 * getActiveEditor 拿不到编辑器（无活动文档）→ "no-doc"；
 * appendBlock 成功 → "ok"，异常 → "failed"。
 */
export async function embedCurrentUrl(url: string): Promise<EmbedResult> {
  if (!url) return "failed"

  let docId: string | null = null
  try {
    const editor = getActiveEditor() as unknown as EditorLike | null
    docId = editor?.protyle?.block?.rootID ?? null
  } catch {
    docId = null
  }
  if (!docId) return "no-doc"

  try {
    await appendBlock("markdown", buildIframeMarkdown(url), docId)
    return "ok"
  } catch (error) {
    console.error("[MinimalBrowser] embed into doc failed:", error)
    return "failed"
  }
}
