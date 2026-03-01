import type { Block, DocHierarchyCacheItem, DocHierarchy, BreadcrumbItem, BreadcrumbCacheItem, SiblingDocs, SiblingCacheItem } from './index'
import { DEFAULT_OPTIONS } from './index'
import * as api from '@/api'

export class DocNavigationCache {
  private hierarchyCache = new Map<string, DocHierarchyCacheItem>()
  private breadcrumbCache = new Map<string, BreadcrumbCacheItem>()
  private siblingCache = new Map<string, SiblingCacheItem>()
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

  private getCacheKey(box: string, docId: string): string {
    return `${box}:${docId}`
  }

  getHierarchyCacheKey(box: string, docId: string): string {
    return this.getCacheKey(box, docId)
  }

  getCachedHierarchy(box: string, docId: string): DocHierarchyCacheItem | null {
    const cacheKey = this.getCacheKey(box, docId)
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
    const cacheKey = this.getCacheKey(box, docId)
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

  getCachedBreadcrumb(box: string, docId: string): BreadcrumbCacheItem | null {
    const cacheKey = this.getCacheKey(box, docId)
    const cached = this.breadcrumbCache.get(cacheKey)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.cacheTTL) {
      this.breadcrumbCache.delete(cacheKey)
      this.breadcrumbCache.set(cacheKey, cached)
      return cached
    }

    return null
  }

  setCachedBreadcrumb(box: string, docId: string, items: BreadcrumbItem[]): void {
    const cacheKey = this.getCacheKey(box, docId)
    const now = Date.now()

    this.breadcrumbCache.set(cacheKey, {
      items,
      timestamp: now,
    })

    if (this.breadcrumbCache.size > this.maxCacheSize) {
      const firstKey = this.breadcrumbCache.keys().next().value
      firstKey && this.breadcrumbCache.delete(firstKey)
    }
  }

  getCachedSibling(box: string, docId: string): SiblingCacheItem | null {
    const cacheKey = this.getCacheKey(box, docId)
    const cached = this.siblingCache.get(cacheKey)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.cacheTTL) {
      this.siblingCache.delete(cacheKey)
      this.siblingCache.set(cacheKey, cached)
      return cached
    }

    return null
  }

  setCachedSibling(box: string, docId: string, siblings: Block[], currentIndex: number): void {
    const cacheKey = this.getCacheKey(box, docId)
    const now = Date.now()

    this.siblingCache.set(cacheKey, {
      siblings,
      currentIndex,
      timestamp: now,
    })

    if (this.siblingCache.size > this.maxCacheSize) {
      const firstKey = this.siblingCache.keys().next().value
      firstKey && this.siblingCache.delete(firstKey)
    }
  }

  clearAll(): void {
    this.hierarchyCache.clear()
    this.breadcrumbCache.clear()
    this.siblingCache.clear()
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

export async function fetchBreadcrumb(currentDoc: Block, cache: DocNavigationCache): Promise<BreadcrumbItem[]> {
  try {
    if (!currentDoc.hpath || !currentDoc.box) {
      return []
    }

    const cached = cache.getCachedBreadcrumb(currentDoc.box, currentDoc.id)
    if (cached) {
      return cached.items
    }

    const hpathParts = currentDoc.hpath.split('/').filter(Boolean)
    if (hpathParts.length <= 1) {
      return []
    }

    const parentHpaths: string[] = []
    let currentPath = ''
    for (let i = 0; i < hpathParts.length - 1; i++) {
      currentPath += '/' + hpathParts[i]
      parentHpaths.push(currentPath)
    }

    if (parentHpaths.length === 0) {
      return []
    }

    const hpathConditions = parentHpaths.map(h => `hpath = '${escapeSqlString(h)}'`).join(' OR ')

    const query = `
      SELECT id, content, hpath
      FROM blocks
      WHERE box = '${escapeSqlString(currentDoc.box)}'
      AND type = 'd'
      AND (${hpathConditions})
      ORDER BY hpath ASC
    `

    const results = await api.sql(query)

    const items: BreadcrumbItem[] = (results || []).map((doc: Block) => ({
      id: doc.id,
      content: doc.content,
      hpath: doc.hpath,
    }))

    cache.setCachedBreadcrumb(currentDoc.box, currentDoc.id, items)

    return items
  } catch (error) {
    console.error('获取面包屑导航失败:', error)
    return []
  }
}

export async function fetchSiblingDocs(currentDoc: Block, cache: DocNavigationCache): Promise<SiblingDocs> {
  try {
    if (!currentDoc.hpath || !currentDoc.box) {
      return { prev: null, next: null, siblings: [], currentIndex: -1 }
    }

    const cached = cache.getCachedSibling(currentDoc.box, currentDoc.id)
    if (cached) {
      const siblings = cached.siblings
      const currentIndex = cached.currentIndex
      return {
        prev: currentIndex > 0 ? siblings[currentIndex - 1] : null,
        next: currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null,
        siblings,
        currentIndex,
      }
    }

    const hpathParts = currentDoc.hpath.split('/')
    const hasParent = hpathParts.length > 2
    const parentHpath = hasParent ? hpathParts.slice(0, -1).join('/') : ''

    if (!hasParent) {
      return { prev: null, next: null, siblings: [], currentIndex: -1 }
    }

    const query = `
      SELECT id, content, hpath, 'sibling' as doc_type
      FROM blocks
      WHERE box = '${escapeSqlString(currentDoc.box)}'
      AND type = 'd'
      AND hpath LIKE '${escapeSqlString(parentHpath)}/%'
      AND hpath NOT LIKE '${escapeSqlString(parentHpath)}/%/%'
      ORDER BY hpath ASC
    `

    const results = await api.sql(query)
    const siblings: Block[] = results || []

    const currentIndex = siblings.findIndex(s => s.id === currentDoc.id)

    cache.setCachedSibling(currentDoc.box, currentDoc.id, siblings, currentIndex)

    return {
      prev: currentIndex > 0 ? siblings[currentIndex - 1] : null,
      next: currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null,
      siblings,
      currentIndex,
    }
  } catch (error) {
    console.error('获取同级文档失败:', error)
    return { prev: null, next: null, siblings: [], currentIndex: -1 }
  }
}
