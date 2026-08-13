/**
 * 文档分析功能 - 发布操作共享工具
 */
import { showMessage } from "siyuan"
import { exportMdContent } from "@/api"
import { copyToClipboard } from "@/utils/domUtils"
import type { PublishPromoteConfig } from "../types/index"
import { DEFAULT_PUBLISH_PROMOTE } from "../types/index"

/** 当前发布推广文案配置（模块级单例，由 PublishPanel 加载持久化配置后写入） */
let promoteConfig: PublishPromoteConfig = { ...DEFAULT_PUBLISH_PROMOTE }

/** 设置推广文案配置（复制内容底部是否追加/追加什么内容） */
export function setPromoteConfig(config: PublishPromoteConfig) {
  promoteConfig = { enabled: config.enabled, text: config.text }
}

/** 读取当前推广文案配置 */
export function getPromoteConfig(): PublishPromoteConfig {
  return { ...promoteConfig }
}

/** 转义 HTML 特殊字符（用户自定义文案含 < > & 时安全注入） */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** 根据配置生成 Markdown 版推广尾部（关闭或无文案时返回空串） */
export function buildPromoteFooterMd(config: PublishPromoteConfig): string {
  const text = config.text?.trim()
  if (!config.enabled || !text) return ""
  return `\n\n---\n\n**${text}**`
}

/** 根据配置生成 HTML 版推广尾部（关闭或无文案时返回空串；文本经 HTML 转义） */
export function buildPromoteFooterHtml(config: PublishPromoteConfig): string {
  const text = config.text?.trim()
  if (!config.enabled || !text) return ""
  const escaped = escapeHtml(text).replace(/\n/g, "<br>")
  return `<hr><p style="text-align:center;"><strong>${escaped}</strong></p>`
}

/**
 * 思源 exportMdContent 导出的文档属性 front matter（--- ... --- YAML 块）
 */
const FRONT_MATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/

/** 转义正则特殊字符（本地工具，不跨 feature 导入） */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 剥离思源导出 Markdown 开头的文档属性 front matter（--- ... --- 块）
 * 无 front matter 时原样返回；剥离后清理前导空行
 */
export function stripFrontMatter(md: string): string {
  return md.replace(FRONT_MATTER_RE, "").replace(/^\r?\n+/, "")
}

/**
 * 复制文档标题 + Markdown 内容到剪贴板（组合为 # title + 空行 + md；title 为空时仅复制正文）
 * 自动剥离思源文档属性 front matter；正文首块已是 "# {title}" 标题时不再重复拼接前缀
 * @param i18n docAnalysis 分片 i18n（提供 publishFetchFailed / publishClipboardFailed 文案）
 */
export async function copyDocForPublish(docId: string, title: string, i18n: Record<string, string>): Promise<boolean> {
  try {
    const result = await exportMdContent(docId)
    const mdContent = result?.content || ""
    // 剥离文档属性 front matter（title/date/lastmod 等内部属性不随正文发布出去）
    const stripped = stripFrontMatter(mdContent)
    const titleHeading = title.trim()
    // 正文首块已是 "# {title}" 标题时不再拼接前缀，避免标题重复
    const titleRe = titleHeading ? new RegExp(`^#\\s+${escapeRegExp(titleHeading)}(?:\\s|$)`) : null
    const startsWithTitle = titleRe ? titleRe.test(stripped) : false
    const combined = startsWithTitle ? stripped : (titleHeading ? `# ${titleHeading}\n\n${stripped}` : stripped)
    // 内容非空且启用推广时在末尾追加公众号推广文案
    const withPromote = combined.trim() ? combined + buildPromoteFooterMd(promoteConfig) : combined
    // copyToClipboard 失败返回 false 不抛异常，必须显式检查
    const copied = await copyToClipboard(withPromote)
    if (!copied) {
      // 提示文案："复制到剪贴板失败"
      showMessage(i18n.publishClipboardFailed, 3000, "error")
      return false
    }
    return true
  } catch {
    // 提示文案："获取文档内容失败，请重试"
    showMessage(i18n.publishFetchFailed, 3000, "error")
    return false
  }
}

/**
 * 延迟打开外部 URL 发布平台
 * @param i18n docAnalysis 分片 i18n（提供 publishCopiedRedirect 文案）
 */
export function openExternalPublish(url: string, platformName: string, i18n: Record<string, string>, delay = 300) {
  // 提示文案："标题和内容已复制，即将跳转到 {platform}"
  showMessage(i18n.publishCopiedRedirect.replace("{platform}", platformName), 3000, "info")
  setTimeout(() => {
    window.open(url, "_blank")
  }, delay)
}
