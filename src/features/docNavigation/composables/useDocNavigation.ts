// 文档导航核心逻辑：加载层级/面包屑/同级/反链/元数据，计算显示条件，提供跳转与 HTML 清洗
import type {
  ComputedRef,
  Ref,
} from "vue"
import type {
  BacklinkItem,
  Block,
  BreadcrumbItem,
  DocMeta,
  ProtyleLike,
  SiblingDocs,
  TargetCacheItem,
} from "../types"
import {
  computed,
  ref,
} from "vue"
import {
  DEFAULT_NAV_SETTINGS,
} from "../types"
import * as api from "@/api"
import {
  DocNavigationCache,
  fetchBacklinks,
  fetchBreadcrumb,
  fetchDocHierarchy,
  fetchDocMeta,
  fetchSiblingDocs,
} from "../types/storage"

export interface UseDocNavigationReturn {
  parentDoc: Ref<Block | null>
  childDocs: Ref<Block[]>
  breadcrumbs: Ref<BreadcrumbItem[]>
  siblingDocs: Ref<SiblingDocs>
  backlinks: Ref<BacklinkItem[]>
  backlinkCount: ComputedRef<number>
  hasBacklinks: ComputedRef<boolean>
  docMeta: Ref<DocMeta | null>
  hasMeta: ComputedRef<boolean>
  currentDocId: Ref<string>
  notebook: Ref<string>
  hasNavigation: ComputedRef<boolean>
  hasBreadcrumbs: ComputedRef<boolean>
  hasSiblings: ComputedRef<boolean>
  childCount: ComputedRef<number>
  filteredChildDocs: ComputedRef<Block[]>
  filteredChildCount: ComputedRef<number>
  filterKeywords: Ref<string[]>
  loadHierarchy: (docId: string) => Promise<void>
  openDoc: (docId: string) => void
  stripHtml: (html: string) => string
  setFilterKeywords: (keywords: string[]) => void
}

const cache = new DocNavigationCache()
const targetCache = new WeakMap<any, TargetCacheItem>()
const emptySiblings: SiblingDocs = {
  prev: null,
  next: null,
  siblings: [],
  currentIndex: -1,
}

export function useDocNavigation(): UseDocNavigationReturn {
  const parentDoc = ref<Block | null>(null)
  const childDocs = ref<Block[]>([])
  const breadcrumbs = ref<BreadcrumbItem[]>([])
  const siblingDocs = ref<SiblingDocs>({ ...emptySiblings })
  const backlinks = ref<BacklinkItem[]>([])
  const docMeta = ref<DocMeta | null>(null)
  const filterKeywords = ref<string[]>([...DEFAULT_NAV_SETTINGS.filterKeywords])
  const currentDocId = ref("")
  const notebook = ref("")

  const hasNavigation = computed(() => {
    return parentDoc.value !== null || childDocs.value.length > 0
  })

  const hasBreadcrumbs = computed(() => {
    return breadcrumbs.value.length > 0
  })

  const hasSiblings = computed(() => {
    return siblingDocs.value.siblings.length > 1
  })

  const childCount = computed(() => {
    return childDocs.value.length
  })

  const backlinkCount = computed(() => {
    return backlinks.value.length
  })

  const hasBacklinks = computed(() => {
    return backlinks.value.length > 0
  })

  const hasMeta = computed(() => {
    return docMeta.value !== null
  })

  // childDocs 的 content 来自文件名（iFileToBlock 已去 .sy 后缀），纯文本无需 HTML 清洗
  // 多关键词过滤：任一关键词命中即保留，关键词列表为空时不显示过滤结果
  const filteredChildDocs = computed(() => {
    const keywords = filterKeywords.value.filter((kw) => kw.trim() !== "")
    if (keywords.length === 0) {
      return []
    }
    return childDocs.value.filter((doc) =>
      keywords.some((kw) => doc.content.includes(kw)),
    )
  })

  const filteredChildCount = computed(() => {
    return filteredChildDocs.value.length
  })

  function setFilterKeywords(keywords: string[]): void {
    filterKeywords.value = Array.isArray(keywords)
      ? [...keywords]
      : [...DEFAULT_NAV_SETTINGS.filterKeywords]
  }

  function resetState() {
    parentDoc.value = null
    childDocs.value = []
    breadcrumbs.value = []
    siblingDocs.value = { ...emptySiblings }
    backlinks.value = []
    docMeta.value = null
    notebook.value = ""
  }

  async function loadHierarchy(docId: string): Promise<void> {
    try {
      currentDocId.value = docId

      const pathInfo = await api.getPathByID(docId)
      if (!pathInfo?.notebook || !pathInfo.path) {
        resetState()
        return
      }

      notebook.value = pathInfo.notebook

      const currentDoc: Block = {
        id: docId,
        content: "",
        hpath: pathInfo.path,
        box: pathInfo.notebook,
      }

      // pathInfo 已窄化为非空 { notebook, path }，直接传给数据层
      // 反链与元数据与层级数据并行获取，不增加串行等待时间
      const [hierarchy, breadcrumbItems, siblings, backlinkItems, meta] =
        await Promise.all([
          fetchDocHierarchy(currentDoc, cache, pathInfo),
          fetchBreadcrumb(currentDoc, cache, pathInfo),
          fetchSiblingDocs(currentDoc, cache, pathInfo),
          fetchBacklinks(currentDoc, cache),
          fetchDocMeta(currentDoc, cache),
        ])

      parentDoc.value = hierarchy.parent
      childDocs.value = hierarchy.children
      breadcrumbs.value = breadcrumbItems
      siblingDocs.value = siblings
      backlinks.value = backlinkItems
      docMeta.value = meta
    } catch (error) {
      console.error("加载文档层级失败:", error)
      resetState()
    }
  }

  function openDoc(docId: string): void {
    if (docId) {
      window.open(`siyuan://blocks/${docId}`)
    }
  }

  function stripHtml(html: string): string {
    return cache.stripHtml(html)
  }

  return {
    parentDoc,
    childDocs,
    breadcrumbs,
    siblingDocs,
    backlinks,
    backlinkCount,
    hasBacklinks,
    docMeta,
    hasMeta,
    currentDocId,
    notebook,
    hasNavigation,
    hasBreadcrumbs,
    hasSiblings,
    childCount,
    filteredChildDocs,
    filteredChildCount,
    filterKeywords,
    loadHierarchy,
    openDoc,
    stripHtml,
    setFilterKeywords,
  }
}

/** 清空数据缓存（由 index.ts 的 destroy() 在插件卸载时调用，避免缓存长期驻留） */
export function disposeCache(): void {
  cache.clearAll()
}

export function findNavigationTarget(
  protyle: ProtyleLike,
  position: "top" | "bottom" = "top",
): TargetCacheItem | null {
  if (!protyle.element) return null

  const cached = targetCache.get(protyle)
  if (cached && cached.position === position) return cached

  let target: Element | null = null
  let method: "after" | "before"

  if (position === "bottom") {
    target = protyle.element.querySelector(".protyle-wysiwyg")
    method = "before"
  } else {
    target = protyle.element.querySelector(".protyle-title")
    method = "after"
  }

  if (!target) {
    target =
      protyle.element.querySelector(".protyle-title")
      || protyle.element.querySelector(".protyle-wysiwyg")
    if (!target) return null
    method = target.classList.contains("protyle-title") ? "after" : "before"
  }

  const result: TargetCacheItem = {
    el: target,
    method,
    position,
  }
  targetCache.set(protyle, result)
  return result
}
