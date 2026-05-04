export interface Block {
  id: string
  content: string
  hpath: string
  box?: string
}

export interface DocHierarchy {
  parent: Block | null
  children: Block[]
}

export interface BreadcrumbItem {
  id: string
  content: string
  hpath: string
}

export interface SiblingDocs {
  prev: Block | null
  next: Block | null
  siblings: Block[]
  currentIndex: number
}

export interface DocHierarchyCacheItem {
  parent: Block | null
  children: Block[]
  timestamp: number
}

export interface BreadcrumbCacheItem {
  items: BreadcrumbItem[]
  timestamp: number
}

export interface SiblingCacheItem {
  siblings: Block[]
  currentIndex: number
  timestamp: number
}

export interface TargetCacheItem {
  el: Element
  method: "after" | "before"
}

export interface DocNavigationOptions {
  maxCacheSize?: number
  cacheTTL?: number
  debounceDelay?: number
}

export const DEFAULT_OPTIONS: Required<DocNavigationOptions> = {
  maxCacheSize: 20,
  cacheTTL: 60000,
  debounceDelay: 100,
}

export interface ProtyleLike {
  block?: { rootID: string }
  element?: Element
}
