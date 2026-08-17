/**
 * RSS订阅功能 - 核心逻辑组合式函数
 */
import type { Plugin } from "siyuan"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
} from "vue"
import {
  createRssItemFromParsed,
  generateId,
  getPubDateTimestamp,
  parseRssXml,
} from "../utils/parser"
import { fetchRss } from "../utils/fetchRss"
import { trimItemsPerFeed } from "../utils/itemTrim"
import type {
  RssFeed,
  RssItem,
  RssLoadingStatus,
  RssSettings,
} from "../types"
import { DEFAULT_RSS_SETTINGS } from "../types"
import { RssStorage } from "../types/storage"
import { useArticleOps } from "./useArticleOps"
import { useOpmlTransfer } from "./useOpmlTransfer"
import { getErrorMessage } from "@/utils/stringUtils"

export function useRssReader(plugin: Plugin) {
  // ========== 存储 ==========
  const storage = new RssStorage(plugin)
  const rssI18n = (plugin.i18n as any)?.rssReader || {}

  // ========== 响应式状态 ==========
  const settings = ref<RssSettings>({ ...DEFAULT_RSS_SETTINGS })
  const feeds = ref<RssFeed[]>([])
  const items = ref<RssItem[]>([])
  const loadingStatus = ref<RssLoadingStatus>("idle")
  const currentFeedFilter = ref<string>("all") // "all" 或 feedId
  const currentGroupFilter = ref<string>("all") // "all" 或 group名
  const searchKeyword = ref("")
  const showStarredOnly = ref(false)
  const showUnreadOnly = ref(false)
  const selectedItem = ref<RssItem | null>(null)
  const showItemDetail = ref(false)
  const showAddFeedDialog = ref(false)
  const showSettingsDialog = ref(false)
  const refreshingFeedIds = ref<Set<string>>(new Set())
  const collapsedGroups = ref<Set<string>>(new Set())

  // ========== 计算属性 ==========

  /** 所有分组 */
  const groups = computed(() => {
    const arr = Array.isArray(feeds.value) ? feeds.value : []
    const groupSet = new Set<string>()
    arr.forEach((f) => {
      if (f.group) groupSet.add(f.group)
    })
    return Array.from(groupSet)
  })

  /** 按分组分类的订阅源（未分组的归入"未分组"） */
  const groupedFeeds = computed(() => {
    const arr = Array.isArray(feeds.value) ? feeds.value : []
    const map = new Map<string, RssFeed[]>()

    for (const feed of arr) {
      const group = feed.group || ""
      if (!map.has(group)) {
        map.set(group, [])
      }
      map.get(group)!.push(feed)
    }

    const result: Array<{ group: string, label: string, feeds: RssFeed[] }> = []
    // 有分组名称的排前面
    const sortedKeys = Array.from(map.keys()).sort((a, b) => {
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b, "zh-CN")
    })
    for (const key of sortedKeys) {
      result.push({
        group: key,
        label: key || rssI18n.ungrouped,
        feeds: map.get(key)!,
      })
    }
    return result
  })

  /** 按当前过滤条件筛选的文章 */
  const filteredItems = computed(() => {
    const arr = Array.isArray(items.value) ? items.value : []
    let result = [...arr]

    // 按订阅源过滤
    if (currentFeedFilter.value !== "all") {
      result = result.filter((i) => i.feedId === currentFeedFilter.value)
    }

    // 按分组过滤
    if (currentGroupFilter.value !== "all") {
      const feedIdsInGroup = feeds.value
        .filter((f) => f.group === currentGroupFilter.value)
        .map((f) => f.id)
      result = result.filter((i) => feedIdsInGroup.includes(i.feedId))
    }

    // 搜索关键词
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase()
      result = result.filter(
        (i) =>
          i.title?.toLowerCase().includes(kw)
          || i.description?.toLowerCase().includes(kw),
      )
    }

    // 仅收藏
    if (showStarredOnly.value) {
      result = result.filter((i) => i.starred)
    }

    // 仅未读
    if (showUnreadOnly.value) {
      result = result.filter((i) => !i.read)
    }

    // 排序
    result.sort((a, b) => {
      const dateA = getPubDateTimestamp(a.pubDate)
      const dateB = getPubDateTimestamp(b.pubDate)
      return settings.value.sortOrder === "newest"
        ? dateB - dateA
        : dateA - dateB
    })

    return result
  })

  /** 未读数统计 */
  const unreadCount = computed(() => {
    const arr = Array.isArray(items.value) ? items.value : []
    return arr.filter((i) => !i.read).length
  })

  /** 每个订阅源的未读数 */
  const feedUnreadCounts = computed(() => {
    const arr = Array.isArray(items.value) ? items.value : []
    const counts: Record<string, number> = {}
    arr.forEach((item) => {
      if (!item.read) {
        counts[item.feedId] = (counts[item.feedId] || 0) + 1
      }
    })
    return counts
  })

  // ========== 初始化 ==========

  async function init() {
    try {
      const data = await storage.init()
      settings.value = data.settings
      feeds.value = Array.isArray(data.feeds) ? data.feeds : []
      items.value = Array.isArray(data.items) ? data.items : []
    } catch (err) {
      console.error("[RSS] 初始化失败:", err)
    }
  }

  // ========== 订阅源操作 ==========

  /**
   * 添加新的RSS订阅源
   */
  async function addFeed(url: string, group?: string) {
    url = url.trim()
    if (!url) {
      showMessage(rssI18n.feedUrlRequired, 3000, "error")
      return false
    }

    // 添加 https:// 前缀
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`
    }

    // 检查重复
    if (feeds.value.some((f) => f.url === url)) {
      showMessage(rssI18n.feedExisted, 3000, "error")
      return false
    }

    loadingStatus.value = "loading"

    try {
      const response = await fetchRss(url)
      const {
        feed: feedInfo,
        items: parsedItems,
      } = parseRssXml(response, url)

      const newFeed: RssFeed = {
        id: generateId(),
        title: feedInfo.title || url,
        url,
        description: feedInfo.description,
        siteUrl: feedInfo.siteUrl,
        iconUrl: feedInfo.iconUrl,
        lastUpdated: new Date().toISOString(),
        addedAt: Date.now(),
        group: group || "",
        enabled: true,
      }

      const newItems: RssItem[] = parsedItems.map((pi) =>
        createRssItemFromParsed(pi, newFeed.id, newFeed.title, rssI18n.untitled))

      feeds.value.push(newFeed)
      items.value.push(...newItems)

      await saveData()
      loadingStatus.value = "success"
      showMessage(`${rssI18n.feedAddedDetail}: ${newFeed.title}`, 3000, "info")
      return true
    } catch (err: unknown) {
      loadingStatus.value = "error"
      showMessage(getErrorMessage(err) || rssI18n.feedAddFailed, 5000, "error")
      return false
    }
  }

  /**
   * 删除订阅源
   */
  async function removeFeed(feedId: string) {
    feeds.value = Array.isArray(feeds.value) ? feeds.value.filter((f) => f.id !== feedId) : []
    items.value = Array.isArray(items.value) ? items.value.filter((i) => i.feedId !== feedId) : []

    if (currentFeedFilter.value === feedId) {
      currentFeedFilter.value = "all"
    }

    await saveData()
    showMessage(rssI18n.feedDeleted, 2000, "info")
  }

  /**
   * 刷新单个订阅源
   */
  async function refreshFeed(feedId: string) {
    const feed = feeds.value.find((f) => f.id === feedId)
    if (!feed) return

    refreshingFeedIds.value.add(feedId)

    try {
      const response = await fetchRss(feed.url)
      const {
        feed: feedInfo,
        items: parsedItems,
      } = parseRssXml(response, feed.url)

      // 更新订阅源信息
      if (feedInfo.title) feed.title = feedInfo.title
      if (feedInfo.description) feed.description = feedInfo.description
      if (feedInfo.siteUrl) feed.siteUrl = feedInfo.siteUrl
      if (feedInfo.iconUrl) feed.iconUrl = feedInfo.iconUrl
      feed.lastUpdated = new Date().toISOString()

      // 合并新文章（通过链接去重）
      const existingLinks = new Set(
        Array.isArray(items.value)
          ? items.value.filter((i) => i.feedId === feedId).map((i) => i.link)
          : [],
      )

      const newItems: RssItem[] = []
      for (const pi of parsedItems) {
        const link = pi.link || ""
        if (link && !existingLinks.has(link)) {
          newItems.push(createRssItemFromParsed(pi, feedId, feed.title, rssI18n.untitled))
          existingLinks.add(link)
        }
      }

      if (newItems.length > 0) {
        items.value.push(...newItems)
        showMessage(`${feed.title}: ${newItems.length}${rssI18n.newArticlesDetail}`, 3000, "info")
      } else {
        showMessage(`${feed.title}: ${rssI18n.noNewArticlesDetail}`, 2000, "info")
      }

      // 限制每个源的文章数
      trimItemsPerFeed(items, settings.value.maxItemsPerFeed)

      await saveData()
    } catch (err: unknown) {
      showMessage(`${rssI18n.refreshDetailFailed}: ${getErrorMessage(err)}`, 5000, "error")
    } finally {
      refreshingFeedIds.value.delete(feedId)
    }
  }

  /**
   * 刷新所有订阅源
   */
  async function refreshAllFeeds() {
    loadingStatus.value = "loading"
    const enabledFeeds = feeds.value.filter((f) => f.enabled)

    for (const feed of enabledFeeds) {
      await refreshFeed(feed.id)
    }

    loadingStatus.value = "idle"
  }

  // ========== 文章详情操作 ==========

  /**
   * 增大/减小字体
   */
  function changeDetailFontSize(delta: number) {
    const current = settings.value.detailFontSize
    const newSize = Math.max(12, Math.min(24, current + delta))
    if (newSize !== current) {
      settings.value.detailFontSize = newSize
      storage.settings.save(settings.value)
    }
  }

  /**
   * 更新订阅源分组
   */
  async function updateFeedGroup(feedId: string, group: string) {
    const feed = feeds.value.find((f) => f.id === feedId)
    if (feed) {
      feed.group = group
      await saveData()
    }
  }

  // ========== 设置操作 ==========

  async function updateSettings(newSettings: Partial<RssSettings>) {
    Object.assign(settings.value, newSettings)
    await storage.settings.save(settings.value)
  }

  // ========== 过滤操作 ==========

  function setFeedFilter(feedId: string) {
    currentFeedFilter.value = feedId
    currentGroupFilter.value = "all"
  }

  function setGroupFilter(group: string) {
    currentGroupFilter.value = group
    currentFeedFilter.value = "all"
  }

  function toggleGroupCollapse(group: string) {
    if (collapsedGroups.value.has(group)) {
      collapsedGroups.value.delete(group)
    } else {
      collapsedGroups.value.add(group)
    }
  }

  /**
   * 重命名分组（更新该分组下所有订阅源的 group 字段）
   */
  async function renameGroup(oldName: string, newName: string) {
    if (!oldName || !newName.trim() || oldName === newName.trim()) return
    const trimmed = newName.trim()
    for (const feed of feeds.value) {
      if (feed.group === oldName) {
        feed.group = trimmed
      }
    }
    // 同步折叠状态
    if (collapsedGroups.value.has(oldName)) {
      collapsedGroups.value.delete(oldName)
      collapsedGroups.value.add(trimmed)
    }
    await saveData()
    showMessage(`${rssI18n.groupRenamedTo}: ${trimmed}`, 2000, "info")
  }

  // ========== 内部方法 ==========

  /**
   * 保存数据
   */
  async function saveData() {
    await Promise.all([
      storage.feeds.save(feeds.value),
      storage.items.save(items.value),
    ])
  }

  // ========== 文章操作（独立 composable，共享 items/selectedItem 状态） ==========
  const articleOps = useArticleOps({
    items,
    selectedItem,
    showItemDetail,
    persist: saveData,
  })

  // ========== OPML 导入导出（独立 composable） ==========
  const opmlOps = useOpmlTransfer({
    feeds,
    i18n: rssI18n,
    addFeed,
  })

  return {
    // 状态
    settings,
    feeds,
    items,
    loadingStatus,
    currentFeedFilter,
    currentGroupFilter,
    searchKeyword,
    showStarredOnly,
    showUnreadOnly,
    selectedItem,
    showItemDetail,
    showAddFeedDialog,
    showSettingsDialog,
    refreshingFeedIds,

    // 计算属性
    groups,
    groupedFeeds,
    filteredItems,
    unreadCount,
    feedUnreadCounts,

    // 方法
    init,
    addFeed,
    removeFeed,
    refreshFeed,
    refreshAllFeeds,
    updateFeedGroup,
    markAllAsRead: articleOps.markAllAsRead,
    toggleStar: articleOps.toggleStar,
    openItemDetail: articleOps.openItemDetail,
    closeItemDetail: articleOps.closeItemDetail,
    openInBrowser: articleOps.openInBrowser,
    updateSettings,
    setFeedFilter,
    setGroupFilter,
    toggleGroupCollapse,
    renameGroup,
    collapsedGroups,

    // OPML
    exportOpml: opmlOps.exportOpml,
    importOpml: opmlOps.importOpml,

    // 阅读体验
    changeDetailFontSize,
  }
}
