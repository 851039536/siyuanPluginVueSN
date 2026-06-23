/**
 * 通用 DOM 操作工具函数
 *
 * 消除各功能模块中重复的剪贴板、下载、样式注入等 DOM 操作模式。
 */

/**
 * 降级复制到剪贴板（当 navigator.clipboard 不可用时）
 * @returns 是否复制成功
 */
export function fallbackCopyToClipboard(text: string): boolean {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.cssText = "position:fixed;left:-9999px;opacity:0;"
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand("copy")
    return true
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

/**
 * 复制文本到剪贴板（优先使用 Clipboard API，失败时降级）
 * @returns 是否复制成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    return fallbackCopyToClipboard(text)
  } catch {
    return fallbackCopyToClipboard(text)
  }
}

/**
 * 触发浏览器文件下载
 * @param url 文件 URL（Blob URL 或远程 URL）
 * @param filename 下载文件名
 */
export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

/**
 * 触发 Blob 文件下载
 * @param blob 文件 Blob 数据
 * @param filename 下载文件名
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
}

/**
 * 注入或更新 <style> 标签到 <head>
 * @param id style 元素 ID（用于幂等更新）
 * @param css CSS 文本内容
 */
export function injectStyle(id: string, css: string): void {
  const existing = document.getElementById(id)
  if (existing) {
    existing.textContent = css
    return
  }

  const style = document.createElement("style")
  style.id = id
  style.textContent = css
  document.head.appendChild(style)
}

/**
 * 移除已注入的 <style> 标签
 * @param id style 元素 ID
 */
export function removeStyle(id: string): void {
  const existing = document.getElementById(id)
  if (existing) {
    existing.remove()
  }
}

/**
 * Canvas 转 Blob（Promise 封装）
 * @param canvas HTMLCanvasElement
 * @param type 图片 MIME 类型，默认 "image/png"
 * @param quality 图片质量 0-1（仅对 image/jpeg 等有效）
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error(`Canvas toBlob 失败 (${type})`))
      },
      type,
      quality,
    )
  })
}

/**
 * 复制图片到剪贴板（使用 Clipboard API）
 * @param blob 图片 Blob 数据（PNG/JPEG 等）
 * @returns 是否复制成功
 */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
      return true
    }
    return false
  } catch {
    return false
  }
}
