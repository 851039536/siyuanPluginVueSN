/**
 * 联网搜索模块 (RAG: 先搜后答)
 * 支持国内可用的搜索引擎：博查(Bocha)、Jina、SearXNG
 * 搜索结果将注入 system prompt，让 LLM 基于真实数据回答，大幅降低幻觉
 */
import type {
  SearchApiConfig,
  SearchResult,
} from "@/types/ai"

// 重新导出类型
export type {
  SearchApiConfig,
  SearchProvider,
  SearchResult,
} from "@/types/ai"

/** 默认搜索条数 */
const DEFAULT_MAX_RESULTS = 8

// ============ 博查搜索 (Bocha AI Search) ============

/**
 * 博查搜索 API 调用
 * 文档：https://open.bochaai.com
 * 国内 AI 搜索首选，专为 RAG 设计，返回结构化结果
 */
async function searchBocha(
  query: string,
  apiKey: string,
  maxResults: number = DEFAULT_MAX_RESULTS,
  language?: string,
): Promise<SearchResult[]> {
  const body: Record<string, any> = {
    query,
    count: maxResults,
    freshness: "oneWeek",
    summary: true,
  }
  if (language && language !== "auto") {
    body.language = language
  }
  const response = await fetch("https://api.bochaai.com/v1/web-search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`博查搜索请求失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  // 博查返回格式: { data: { results: [...] } }
  const results = data?.data?.results || data?.data?.webPages?.value || []
  return results.map((item: any) => ({
    title: item.title || item.name || "",
    url: item.url || item.link || "",
    content: item.content || item.snippet || item.summary || "",
    score: item.score,
  })).filter((r: SearchResult) => r.title || r.content)
}

// ============ Jina Search ============

/**
 * Jina Search API 调用
 * 端点：https://s.jina.ai
 * 免费无需 API Key，国内可访问，返回搜索摘要
 */
async function searchJina(
  query: string,
  maxResults: number = DEFAULT_MAX_RESULTS,
  language?: string,
): Promise<SearchResult[]> {
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "X-Return-Format": "search",
  }
  if (language && language !== "auto") {
    headers["X-Language"] = language
  }
  const response = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
    method: "GET",
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Jina搜索请求失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  // Jina 返回格式: { data: [{ title, url, description, content }] }
  const results = data?.data || []
  return results.slice(0, maxResults).map((item: any) => ({
    title: item.title || "",
    url: item.url || "",
    content: item.description || item.content || "",
    score: item.score,
  })).filter((r: SearchResult) => r.title || r.content)
}

// ============ SearXNG ============

/**
 * SearXNG 搜索 API 调用
 * 自建开源元搜索引擎，无需 API Key，隐私友好
 * 需要用户自行部署或使用公共实例
 */
async function searchSearXNG(
  query: string,
  searxngUrl: string,
  maxResults: number = DEFAULT_MAX_RESULTS,
  language?: string,
): Promise<SearchResult[]> {
  let url = `${searxngUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}&format=json&categories=general`
  if (language && language !== "auto") {
    url += `&language=${encodeURIComponent(language)}`
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`SearXNG搜索请求失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  // SearXNG 返回格式: { results: [{ title, url, content }] }
  const results = data?.results || []
  return results.slice(0, maxResults).map((item: any) => ({
    title: item.title || "",
    url: item.url || "",
    content: item.content || "",
    score: item.score,
  })).filter((r: SearchResult) => r.title || r.content)
}

// ============ 统一搜索入口 ============

/**
 * 执行联网搜索（RAG 第一步）
 * 根据配置选择搜索引擎，返回结构化搜索结果
 */
export async function searchWeb(
  query: string,
  config: SearchApiConfig,
  maxResults: number = DEFAULT_MAX_RESULTS,
): Promise<SearchResult[]> {
  const { searchProvider, searchLanguage } = config

  switch (searchProvider) {
    case "bocha": {
      if (!config.bochaApiKey) {
        throw new Error("博查搜索需要配置 API Key，请在超级面板中设置")
      }
      return searchBocha(query, config.bochaApiKey, maxResults, searchLanguage)
    }

    case "jina":
      return searchJina(query, maxResults, searchLanguage)

    case "searxng": {
      if (!config.searxngUrl) {
        throw new Error("SearXNG 搜索需要配置实例地址，请在超级面板中设置")
      }
      return searchSearXNG(query, config.searxngUrl, maxResults, searchLanguage)
    }

    default:
      throw new Error(`不支持的搜索引擎: ${searchProvider}`)
  }
}

/**
 * 将搜索结果格式化为可注入 prompt 的文本
 * 包含来源信息，便于 LLM 引用和用户验证
 */
export function formatSearchResults(results: SearchResult[]): string {
  if (!results.length) return ""

  const currentDate = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })

  const header = `以下是截至 ${currentDate} 的实时搜索结果，请优先参考这些信息回答用户问题，并在回答中注明信息来源。`
  const items = results
    .map((r, i) => {
      const parts = [`【来源${i + 1}】${r.title}`]
      if (r.content) parts.push(`  摘要：${r.content}`)
      parts.push(`  链接：${r.url}`)
      return parts.join("\n")
    })
    .join("\n\n")

  return `${header}\n\n${items}`
}

/**
 * 从插件实例获取搜索 API 配置
 */
export function getSearchConfigFromPlugin(plugin: any): SearchApiConfig {
  const settings = plugin?.settings || {}
  return {
    searchProvider: settings.searchProvider || "jina",
    bochaApiKey: settings.searchBochaApiKey || "",
    searxngUrl: settings.searchSearxngUrl || "",
    searchLanguage: settings.searchLanguage || "auto",
  }
}
