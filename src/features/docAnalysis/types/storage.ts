/**
 * 文档分析功能 - 数据存储管理
 */
import type { Plugin } from "siyuan"
import type { FilterOptions, PlatformMeta } from "./index"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 默认过滤选项 */
export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  titleKeyword: "",
  contentKeyword: "",
  notebookId: "",
  sortField: "wordCount",
  sortOrder: "asc",
  wordCountMin: 0,
  wordCountMax: 30000,
  bookmarkName: "",
  updatedAfter: "",
  updatedBefore: "",
}

/** 默认平台元数据（用户未自定义时使用） */
export const DEFAULT_PLATFORM_META: PlatformMeta[] = [
  { id: "csdn",         matchers: ["csdn"],                    name: "CSDN",    url: "https://mp.csdn.net/mp_blog/creation/editor" },
  { id: "zhihu",        matchers: ["zhihu"],                   name: "知乎",    url: "https://zhuanlan.zhihu.com/write" },
  { id: "juejin",       matchers: ["juejin"],                  name: "掘金",    url: "https://juejin.cn/editor/drafts/new" },
  { id: "cnblogs",      matchers: ["cnblogs", "blog"],         name: "博客园",  url: "https://i.cnblogs.com/posts/edit" },
  { id: "bili",         matchers: ["bili", "bibi"],            name: "B站",     url: "https://www.bilibili.com/" },
  { id: "gzh",          matchers: ["gzh"],                     name: "公众号",  url: "" },
  { id: "jianshu",      matchers: ["jianshu"],                 name: "简书",    url: "https://www.jianshu.com/writer" },
  { id: "cto51",        matchers: ["cto51"],                   name: "51CTO",   url: "https://blog.51cto.com/writer" },
  { id: "segmentfault", matchers: ["segmentfault", "sifou"],   name: "思否",    url: "https://segmentfault.com/write" },
  { id: "oschina",      matchers: ["oschina"],                 name: "开源中国", url: "https://oschina.net/writer" },
  { id: "infoq",        matchers: ["infoq"],                   name: "InfoQ",   url: "https://www.infoq.com/" },
]

/**
 * 文档分析存储管理类
 */
export class DocAnalysisStorage {
  readonly options: TypedStorage<FilterOptions>
  readonly platformMeta: TypedStorage<PlatformMeta[]>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.options = new TypedStorage(storage, "doc-analysis-options", DEFAULT_FILTER_OPTIONS)
    this.platformMeta = new TypedStorage(storage, "doc-analysis-platforms", DEFAULT_PLATFORM_META)
  }
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 格式化字节数为可读字符串
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * 格式化字数为可读字符串
 */
export function formatWordCount(count: number): string {
  if (count === 0) return "0 字"
  if (count < 10000) return `${count} 字`
  return `${(count / 10000).toFixed(1)} 万字`
}
