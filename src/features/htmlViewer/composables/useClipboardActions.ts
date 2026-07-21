/**
 * HTML展示 - 剪贴板操作 composable
 */
import { nextTick } from "vue"
import html2canvas from "html2canvas"
import { showMessage } from "siyuan"
import { copyToClipboard, triggerDownload } from "@/utils/domUtils"
import { cleanAndInlineStyles, BASE_STYLES } from "../utils/htmlStyles"
import { htmlToTextTable } from "../utils/textTable"

export function useClipboardActions(getHtmlContent: () => string, getPreviewFrame: () => HTMLIFrameElement | null) {
  const contentSize = (html: string): string => {
    const bytes = new Blob([html]).size
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function copySource() {
    const source = getHtmlContent()
    const ok = await copyToClipboard(source)
    showMessage(ok ? "源码已复制" : "复制失败", 2000, ok ? "info" : "error")
  }

  async function copyRenderedContent() {
    const source = getHtmlContent()
    if (!source.trim()) {
      showMessage("没有可复制的内容", 2000, "info")
      return
    }
    const cleanedHtml = cleanAndInlineStyles(source)
    const finalHtml = `${BASE_STYLES}${cleanedHtml}`
    const text = source.replace(/<[^>]*>/g, "").trim()

    try {
      const htmlBlob = new Blob([finalHtml], { type: "text/html" })
      const textBlob = new Blob([text], { type: "text/plain" })
      await navigator.clipboard.write([new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob })])
      showMessage("已复制渲染内容（带样式）", 2000, "info")
    } catch {
      const ok = await copyToClipboard(finalHtml)
      showMessage(ok ? "已复制（富文本剪贴板不可用，已复制HTML源码）" : "复制失败", 2000, ok ? "info" : "error")
    }
  }

  async function copyAsTextTable() {
    const source = getHtmlContent()
    if (!source.trim()) {
      showMessage("没有可复制的内容", 2000, "info")
      return
    }
    const text = htmlToTextTable(source)
    if (!text) {
      showMessage("当前内容中未检测到表格", 2000, "info")
      return
    }
    const ok = await copyToClipboard(text)
    showMessage(ok ? "已复制文本表格（适用于B站等平台）" : "复制失败", 2000, ok ? "info" : "error")
  }

  async function copyAsImage() {
    const iframe = getPreviewFrame()
    if (!iframe || !iframe.contentDocument?.body) {
      showMessage("没有可复制的内容", 2000, "info")
      return
    }

    let canvas: HTMLCanvasElement | null = null
    try {
      await nextTick()
      canvas = await html2canvas(iframe.contentDocument.body, {
        useCORS: true,
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
      })

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas!.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error("Canvas toBlob 失败"))
        }, "image/png")
      })

      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
      showMessage("已复制为图片", 2000, "info")
    } catch (error) {
      console.error("复制为图片失败:", error)
      if (canvas) {
        triggerDownload(canvas.toDataURL("image/png"), `html-preview-${Date.now()}.png`)
        showMessage("已下载为图片（剪贴板不可用）", 2000, "info")
      } else {
        showMessage("复制失败", 2000, "error")
      }
    }
  }

  return { contentSize, copySource, copyRenderedContent, copyAsTextTable, copyAsImage }
}
