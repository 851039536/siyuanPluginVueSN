import type {
  ComputedRef,
  Ref,
} from "vue"
import type {
  Block,
  BreadcrumbItem,
  DocNavSettings,
  ProtyleLike,
  SiblingDocs,
  TargetCacheItem,
} from "../types"
import type { DocPathInfo } from "../types/storage"
import { Plugin } from "siyuan"
import {
  computed,
  ref,
} from "vue"
import * as api from "@/api"
import { DEFAULT_NAV_SETTINGS } from "../types"
import {
  DocNavigationCache,
  DocNavSettingsStorage,
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

export function useDocNavigation(plugin: Plugin): UseDocNavigationReturn {
  const settingsStorage = new DocNavSettingsStorage(plugin)
  const settings = ref<DocNavSettings>({ ...DEFAULT_NAV_SETTINGS })

  const parentDoc = ref<Block | null>(null)
  const childDocs = ref<Block[]>([])
  const breadcrumbs = ref<BreadcrumbItem[]>([])
  const siblingDocs = ref<SiblingDocs>({ ...emptySiblings })
  const currentDocId = ref("")
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
    return childDocs.value.slice(0, settings.value.maxVisibleChildren)
  })

  const hiddenChildren = computed(() => {
    return childDocs.value.slice(settings.value.maxVisibleChildren)
  })

  function resetState() {
    parentDoc.value = null
    childDocs.value = []
    breadcrumbs.value = []
    siblingDocs.value = { ...emptySiblings }
  }

  async function loadHierarchy(docId: string): Promise<void> {
    try {
      currentDocId.value = docId

      const loaded = await settingsStorage.settings.loadOrDefault()
      settings.value = loaded

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
    currentDocId,
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
