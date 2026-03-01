import { ref, computed, type Ref, type ComputedRef } from 'vue'
import * as api from '@/api'
import { DocNavigationCache, fetchDocHierarchy } from '../types/storage'
import type { Block, DocHierarchy, ProtyleLike, TargetCacheItem } from '../types'
import { DEFAULT_OPTIONS } from '../types'

export interface UseDocNavigationReturn {
  parentDoc: Ref<Block | null>
  childDocs: Ref<Block[]>
  hasNavigation: ComputedRef<boolean>
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

export function useDocNavigation(): UseDocNavigationReturn {
  const parentDoc = ref<Block | null>(null)
  const childDocs = ref<Block[]>([])
  const isExpanded = ref(false)

  const hasNavigation = computed(() => {
    return parentDoc.value !== null || childDocs.value.length > 0
  })

  const visibleChildren = computed(() => {
    return childDocs.value.slice(0, 5)
  })

  const hiddenChildren = computed(() => {
    return childDocs.value.slice(5)
  })

  async function loadHierarchy(docId: string): Promise<void> {
    try {
      const currentDoc = await api.getBlockByID(docId)
      if (!currentDoc?.box || !currentDoc.hpath) {
        parentDoc.value = null
        childDocs.value = []
        return
      }

      const hierarchy: DocHierarchy = await fetchDocHierarchy(currentDoc, cache)
      parentDoc.value = hierarchy.parent
      childDocs.value = hierarchy.children
    } catch (error) {
      console.error('加载文档层级失败:', error)
      parentDoc.value = null
      childDocs.value = []
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
    hasNavigation,
    isExpanded,
    visibleChildren,
    hiddenChildren,
    loadHierarchy,
    toggleExpand,
    openDoc,
    stripHtml,
  }
}

export function findNavigationTarget(protyle: ProtyleLike): TargetCacheItem | null {
  let cached = targetCache.get(protyle)

  if (!cached && protyle.element) {
    const target = protyle.element.querySelector('.protyle-title') ||
                   protyle.element.querySelector('.protyle-wysiwyg')
    if (!target) return null

    cached = {
      el: target,
      method: target.classList.contains('protyle-title') ? 'after' : 'before'
    }
    targetCache.set(protyle, cached)
  }

  return cached || null
}

export function removeExistingNav(protyle: ProtyleLike): void {
  const cached = targetCache.get(protyle)
  if (!cached) return

  const sibling = cached.method === 'after'
    ? cached.el.nextElementSibling
    : cached.el.previousElementSibling

  if (sibling?.classList.contains('doc-navigation-container')) {
    sibling.remove()
  }
}

export { cache }
