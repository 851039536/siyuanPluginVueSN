/**
 * Markdown API 文档加载器
 * 支持纯 Markdown 内容渲染，带目录导航
 */
import MarkdownIt from 'markdown-it'
import markdownItAnchor from 'markdown-it-anchor'
import markdownItToc from 'markdown-it-toc-done-right'
import type { ApiProvider } from './types'

// 创建 markdown-it 实例
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight: function (str, lang) {
    // 返回原始代码，让 highlight.js 在客户端处理
    if (lang) {
      return `<pre><code class="language-${lang}">${escapeHtml(str)}</code></pre>`
    }
    return `<pre><code>${escapeHtml(str)}</code></pre>`
  }
})

// Slugify 函数 - 将标题转换为 URL 友好的 ID
function slugify(s: string): string {
  // 保留中英文、数字、连字符，移除其他特殊字符
  return String(s)
    .trim()
    .replace(/\s+/g, '-')                    // 空格转为连字符
    .replace(/[^\w\u4e00-\u9fa5\-]/g, '')    // 移除特殊字符，保留中英文、数字、连字符
    .replace(/-+/g, '-')                     // 多个连字符合并为一个
    .replace(/^-+|-+$/g, '')                 // 移除首尾连字符
    .toLowerCase()
}

// 创建唯一 slug 生成器，用于处理重复标题
const anchorSlugCounts = new Map<string, number>()

function uniqueSlugify(s: string): string {
  const baseSlug = slugify(s)

  if (anchorSlugCounts.has(baseSlug)) {
    const count = anchorSlugCounts.get(baseSlug)! + 1
    anchorSlugCounts.set(baseSlug, count)
    return `${baseSlug}-${count}`
  } else {
    anchorSlugCounts.set(baseSlug, 0)
    return baseSlug
  }
}

// 配置 anchor 插件（为标题添加锚点，但不添加链接）
md.use(markdownItAnchor, {
  permalink: false, // 禁用永久链接，避免标题变成链接
  level: [1, 2, 3, 4, 5, 6],
  slugify: uniqueSlugify
})

// 配置 TOC 插件（生成目录）
md.use(markdownItToc, {
  containerClass: 'table-of-contents',
  listType: 'ul',
  level: [1, 2, 3, 4],
  slugify
})

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

/**
 * 渲染 Markdown 内容为 HTML
 */
export function renderMarkdown(content: string): string {
  try {
    // 重置 slug 计数器，确保每次渲染都从头开始
    anchorSlugCounts.clear()
    return md.render(content)
  } catch (error) {
    console.error('Failed to render markdown:', error)
    return content
  }
}

/**
 * 提取标题结构用于导航
 */
export interface TocItem {
  level: number
  text: string
  slug: string
  children?: TocItem[]
}

export function extractToc(content: string): TocItem[] {
  if (!content || content.trim().length === 0) {
    console.warn('[API Reference] Empty content provided to extractToc')
    return []
  }

  const tokens = md.parse(content, {})
  const toc: TocItem[] = []
  const stack: TocItem[] = []
  const slugCounts = new Map<string, number>() // 用于跟踪重复的 slug


  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.substring(1))

      // 获取标题文本 - 需要收集所有 inline token 的内容
      let text = ''
      const inlineToken = tokens[i + 1]
      if (inlineToken && inlineToken.type === 'inline' && inlineToken.children) {
        text = inlineToken.children
          .filter(child => child.type === 'text' || child.type === 'code_inline')
          .map(child => child.content)
          .join('')
      } else if (inlineToken && inlineToken.content) {
        text = inlineToken.content
      }

      if (!text) {
        console.warn(`[API Reference] Empty heading text at token ${i}`)
        continue
      }

      // 生成基础 slug
      let baseSlug = slugify(text)
      let uniqueSlug = baseSlug

      // 处理重复的 slug，添加数字后缀
      if (slugCounts.has(baseSlug)) {
        const count = slugCounts.get(baseSlug)! + 1
        slugCounts.set(baseSlug, count)
        uniqueSlug = `${baseSlug}-${count}`
      } else {
        slugCounts.set(baseSlug, 0)
      }


      const item: TocItem = { level, text, slug: uniqueSlug }

      // 找到合适的父级
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      if (stack.length === 0) {
        toc.push(item)
      } else {
        const parent = stack[stack.length - 1]
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(item)
      }

      stack.push(item)
    }
  }

  return toc
}

/**
 * 解析 markdown 文件内容为 API 提供者（暂未使用）
 */
export function parseMarkdownToProvider(content: string, filename: string): ApiProvider {
  // 简化实现，暂时返回基本结构
  const providerId = filename.replace('.md', '')

  return {
    id: providerId,
    name: providerId,
    description: content,
    icon: '📄',
    documentationUrl: '',
    baseUrl: '',
    authType: 'none',
    categories: []
  }
}

// 未使用的解析函数已移除，保持文件简洁

// 注意：以下函数暂时保留用于未来可能的文件系统集成

/**
 * 从文件系统加载所有 API 文档（暂未使用）
 */
export async function loadApiProvidersFromMarkdown(): Promise<ApiProvider[]> {
  // 暂时返回空数组，未来可以实现从文件系统加载
  console.warn('loadApiProvidersFromMarkdown is not implemented yet')
  return []
}
