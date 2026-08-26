export interface Block {
  id: string
  content: string
  hpath: string
  box?: string
  /** 存储物理路径（去除 .sy 后缀），用于 listDocsByPath 查询子文档 */
  path?: string
  /** 子文档数量，0 表示无下级文档 */
  subFileCount?: number
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

/** 反向链接条目（引用/提及当前文档的文档） */
export interface BacklinkItem {
  id: string
  content: string
  hpath: string
  box?: string
}

/** 文档元数据（来自 getDoc + SQL 块数统计） */
export interface DocMeta {
  /** 创建时间，思源格式 YYYYMMDDHHMMSS */
  created: string
  /** 最后更新时间，思源格式 YYYYMMDDHHMMSS */
  updated: string
  /** 文档内块数统计 */
  count: number
  /** emoji 图标 */
  icon: string
  /** 备注 */
  memo: string
  /** 文件大小（字节） */
  size: number
  /** 已发布到的平台显示名列表（空数组表示未发布，来自 custom-<平台>-yaml 属性） */
  publishedPlatforms: string[]
}

/** 反链缓存条目 */
export interface BacklinkCacheItem {
  items: BacklinkItem[]
  timestamp: number
}

/** 元数据缓存条目 */
export interface MetaCacheItem {
  meta: DocMeta
  timestamp: number
}

export interface TargetCacheItem {
  el: Element
  method: "after" | "before"
  position: "top" | "bottom"
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

export interface DocNavSettings {
  maxVisibleChildren: number
  position: "top" | "bottom"
  /** 子文档过滤关键词列表，默认 ["参考"] 与旧版硬编码行为一致 */
  filterKeywords: string[]
  /** 是否显示当前文档的发布状态徽章（默认开启） */
  enablePublishStatus: boolean
}

export const DEFAULT_NAV_SETTINGS: DocNavSettings = {
  maxVisibleChildren: 5,
  position: "top",
  filterKeywords: ["参考"],
  enablePublishStatus: true,
}

/** 平台标识→显示名映射（与 docAnalysis 默认平台元数据一致，供发布状态徽章显示具体平台名） */
export const PLATFORM_MATCHERS: Array<{ matchers: string[]; name: string }> = [
  { matchers: ["csdn"], name: "CSDN" },
  { matchers: ["zhihu"], name: "知乎" },
  { matchers: ["juejin"], name: "掘金" },
  { matchers: ["cnblogs", "blog"], name: "博客园" },
  { matchers: ["bili", "bibi"], name: "B站" },
  { matchers: ["gzh"], name: "公众号" },
  { matchers: ["jianshu"], name: "简书" },
  { matchers: ["cto51"], name: "51CTO" },
  { matchers: ["segmentfault", "sifou"], name: "思否" },
  { matchers: ["oschina"], name: "开源中国" },
  { matchers: ["infoq"], name: "InfoQ" },
]

export interface ProtyleLike {
  block?: { rootID: string }
  element?: Element
}
