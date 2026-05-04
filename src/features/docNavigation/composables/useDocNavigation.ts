import type {
  ComputedRef, 
Ref
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
  hasNavigation: ComputedRef<boolean>
  hasBreadcrumbs: ComputedRef<boolean>
  hasSiblings: ComputedRef<boolean>
  isExpanded: Ref<boolean>
  visibleChildren: ComputedRef<Block[]>
  hiddenChildren: ComputedRef<Block[]>
  loadHierarchy: (docId: string) => Promise<void>
  toggleExpand: () => void
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
  const isExpanded = ref(false)

  const hasNavigation = computed(() => {
    return parentDoc.value !== null || childDocs.value.length > 0
  })

  const hasBreadcrumbs = computed(() => {
    return breadcrumbs.value.length > 0
  })

  const hasSiblings = computed(() => {
    return siblingDocs.value.siblings.length > 1
  })

  const visibleChildren = computed(() => {
    return childDocs.value.slice(0, 5)
  })

  const hiddenChildren = computed(() => {
    return childDocs.value.slice(5)
  })

  function resetState() {
    parentDoc.value = null
    childDocs.value = []
    breadcrumbs.value = []
    siblingDocs.value = emptySiblings
  }

  async function loadHierarchy(docId: string): Promise<void> {
    try {
      const pathInfo = await api.getPathByID(docId)
      if (!pathInfo?.notebook || !pathInfo.path) {
        resetState()
        return
      }

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

  function toggleExpand(): void {
    isExpanded.value = !isExpanded.value
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
    hasNavigation,
    hasBreadcrumbs,
    hasSiblings,
    isExpanded,
    visibleChildren,
    hiddenChildren,
    loadHierarchy,
    toggleExpand,
    openDoc,
    stripHtml,
  }
}

export function findNavigationTarget(
  protyle: ProtyleLike,
): TargetCacheItem | null {
  let cached = targetCache.get(protyle)

  if (!cached && protyle.element) {
    const target =
      protyle.element.querySelector(".protyle-title")
      || protyle.element.querySelector(".protyle-wysiwyg")
    if (!target) return null

    cached = {
      el: target,
      method: target.classList.contains("protyle-title") ? "after" : "before",
    }
    targetCache.set(protyle, cached)
  }

  return cached ?? null
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
