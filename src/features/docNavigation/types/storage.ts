import type { Block, DocHierarchyCacheItem, DocHierarchy } from './index'
import { DEFAULT_OPTIONS } from './index'
import * as api from '@/api'

export class DocNavigationCache {
  private hierarchyCache = new Map<string, DocHierarchyCacheItem>()
  private htmlCache = new Map<string, string>()
  private maxCacheSize: number
  private cacheTTL: number

  constructor(maxCacheSize = DEFAULT_OPTIONS.maxCacheSize, cacheTTL = DEFAULT_OPTIONS.cacheTTL) {
    this.maxCacheSize = maxCacheSize
    this.cacheTTL = cacheTTL
  }

  stripHtml(html: string): string {
    let text = this.htmlCache.get(html)
    if (!text) {
      text = html.replace(/<[^>]*>/g, '')
      if (this.htmlCache.size > 100) this.htmlCache.clear()
      this.htmlCache.set(html, text)
    }
    return text
  }

  getHierarchyCacheKey(box: string, docId: string): string {
    return `${box}:${docId}`
  }

  getCachedHierarchy(box: string, docId: string): DocHierarchyCacheItem | null {
    const cacheKey = this.getHierarchyCacheKey(box, docId)
    const cached = this.hierarchyCache.get(cacheKey)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.cacheTTL) {
      this.hierarchyCache.delete(cacheKey)
      this.hierarchyCache.set(cacheKey, cached)
      return cached
    }

    return null
  }

  setCachedHierarchy(box: string, docId: string, hierarchy: DocHierarchy): void {
    const cacheKey = this.getHierarchyCacheKey(box, docId)
    const now = Date.now()

    this.hierarchyCache.set(cacheKey, {
      parent: hierarchy.parent,
      children: hierarchy.children,
      timestamp: now,
    })

    if (this.hierarchyCache.size > this.maxCacheSize) {
      const firstKey = this.hierarchyCache.keys().next().value
      firstKey && this.hierarchyCache.delete(firstKey)
    }
  }

  clearAll(): void {
    this.hierarchyCache.clear()
    this.htmlCache.clear()
  }
}

function escapeSqlString(str: string): string {
  if (!str) return ''
  return str.replace(/'/g, "''")
}

export async function fetchDocHierarchy(currentDoc: Block, cache: DocNavigationCache): Promise<DocHierarchy> {
  try {
    if (!currentDoc.hpath || !currentDoc.box) {
      return { parent: null, children: [] }
    }

    const cached = cache.getCachedHierarchy(currentDoc.box, currentDoc.id)
    if (cached) {
      return { parent: cached.parent, children: cached.children }
    }

    const hpathParts = currentDoc.hpath.split('/')
    const hasParent = hpathParts.length > 2
    const parentHpath = hasParent ? hpathParts.slice(0, -1).join('/') : ''

    const query = `
      SELECT id, content, hpath, 'parent' as doc_type
      FROM blocks
      WHERE box = '${escapeSqlString(currentDoc.box)}'
      AND type = 'd'
      ${hasParent ? `AND hpath = '${escapeSqlString(parentHpath)}'` : 'AND 1=0'}

      UNION ALL

      SELECT id, content, hpath, 'child' as doc_type
      FROM blocks
      WHERE box = '${escapeSqlString(currentDoc.box)}'
      AND type = 'd'
      AND hpath LIKE '${escapeSqlString(currentDoc.hpath)}/%'
      AND hpath NOT LIKE '${escapeSqlString(currentDoc.hpath)}/%/%'
      ORDER BY hpath ASC
    `

    const results = await api.sql(query)

    let parent: Block | null = null
    const children: Block[] = []

    results?.forEach((doc: Block) => {
      if (doc.doc_type === 'parent') {
        parent = doc
      } else {
        children.push(doc)
      }
    })

    cache.setCachedHierarchy(currentDoc.box, currentDoc.id, { parent, children })

    return { parent, children }
  } catch (error) {
    console.error('获取文档层级失败:', error)
    return { parent: null, children: [] }
  }
}
