/**
 * 文档分析功能 - 发布操作共享工具
 */
import { showMessage } from "siyuan"
import { exportMdContent } from "@/api"
import { copyToClipboard } from "@/utils/domUtils"

/**
 * 复制文档标题 + Markdown 内容到剪贴板（组合为 # title + 空行 + md）
 */
export async function copyDocForPublish(docId: string, title: string): Promise<boolean> {
  try {
    const result = await exportMdContent(docId)
    const mdContent = result?.content || ""
    const combined = `# ${title}\n\n${mdContent}`
    await copyToClipboard(combined)
    return true
  } catch {
    showMessage("获取文档内容失败，请重试", 3000, "error")
    return false
  }
}

/**
 * 延迟打开外部 URL 发布平台
 */
export function openExternalPublish(url: string, platformName: string, delay = 300) {
  showMessage(`标题和内容已复制，即将跳转到 ${platformName}`, 3000, "info")
  setTimeout(() => {
    window.open(url, "_blank")
  }, delay)
}
