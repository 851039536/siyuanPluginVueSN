// 文档导航数据层：设置持久化、DocNavigationCache 缓存、层级/面包屑/同级/反链/元数据获取
import type {
  BacklinkCacheItem,
  BacklinkItem,
  Block,
  BreadcrumbCacheItem,
  BreadcrumbItem,
  DocHierarchy,
  DocHierarchyCacheItem,
  DocMeta,
  DocNavSettings,
  MetaCacheItem,
  SiblingCacheItem,
  SiblingDocs,
} from "./index"
import { Plugin } from "siyuan"
import * as api from "@/api"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import {
  DEFAULT_NAV_SETTINGS,
  DEFAULT_OPTIONS,
} from "./index"

export class DocNavSettingsStorage {
  readonly settings: TypedStorage<DocNavSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, "docNavigation-settings", DEFAULT_NAV_SETTINGS)
  }
}

/** getPathByID 成功时的文档路径信息（从 api 返回类型推导，避免与 api 重复声明结构） */
type DocPathInfo = NonNullable<Awaited<ReturnType<typeof api.getPathByID>>>

interface CacheItem { timestamp: number }

export class DocNavigationCache {
  private hierarchyCache = new Map<string, DocHierarchyCacheItem>()
  private breadcrumbCache = new Map<string, BreadcrumbCacheItem>()
  private siblingCache = new Map<string, SiblingCacheItem>()
  private backlinkCache = new Map<string, BacklinkCacheItem>()
  private metaCache = new Map<string, MetaCacheItem>()
  private htmlCache = new Map<string, string>()
  private maxCacheSize: number
  private cacheTTL: number

  constructor(
    maxCacheSize = DEFAULT_OPTIONS.maxCacheSize,
    cacheTTL = DEFAULT_OPTIONS.cacheTTL,
  ) {
    this.maxCacheSize = maxCacheSize
    this.cacheTTL = cacheTTL
  }

  stripHtml(html: string): string {
    let text = this.htmlCache.get(html)
    if (!text) {
      text = html.replace(/<[^>]*>/g, "")
      if (this.htmlCache.size > 100) this.htmlCache.clear()
      this.htmlCache.set(html, text)
    }
    return text
  }

  private getCacheKey(box: string, docId: string): string {
    return `${box}:${docId}`
  }

  private get<T extends CacheItem>(
    cache: Map<string, T>,
    box: string,
    docId: string,
  ): T | null {
    const cacheKey = this.getCacheKey(box, docId)
    const cached = cache.get(cacheKey)
    if (!cached) return null
    if (Date.now() - cached.timestamp >= this.cacheTTL) {
      // 过期条目直接驱逐，避免长期占用 Map 空间
      cache.delete(cacheKey)
      return null
    }
    cache.delete(cacheKey)
    cache.set(cacheKey, cached)
    return cached
  }

  private set<T>(
    cache: Map<string, T & CacheItem>,
    box: string,
    docId: string,
    value: T,
  ): void {
    const cacheKey = this.getCacheKey(box, docId)
    cache.set(cacheKey, {
      ...value,
      timestamp: Date.now(),
    })
    if (cache.size > this.maxCacheSize) {
      const firstKey = cache.keys().next().value
      firstKey && cache.delete(firstKey)
    }
  }

  getCachedHierarchy(box: string, docId: string): DocHierarchyCacheItem | null {
    return this.get(this.hierarchyCache, box, docId)
  }

  setCachedHierarchy(
    box: string,
    docId: string,
    hierarchy: DocHierarchy,
  ): void {
    this.set(this.hierarchyCache, box, docId, hierarchy)
  }

  getCachedBreadcrumb(box: string, docId: string): BreadcrumbCacheItem | null {
    return this.get(this.breadcrumbCache, box, docId)
  }

  setCachedBreadcrumb(
    box: string,
    docId: string,
    items: BreadcrumbItem[],
  ): void {
    // set() 内部会补充 timestamp 字段，无需 as 断言
    this.set(this.breadcrumbCache, box, docId, { items })
  }

  getCachedSibling(box: string, docId: string): SiblingCacheItem | null {
    return this.get(this.siblingCache, box, docId)
  }

  setCachedSibling(
    box: string,
    docId: string,
    siblings: Block[],
    currentIndex: number,
  ): void {
    this.set(this.siblingCache, box, docId, {
      siblings,
      currentIndex,
    })
  }

  getCachedBacklinks(box: string, docId: string): BacklinkCacheItem | null {
    return this.get(this.backlinkCache, box, docId)
  }

  setCachedBacklinks(
    box: string,
    docId: string,
    items: BacklinkItem[],
  ): void {
    this.set(this.backlinkCache, box, docId, { items })
  }

  getCachedMeta(box: string, docId: string): MetaCacheItem | null {
    return this.get(this.metaCache, box, docId)
  }

  setCachedMeta(box: string, docId: string, meta: DocMeta): void {
    this.set(this.metaCache, box, docId, { meta })
  }

  clearAll(): void {
    this.hierarchyCache.clear()
    this.breadcrumbCache.clear()
    this.siblingCache.clear()
    this.backlinkCache.clear()
    this.metaCache.clear()
    this.htmlCache.clear()
  }
}

/**
 * 去除 .sy 后缀（思源物理路径/文件名格式）
 */
function stripSySuffix(str: string): string {
  return str.replace(/\.sy$/i, "")
}

/**
 * 将 IFile 转换为 Block 格式
 */
export function iFileToBlock(file: api.IFile): Block {
  return {
    id: file.id,
    content: stripSySuffix(file.name),
    hpath: stripSySuffix(file.path),
    path: stripSySuffix(file.path),
    subFileCount: file.subFileCount,
  }
}

/**
 * 获取文档层级（父文档 + 子文档）
 * 使用 listDocsByPath 官方 API 替代 SQL 查询
 */
export async function fetchDocHierarchy(
  currentDoc: Block,
  cache: DocNavigationCache,
  pathInfo: DocPathInfo,
): Promise<DocHierarchy> {
  try {
    if (!currentDoc.box) {
      return {
        parent: null,
        children: [],
      }
    }

    const cached = cache.getCachedHierarchy(currentDoc.box, currentDoc.id)
    if (cached) {
      return {
        parent: cached.parent,
        children: cached.children,
      }
    }

    // 并行获取子文档和父文档
    const childDocsPromise = api.listDocsByPath(
      pathInfo.notebook,
      pathInfo.path,
      0,
    )

    // 计算父文档物理路径
    // 当前文档路径如 "/20210808180117-czj9bvb/20220808180117-abc123"
    // 父目录路径如 "/20210808180117-czj9bvb"
    // 祖父目录路径如 "/"
    const parentDirPath = pathInfo.path.substring(
      0,
      pathInfo.path.lastIndexOf("/"),
    ) || "/"

    // 判断是否有父文档（路径层数 > 1 才有父文档）
    // 路径 "/20210808180117-czj9bvb" 是根级文档，无父文档
    // 路径 "/20210808180117-czj9bvb/20220808180117-abc123" 有父文档
    const pathParts = pathInfo.path.split("/").filter(Boolean)
    const hasParent = pathParts.length > 1
    // listDocsByPath 返回的是指定路径下的直接子文档
    // 要找到父文档，需要在祖父目录下查找 path === parentDirPath 的文档
    const grandParentDirPath = parentDirPath === "/"
      ? "/"
      : parentDirPath.substring(0, parentDirPath.lastIndexOf("/")) || "/"

    const parentDocsPromise = hasParent
      ? api.listDocsByPath(pathInfo.notebook, grandParentDirPath, 0)
      : Promise.resolve(null)

    const [childDocsResult, parentDocsResult] = await Promise.all([
      childDocsPromise,
      parentDocsPromise,
    ])

    // 从祖父目录的子文档列表中找到父文档
    let parent: Block | null = null
    if (parentDocsResult?.files) {
      const parentFile = parentDocsResult.files.find(
        (f) => stripSySuffix(f.path) === parentDirPath,
      )
      if (parentFile) {
        parent = iFileToBlock(parentFile)
      }
    }

    // 获取子文档列表
    const children: Block[] = (childDocsResult?.files || []).map(iFileToBlock)

    cache.setCachedHierarchy(currentDoc.box, currentDoc.id, {
      parent,
      children,
    })

    return {
      parent,
      children,
    }
  } catch (error) {
    console.error("获取文档层级失败:", error)
    return {
      parent: null,
      children: [],
    }
  }
}

/**
 * 获取面包屑导航
 * 使用 listDocsByPath 官方 API 替代 SQL 查询
 *
 * 优化策略：利用路径层级特点，先从根目录逐级获取，
 * 每个 listDocsByPath 结果会命中兄弟文档的缓存，减少后续请求
 */
export async function fetchBreadcrumb(
  currentDoc: Block,
  cache: DocNavigationCache,
  pathInfo: DocPathInfo,
): Promise<BreadcrumbItem[]> {
  try {
    if (!currentDoc.box) {
      return []
    }

    const cached = cache.getCachedBreadcrumb(currentDoc.box, currentDoc.id)
    if (cached) {
      return cached.items
    }

    // 拆解物理路径，逐级构建父路径
    // 路径格式如 "/20210808180117-czj9bvb/20220808180117-abc123"
    const pathParts = pathInfo.path.split("/").filter(Boolean)
    if (pathParts.length <= 1) {
      // 根级文档无面包屑
      return []
    }

    // 构建每一级文档的完整路径
    const ancestorPaths: string[] = []
    let accumulated = ""
    for (let i = 0; i < pathParts.length - 1; i++) {
      accumulated += `/${pathParts[i]}`
      ancestorPaths.push(accumulated)
    }

    // 并行获取所有祖先路径所在目录的文档列表
    const results = await Promise.all(
      ancestorPaths.map((ancestorPath) => {
        const parentDir =
          ancestorPath.substring(0, ancestorPath.lastIndexOf("/")) || "/"
        return api.listDocsByPath(pathInfo.notebook, parentDir, 0)
          .then((result) => ({
            ancestorPath,
            result,
          }))
      }),
    )

    const items: BreadcrumbItem[] = []
    for (const {
      ancestorPath,
      result,
    } of results) {
      if (result?.files) {
        const targetFile = result.files.find(
          (f) => stripSySuffix(f.path) === ancestorPath,
        )
        if (targetFile) {
          items.push({
            id: targetFile.id,
            content: stripSySuffix(targetFile.name),
            hpath: ancestorPath,
          })
        }
      }
    }

    cache.setCachedBreadcrumb(currentDoc.box, currentDoc.id, items)

    return items
  } catch (error) {
    console.error("获取面包屑导航失败:", error)
    return []
  }
}

/**
 * 获取同级文档
 * 使用 listDocsByPath 官方 API 替代 SQL 查询
 */
export async function fetchSiblingDocs(
  currentDoc: Block,
  cache: DocNavigationCache,
  pathInfo: DocPathInfo,
): Promise<SiblingDocs> {
  try {
    if (!currentDoc.box) {
      return {
        prev: null,
        next: null,
        siblings: [],
        currentIndex: -1,
      }
    }

    const cached = cache.getCachedSibling(currentDoc.box, currentDoc.id)
    if (cached) {
      const siblings = cached.siblings
      const currentIndex = cached.currentIndex
      return {
        prev: currentIndex > 0 ? siblings[currentIndex - 1] : null,
        next:
          currentIndex < siblings.length - 1
            ? siblings[currentIndex + 1]
            : null,
        siblings,
        currentIndex,
      }
    }

    // 计算父路径
    // 当前文档路径如 "/20210808180117-czj9bvb/20220808180117-abc123"
    // 父目录路径如 "/20210808180117-czj9bvb"
    const parentDirPath =
      pathInfo.path.substring(0, pathInfo.path.lastIndexOf("/")) || "/"

    // 根级文档（path 本身就是 "/"）无同级
    if (pathInfo.path === "/") {
      return {
        prev: null,
        next: null,
        siblings: [],
        currentIndex: -1,
      }
    }

    // 获取父路径下的所有文档
    const result = await api.listDocsByPath(
      pathInfo.notebook,
      parentDirPath,
      0,
    )

    const siblings: Block[] = (result?.files || []).map(iFileToBlock)
    const currentIndex = siblings.findIndex((s) => s.id === currentDoc.id)

    cache.setCachedSibling(
      currentDoc.box,
      currentDoc.id,
      siblings,
      currentIndex,
    )

    return {
      prev: currentIndex > 0 ? siblings[currentIndex - 1] : null,
      next:
        currentIndex < siblings.length - 1
          ? siblings[currentIndex + 1]
          : null,
      siblings,
      currentIndex,
    }
  } catch (error) {
    console.error("获取同级文档失败:", error)
    return {
      prev: null,
      next: null,
      siblings: [],
      currentIndex: -1,
    }
  }
}

/** 反链展示上限，超过部分丢弃，避免面板渲染卡顿 */
const MAX_BACKLINK_COUNT = 50

/**
 * 获取引用/提及当前文档的文档列表（反链 + 反提及合并去重）
 * 使用 getBacklink + getBackmention 官方 API，截断至 MAX_BACKLINK_COUNT 条
 */
export async function fetchBacklinks(
  currentDoc: Block,
  cache: DocNavigationCache,
): Promise<BacklinkItem[]> {
  try {
    if (!currentDoc.box) {
      return []
    }

    const cached = cache.getCachedBacklinks(currentDoc.box, currentDoc.id)
    if (cached) {
      return cached.items
    }

    const [backlinkRes, backmentionRes] = await Promise.all([
      api.getBacklink(currentDoc.id),
      api.getBackmention(currentDoc.id, currentDoc.id),
    ])

    const seen = new Set<string>()
    const items: BacklinkItem[] = []
    const files = [
      ...(backlinkRes?.backlinks ?? []),
      ...(backlinkRes?.backmentions ?? []),
      ...(backmentionRes?.backlinks ?? []),
      ...(backmentionRes?.backmentions ?? []),
    ]
    for (const file of files) {
      if (seen.has(file.id)) {
        continue
      }
      seen.add(file.id)
      items.push({
        id: file.id,
        content: stripSySuffix(file.name),
        hpath: stripSySuffix(file.path),
        box: file.box,
      })
      if (items.length >= MAX_BACKLINK_COUNT) {
        break
      }
    }

    cache.setCachedBacklinks(currentDoc.box, currentDoc.id, items)
    return items
  } catch (error) {
    console.error("获取反向链接失败:", error)
    return []
  }
}

/**
 * 获取文档元数据（创建/更新时间、块数、图标、备注、大小）
 * 时间从 blocks 表 SQL 查询（最可靠），块数同表统计，图标/备注/大小来自 getDoc
 */
export async function fetchDocMeta(
  currentDoc: Block,
  cache: DocNavigationCache,
): Promise<DocMeta | null> {
  try {
    if (!currentDoc.box) {
      return null
    }

    const cached = cache.getCachedMeta(currentDoc.box, currentDoc.id)
    if (cached) {
      return cached.meta
    }

    // 同时查块数统计和根块时间（blocks 表 created/updated 为 YYYYMMDDHHMMSS 格式）
    const [docResult, blockInfo] = await Promise.all([
      api.getDoc(currentDoc.id),
      api.sql(
        `select ` +
          `(select count(*) from blocks where root_id = '${currentDoc.id}') as c, ` +
          `(select created from blocks where id = '${currentDoc.id}') as created, ` +
          `(select updated from blocks where id = '${currentDoc.id}') as updated`,
      ),
    ])
    if (!docResult) {
      return null
    }

    const info = (blockInfo as Array<{ c?: number | string; created?: string; updated?: string }>)?.[0]
    // 优先使用 SQL 查询的 blocks 表时间（最可靠），回退到 getDoc 的 ial/顶层字段
    const ialTime = typeof docResult.ial === "object" && docResult.ial !== null
      ? docResult.ial
      : undefined
    const meta: DocMeta = {
      created: info?.created ?? ialTime?.created ?? docResult.created ?? "",
      updated: info?.updated ?? ialTime?.updated ?? docResult.updated ?? "",
      count: Number(info?.c) || 0,
      icon: docResult.icon ?? "",
      memo: docResult.memo ?? "",
      size: docResult.size ?? 0,
    }

    cache.setCachedMeta(currentDoc.box, currentDoc.id, meta)
    return meta
  } catch (error) {
    console.error("获取文档元数据失败:", error)
    return null
  }
}
