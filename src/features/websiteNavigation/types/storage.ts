/**
 * 网站导航 — 数据持久化层（薄 re-export，实现下沉至 utils/sharedStorage/websiteStorage，
 * 供 websiteNavigation 与 minimalBrowser 共享同一份书签数据）
 */
export {
  DEFAULT_CATEGORY_ID,
  STORAGE_KEYS,
  WebsiteNavigationStorage,
} from "@/utils/sharedStorage/websiteStorage"
