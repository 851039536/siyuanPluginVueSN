/**
 * 网站导航 — 共享常量（薄 re-export，真实定义下沉至 utils/sharedStorage/websiteStorage，
 * 供 websiteNavigation 与 minimalBrowser 共用，保持原有导入路径不变）
 */
export {
  ALL_CATEGORY_ID,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ID,
  PRESET_CATEGORY_COLORS,
} from "@/utils/sharedStorage/websiteStorage"
