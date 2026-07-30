/**
 * 文档分析功能 - 发布操作共享工具
 */
import { showMessage } from "siyuan"
import { exportMdContent } from "@/api"
import { copyToClipboard } from "@/utils/domUtils"

/**
 * 复制文档标题 + Markdown 内容到剪贴板（组合为 # title + 空行 + md；title 为空时仅复制正文）
 * @param i18n docAnalysis 分片 i18n（提供 publishFetchFailed / publishClipboardFailed 文案）
 */
export async function copyDocForPublish(docId: string, title: string, i18n: Record<string, string>): Promise<boolean> {
  try {
    const result = await exportMdContent(docId)
    const mdContent = result?.content || ""
    // title 为空时不生成空标题行 "# "
    const combined = title.trim() ? `# ${title.trim()}\n\n${mdContent}` : mdContent
    // copyToClipboard 失败返回 false 不抛异常，必须显式检查
    const copied = await copyToClipboard(combined)
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
