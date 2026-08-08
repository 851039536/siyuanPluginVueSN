import type {
  ComputedRef,
  Ref,
} from "vue"
import type {
  Block,
  BreadcrumbItem,
  ProtyleLike,
  SiblingDocs,
  TargetCacheItem,
} from "../types"
import type { DocPathInfo } from "../types/storage"
import {
  computed,
  ref,
} from "vue"
import * as api from "@/api"
import {
  DocNavigationCache,
  fetchBreadcrumb,
  fetchDocHierarchy,
  fetchSiblingDocs,
} from "../types/storage"

export interface UseDocNavigationReturn {
  parentDoc: Ref<Block | null>
  childDocs: Ref<Block[]>
  breadcrumbs: Ref<BreadcrumbItem[]>
  siblingDocs: Ref<SiblingDocs>
  currentDocId: Ref<string>
  notebook: Ref<string>
  hasNavigation: ComputedRef<boolean>
  hasBreadcrumbs: ComputedRef<boolean>
  hasSiblings: ComputedRef<boolean>
  childCount: ComputedRef<number>
  loadHierarchy: (docId: string) => Promise<void>
  openDoc: (docId: string) => void
  stripHtml: (html: string) => string
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

  function resetState() {
    parentDoc.value = null
    childDocs.value = []
    breadcrumbs.value = []
    siblingDocs.value = { ...emptySiblings }
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

      const docPathInfo: DocPathInfo = {
        notebook: pathInfo.notebook,
        path: pathInfo.path,
      }

      const currentDoc: Block = {
        id: docId,
        content: "",
        hpath: pathInfo.path,
        box: pathInfo.notebook,
      }

      const [hierarchy, breadcrumbItems, siblings] = await Promise.all([
        fetchDocHierarchy(currentDoc, cache, docPathInfo),
        fetchBreadcrumb(currentDoc, cache, docPathInfo),
        fetchSiblingDocs(currentDoc, cache, docPathInfo),
      ])

      parentDoc.value = hierarchy.parent
      childDocs.value = hierarchy.children
      breadcrumbs.value = breadcrumbItems
      siblingDocs.value = siblings
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
    currentDocId,
    notebook,
    hasNavigation,
    hasBreadcrumbs,
    hasSiblings,
    childCount,
    loadHierarchy,
    openDoc,
    stripHtml,
  }
}

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

export function removeExistingNav(protyle: ProtyleLike): void {
  const cached = targetCache.get(protyle)
  if (!cached) return

  const sibling =
    cached.method === "after"
      ? cached.el.nextElementSibling
      : cached.el.previousElementSibling

  if (sibling?.classList.contains("doc-navigation-container")) {
    sibling.remove()
  }
}
