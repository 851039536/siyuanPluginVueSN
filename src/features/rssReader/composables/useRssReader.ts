/**
 * RSS订阅功能 - 核心逻辑组合式函数
 */
import type { Plugin } from "siyuan"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
  watch,
} from "vue"
import type {
  RssFeed,
  RssItem,
  RssLoadingStatus,
  RssSettings,
  RssSortOrder,
  RssViewMode,
} from "../types"
import { DEFAULT_RSS_SETTINGS } from "../types"
import { RssStorage } from "../types/storage"
import { generateId, parseRssXml } from "../utils/parser"

export function useRssReader(plugin: Plugin) {
  // ========== 存储 ==========
  const storage = new RssStorage(plugin)

  // ========== 响应式状态 ==========
  const settings = ref<RssSettings>({ ...DEFAULT_RSS_SETTINGS })
  const feeds = ref<RssFeed[]>([])
  const items = ref<RssItem[]>([])
  const loadingStatus = ref<RssLoadingStatus>("idle")
  const errorMessage = ref("")
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

  /** 按当前过滤条件筛选的文章 */
  const filteredItems = computed(() => {
    const arr = Array.isArray(items.value) ? items.value : []
    let result = [...arr]

    // 按订阅源过滤
    if (currentFeedFilter.value !== "all") {
      result = result.filter(i => i.feedId === currentFeedFilter.value)
    }

    // 按分组过滤
    if (currentGroupFilter.value !== "all") {
      const feedIdsInGroup = feeds.value
        .filter(f => f.group === currentGroupFilter.value)
        .map(f => f.id)
      result = result.filter(i => feedIdsInGroup.includes(i.feedId))
    }

    // 搜索关键词
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase()
      result = result.filter(
        i =>
          i.title?.toLowerCase().includes(kw)
          || i.description?.toLowerCase().includes(kw),
      )
    }

    // 仅收藏
    if (showStarredOnly.value) {
      result = result.filter(i => i.starred)
    }

    // 仅未读
    if (showUnreadOnly.value) {
      result = result.filter(i => !i.read)
    }

    // 排序
    result.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0
      return settings.value.sortOrder === "newest"
        ? dateB - dateA
        : dateA - dateB
    })

    return result
  })

  /** 未读数统计 */
  const unreadCount = computed(() => {
    const arr = Array.isArray(items.value) ? items.value : []
    return arr.filter(i => !i.read).length
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
      showMessage("请输入RSS订阅地址", 3000, "error")
      return false
    }

    // 添加 https:// 前缀
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`
    }

    // 检查重复
    if (feeds.value.some(f => f.url === url)) {
      showMessage("该订阅源已存在", 3000, "error")
      return false
    }

    loadingStatus.value = "loading"
    errorMessage.value = ""

    try {
      const response = await fetchRss(url)
      const { feed: feedInfo, items: parsedItems } = parseRssXml(response, url)

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

      const newItems: RssItem[] = parsedItems.map(pi => ({
        title: pi.title || "无标题",
        link: pi.link || "",
        description: pi.description,
        pubDate: pi.pubDate,
        author: pi.author,
        feedId: newFeed.id,
        feedTitle: newFeed.title,
        read: false,
        starred: false,
        content: pi.content,
        coverImage: pi.coverImage,
        categories: pi.categories,
      }))

      feeds.value.push(newFeed)
      items.value.push(...newItems)

      await saveData()
      loadingStatus.value = "success"
      showMessage(`已添加订阅源: ${newFeed.title}`, 3000, "info")
      return true
    } catch (err: any) {
      loadingStatus.value = "error"
      errorMessage.value = err.message || "添加订阅源失败"
      showMessage(errorMessage.value, 5000, "error")
      return false
    }
  }

  /**
   * 删除订阅源
   */
  async function removeFeed(feedId: string) {
    feeds.value = Array.isArray(feeds.value) ? feeds.value.filter(f => f.id !== feedId) : []
    items.value = Array.isArray(items.value) ? items.value.filter(i => i.feedId !== feedId) : []

    if (currentFeedFilter.value === feedId) {
      currentFeedFilter.value = "all"
    }

    await saveData()
    showMessage("已删除订阅源", 2000, "info")
  }

  /**
   * 刷新单个订阅源
   */
  async function refreshFeed(feedId: string) {
    const feed = feeds.value.find(f => f.id === feedId)
    if (!feed) return

    refreshingFeedIds.value.add(feedId)

    try {
      const response = await fetchRss(feed.url)
      const { feed: feedInfo, items: parsedItems } = parseRssXml(response, feed.url)

      // 更新订阅源信息
      if (feedInfo.title) feed.title = feedInfo.title
      if (feedInfo.description) feed.description = feedInfo.description
      if (feedInfo.siteUrl) feed.siteUrl = feedInfo.siteUrl
      if (feedInfo.iconUrl) feed.iconUrl = feedInfo.iconUrl
      feed.lastUpdated = new Date().toISOString()

      // 合并新文章（通过链接去重）
      const existingLinks = new Set(
        Array.isArray(items.value)
          ? items.value.filter(i => i.feedId === feedId).map(i => i.link)
          : [],
      )

      const newItems: RssItem[] = []
      for (const pi of parsedItems) {
        const link = pi.link || ""
        if (link && !existingLinks.has(link)) {
          newItems.push({
            title: pi.title || "无标题",
            link,
            description: pi.description,
            pubDate: pi.pubDate,
            author: pi.author,
            feedId,
            feedTitle: feed.title,
            read: false,
            starred: false,
            content: pi.content,
            coverImage: pi.coverImage,
            categories: pi.categories,
          })
          existingLinks.add(link)
        }
      }

      if (newItems.length > 0) {
        items.value.push(...newItems)
        showMessage(`${feed.title}: ${newItems.length}篇新文章`, 3000, "info")
      } else {
        showMessage(`${feed.title}: 暂无新文章`, 2000, "info")
      }

      // 限制每个源的文章数
      trimItemsPerFeed()

      await saveData()
    } catch (err: any) {
      showMessage(`刷新失败: ${err.message}`, 5000, "error")
    } finally {
      refreshingFeedIds.value.delete(feedId)
    }
  }

  /**
   * 刷新所有订阅源
   */
  async function refreshAllFeeds() {
    loadingStatus.value = "loading"
    const enabledFeeds = feeds.value.filter(f => f.enabled)

    for (const feed of enabledFeeds) {
      await refreshFeed(feed.id)
    }

    loadingStatus.value = "idle"
  }

  /**
   * 更新订阅源分组
   */
  async function updateFeedGroup(feedId: string, group: string) {
    const feed = feeds.value.find(f => f.id === feedId)
    if (feed) {
      feed.group = group
      await saveData()
    }
  }

  // ========== 文章操作 ==========

  /**
   * 标记文章为已读
   */
  async function markAsRead(itemId: string) {
    if (!Array.isArray(items.value)) return
    const item = items.value.find(i => i.link === itemId || (i as any).id === itemId)
    if (item && !item.read) {
      item.read = true
      await saveData()
    }
  }

  /**
   * 标记所有文章为已读
   */
  async function markAllAsRead() {
    if (!Array.isArray(items.value)) return
    items.value.forEach((i) => {
      i.read = true
    })
    await saveData()
    showMessage("已全部标记为已读", 2000, "info")
  }

  /**
   * 切换收藏状态
   */
  async function toggleStar(itemId: string) {
    if (!Array.isArray(items.value)) return
    const item = items.value.find(i => i.link === itemId || (i as any).id === itemId)
    if (item) {
      item.starred = !item.starred
      await saveData()
    }
  }

  /**
   * 打开文章详情
   */
  function openItemDetail(item: RssItem) {
    // 标记为已读
    if (!item.read) {
      item.read = true
      saveData()
    }
    selectedItem.value = item
    showItemDetail.value = true
  }

  /**
   * 关闭文章详情
   */
  function closeItemDetail() {
    showItemDetail.value = false
    selectedItem.value = null
  }

  /**
   * 在浏览器中打开文章
   */
  function openInBrowser(item: RssItem) {
    if (item.link) {
      window.open(item.link, "_blank")
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

  // ========== 内部方法 ==========

  /**
   * 创建 AbortSignal（兼容旧版浏览器，手动管理超时）
   */
  function createTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ms)
    return {
      signal: controller.signal,
      clear: () => clearTimeout(timer),
    }
  }

  /**
   * 带超时的 fetch 封装
   */
  async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
    const { signal, clear } = createTimeoutSignal(timeoutMs)
    try {
      const response = await fetch(url, { ...options, signal })
      clear()
      return response
    } catch (err) {
      clear()
      throw err
    }
  }

  /**
   * 获取RSS内容
   */
  async function fetchRss(url: string): Promise<string> {
    const proxyUrls = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
    ]

    // 先尝试直接请求
    try {
      const response = await fetchWithTimeout(url, {
        method: "GET",
        headers: { "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml" },
      }, 8000)
      if (response.ok) {
        return await response.text()
      }
    } catch {}

    // 直接请求失败，尝试代理
    for (const proxyUrl of proxyUrls) {
      try {
        const response = await fetchWithTimeout(proxyUrl, {}, 12000)
        if (response.ok) {
          return await response.text()
        }
      } catch {}
    }

    throw new Error("无法获取RSS内容，请检查网络连接或订阅地址是否正确")
  }

  /**
   * 限制每个订阅源的文章数量
   */
  function trimItemsPerFeed() {
    const maxItems = settings.value.maxItemsPerFeed
    const feedItemMap = new Map<string, RssItem[]>()

    if (!Array.isArray(items.value)) return
    for (const item of items.value) {
      if (!feedItemMap.has(item.feedId)) {
        feedItemMap.set(item.feedId, [])
      }
      feedItemMap.get(item.feedId)!.push(item)
    }

    const trimmedItems: RssItem[] = []
    for (const [feedId, feedItems] of feedItemMap) {
      // 保留收藏的，从非收藏中截断
      const starred = feedItems.filter(i => i.starred)
      const unstarred = feedItems.filter(i => !i.starred)

      // 按日期排序
      unstarred.sort((a, b) => {
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0
        return dateB - dateA
      })

      const kept = unstarred.slice(0, Math.max(0, maxItems - starred.length))
      trimmedItems.push(...starred, ...kept)
    }

    items.value = trimmedItems
  }

  /**
   * 保存数据
   */
  async function saveData() {
    await Promise.all([
      storage.feeds.save(feeds.value),
      storage.items.save(items.value),
    ])
  }

  return {
    // 状态
    settings,
    feeds,
    items,
    loadingStatus,
    errorMessage,
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
    markAsRead,
    markAllAsRead,
    toggleStar,
    openItemDetail,
    closeItemDetail,
    openInBrowser,
    updateSettings,
    setFeedFilter,
    setGroupFilter,
  }
}
