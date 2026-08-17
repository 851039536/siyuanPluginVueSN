/**
 * RSS 内容抓取工具 — 带超时 fetch 与多层代理 fallback
 */
import { getErrorMessage } from "@/utils/stringUtils"

/** 浏览器模拟头（部分 CDN 屏蔽无 UA 的请求） */
const BROWSER_HEADERS: Record<string, string> = {
  "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

/** 抓取尝试项 */
interface FetchAttempt {
  url: string
  label: string
  timeout: number
  useBrowserHeaders: boolean
}

/**
 * 创建 AbortSignal（手动管理超时，兼容旧版浏览器）
 */
function createTimeoutSignal(ms: number): { signal: AbortSignal, clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}

/**
 * 带超时的 fetch 封装
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const {
    signal,
    clear,
  } = createTimeoutSignal(timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal,
    })
    clear()
    return response
  } catch (err) {
    clear()
    throw err
  }
}

/**
 * 检测文本是否为有效 XML（以 < 开头）
 */
function looksLikeXml(text: string): boolean {
  return /^\s*</.test(text)
}

/**
 * 获取RSS内容（多层 fallback：直连 → 多个代理）
 */
export async function fetchRss(url: string): Promise<string> {
  // 尝试列表：直连 + 多个代理
  const attempts: FetchAttempt[] = [
    {
      url,
      label: "直连",
      timeout: 15000,
      useBrowserHeaders: true,
    },
    {
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      label: "allorigins",
      timeout: 20000,
      useBrowserHeaders: false,
    },
    {
      url: `https://corsproxy.io/?${encodeURIComponent(url)}`,
      label: "corsproxy",
      timeout: 20000,
      useBrowserHeaders: false,
    },
    {
      url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      label: "codetabs",
      timeout: 20000,
      useBrowserHeaders: false,
    },
  ]

  // 收集失败原因
  const errors: string[] = []

  for (const attempt of attempts) {
    try {
      const headers = attempt.useBrowserHeaders ? BROWSER_HEADERS : {}
      const response = await fetchWithTimeout(attempt.url, {
        method: "GET",
        headers,
      }, attempt.timeout)

      if (response.ok) {
        const text = await response.text()
        // 检查是否为有效 XML（防止代理返回 HTML 错误页）
        if (looksLikeXml(text)) {
          return text
        } else {
          errors.push(`${attempt.label}: 返回内容不是 XML (可能被屏蔽)`)
        }
      } else {
        errors.push(`${attempt.label}: HTTP ${response.status}`)
      }
    } catch (err: unknown) {
      errors.push(`${attempt.label}: ${getErrorMessage(err) || "超时/失败"}`)
    }
  }

  throw new Error(`无法获取 RSS 内容。${errors.join("；")}`)
}
