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
import {
  generateId,
  parseRssXml,
} from "../utils/parser"
import { fetchRss } from "../utils/fetchRss"
import { trimItemsPerFeed } from "../utils/itemTrim"
import { normalizeParsedItems } from "../utils/items"
import { getPubDateTimestamp } from "../utils/date"
import type {
  RssFeed,
  RssGroupItem,
  RssItem,
  RssLoadingStatus,
  RssSettings,
} from "../types"
import { DEFAULT_RSS_SETTINGS } from "../types"
import { RssStorage } from "../types/storage"
import { useArticleOps } from "./useArticleOps"
import { useAutoRefresh } from "./useAutoRefresh"
import { useSettingsOps } from "./useSettingsOps"
import { useOpmlTransfer } from "./useOpmlTransfer"
import { getErrorMessage } from "@/utils/stringUtils"

export function useRssReader(plugin: Plugin) {
  // ========== 存储 ==========
  const storage = new RssStorage(plugin)
  const rssI18n = (plugin.i18n as any)?.rssReader || {}

  /** 刷新全部时的并发上限（fetchRss 每源最坏 75s，串行会放大数倍） */
  const REFRESH_CONCURRENCY = 3

  // ========== 响应式状态 ==========
  const settings = ref<RssSettings>({ ...DEFAULT_RSS_SETTINGS })
  const feeds = ref<RssFeed[]>([])
  const items = ref<RssItem[]>([])
  const loadingStatus = ref<RssLoadingStatus>("idle")
  const currentFeedFilter = ref<string>("all") // "all" 或 feedId
  const currentGroupFilter = ref<string>("all") // "all" 或 group名
  const searchKeyword = ref("")
  // 搜索防抖：输入框实时回显，过滤计算延迟生效，避免每键击全量 filter+sort
  const searchKeywordDebounced = ref("")
  let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined
  watch(searchKeyword, (v) => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      searchKeywordDebounced.value = v
    }, 300)
  })
  const showStarredOnly = ref(false)
  const showUnreadOnly = ref(false)
  const selectedItem = ref<RssItem | null>(null)
  const showItemDetail = ref(false)
  const showAddFeedDialog = ref(false)
  const showSettingsDialog = ref(false)
  const refreshingFeedIds = ref<Set<string>>(new Set())
  const collapsedGroups = ref<Set<string>>(new Set())
  const refreshingAll = ref(false)

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

    const result: RssGroupItem[] = []
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

    // 搜索关键词（防抖值）
    if (searchKeywordDebounced.value) {
      const kw = searchKeywordDebounced.value.toLowerCase()
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

    // 排序（pubDate 解析结果按字符串缓存，避免比较器内 O(n log n) 次 Date 解析）
    const tsCache = new Map<string, number>()
    const tsOf = (d?: string) => {
      if (!d) return 0
      let t = tsCache.get(d)
      if (t === undefined) {
        t = getPubDateTimestamp(d)
        tsCache.set(d, t)
      }
      return t
    }
    result.sort((a, b) => {
      const dateA = tsOf(a.pubDate)
      const dateB = tsOf(b.pubDate)
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
      startAutoRefresh()
    } catch (err) {
      console.error("[RSS] 初始化失败:", err)
      showMessage(rssI18n.initFailed || "Failed to load data", 3000, "error")
    }
  }

  // ========== 自动刷新 ==========
  const autoRefresh = useAutoRefresh({
    settings,
    refreshAll: refreshAllFeeds,
  })

  function startAutoRefresh() {
    autoRefresh.start()
  }

  function stopAutoRefresh() {
    autoRefresh.stop()
  }

  // ========== 订阅源操作 ==========

  /**
   * 添加新的RSS订阅源
   * @param options.silent 静默模式（OPML 批量导入用，不弹提示）
   * @param options.deferPersist 跳过本次落盘，由调用方批量保存（OPML 导入用，避免 N 次全量写盘）
   */
  async function addFeed(url: string, group?: string, options?: { silent?: boolean, deferPersist?: boolean }) {
    url = url.trim()
    if (!url) {
      if (!options?.silent) showMessage(rssI18n.feedUrlRequired, 3000, "error")
      return false
    }

    // 添加 https:// 前缀
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`
    }

    // 检查重复
    if (feeds.value.some((f) => f.url === url)) {
      if (!options?.silent) showMessage(rssI18n.feedExisted, 3000, "error")
      return false
    }

    try {
      const response = await fetchRss(url)

      // 并发导入时前置查重存在竞态窗口（多个相同 URL 同时通过检查），落定后复查一次
      if (feeds.value.some((f) => f.url === url)) {
        if (!options?.silent) showMessage(rssI18n.feedExisted, 3000, "error")
        return false
      }

      const {
        feed: feedInfo,
        items: parsedItems,
      } = parseRssXml(response, url, {
        unrecognizedFormat: rssI18n.errorUnrecognizedFormat,
        xmlParseFailed: rssI18n.errorXmlParseFailed,
      })

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
      }

      const newItems: RssItem[] = normalizeParsedItems(parsedItems, newFeed.id, newFeed.title, rssI18n.untitled)

      feeds.value.push(newFeed)
      items.value = items.value.concat(newItems)
      // 首次导入也可能超过单源上限，添加后立即裁剪（此前仅刷新路径裁剪）
      trimItemsPerFeed(items, settings.value.maxItemsPerFeed)

      if (!options?.deferPersist) {
        await saveData()
      }
      if (!options?.silent) showMessage(`${rssI18n.feedAddedDetail}: ${newFeed.title}`, 3000, "info")
      return true
    } catch (err: unknown) {
      if (!options?.silent) showMessage(getErrorMessage(err) || rssI18n.feedAddFailed, 5000, "error")
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

    // 若当前分组过滤已无任何源，重置为“全部”
    if (currentGroupFilter.value !== "all"
      && !feeds.value.some((f) => f.group === currentGroupFilter.value)) {
      currentGroupFilter.value = "all"
    }

    await saveData()
    showMessage(rssI18n.feedDeleted, 2000, "info")
  }

  /**
   * 刷新单个订阅源
   * @param options.deferPersist 跳过本次落盘，由调用方批量保存（refreshAllFeeds 用，避免并发写盘乱序 + N 次全量写盘）
   */
  async function refreshFeed(feedId: string, options?: { deferPersist?: boolean }) {
    if (refreshingFeedIds.value.has(feedId)) return
    const feed = feeds.value.find((f) => f.id === feedId)
    if (!feed) return

    refreshingFeedIds.value.add(feedId)

    try {
      const response = await fetchRss(feed.url)
      const {
        feed: feedInfo,
        items: parsedItems,
      } = parseRssXml(response, feed.url, {
        unrecognizedFormat: rssI18n.errorUnrecognizedFormat,
        xmlParseFailed: rssI18n.errorXmlParseFailed,
      })

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

      // fetch 期间该源可能已被删除，重新校验
      if (!feeds.value.some((f) => f.id === feedId)) return

      const newItems: RssItem[] = normalizeParsedItems(parsedItems, feedId, feed.title, rssI18n.untitled)
        .filter((item) => !existingLinks.has(item.link))

      if (newItems.length > 0) {
        items.value = items.value.concat(newItems)
        showMessage(`${feed.title}: ${newItems.length}${rssI18n.newArticlesDetail}`, 3000, "info")
      } else {
        showMessage(`${feed.title}: ${rssI18n.noNewArticlesDetail}`, 2000, "info")
      }

      // 限制每个源的文章数
      trimItemsPerFeed(items, settings.value.maxItemsPerFeed)

      if (!options?.deferPersist) {
        await saveData()
      }
    } catch (err: unknown) {
      showMessage(`${rssI18n.refreshDetailFailed}: ${getErrorMessage(err)}`, 5000, "error")
    } finally {
      refreshingFeedIds.value.delete(feedId)
    }
  }

  /**
   * 刷新所有订阅源（受控并发，避免串行放大整体耗时）
   */
  async function refreshAllFeeds() {
    if (refreshingAll.value) return
    refreshingAll.value = true
    loadingStatus.value = "loading"
    try {
      const queue = [...feeds.value]
      const workers = Array.from(
        { length: Math.min(REFRESH_CONCURRENCY, queue.length) },
        async () => {
          while (queue.length > 0) {
            const feed = queue.shift()
            if (feed) await refreshFeed(feed.id, { deferPersist: true })
          }
        },
      )
      await Promise.all(workers)
      // 并发刷新期间多个源各自变更，统一落盘一次（单次全量快照，天然无写盘乱序）
      await saveData()
    } finally {
      loadingStatus.value = "idle"
      refreshingAll.value = false
    }
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

  // ========== 内部方法 ==========

  /**
   * 保存数据（promise 链互斥）
   * 并发场景下（刷新/导入/编辑交错）各调用方快照时序不定，
   * 串行化后每次写盘都读取"轮到自己时"的最新状态，杜绝 I/O 乱序用旧快照覆盖新快照。
   */
  let saveChain: Promise<void> = Promise.resolve()
  async function saveData() {
    const run = saveChain.then(() => Promise.all([
      storage.feeds.save(feeds.value),
      storage.items.save(items.value),
    ]))
    // 吞掉失败防止断链（TypedStorage.save 内部已 catch 落日志，此处为兜底）
    saveChain = run.then(() => undefined, () => undefined)
    await run
  }

  // ========== 设置/分组操作（独立 composable） ==========
  const settingsOps = useSettingsOps({
    settings,
    feeds,
    collapsedGroups,
    currentGroupFilter,
    saveData,
    saveSettings: (newSettings) => storage.settings.save(newSettings),
    startAutoRefresh,
    i18n: rssI18n,
  })

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
    persist: saveData,
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
    searchKeywordDebounced,
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
    updateFeedGroup: settingsOps.updateFeedGroup,
    markAllAsRead: articleOps.markAllAsRead,
    toggleStar: articleOps.toggleStar,
    openItemDetail: articleOps.openItemDetail,
    closeItemDetail: articleOps.closeItemDetail,
    openInBrowser: articleOps.openInBrowser,
    updateSettings: settingsOps.updateSettings,
    setFeedFilter,
    setGroupFilter,
    toggleGroupCollapse,
    renameGroup: settingsOps.renameGroup,
    collapsedGroups,

    // OPML
    exportOpml: opmlOps.exportOpml,
    importOpml: opmlOps.importOpml,

    // 阅读体验
    changeDetailFontSize: settingsOps.changeDetailFontSize,

    // 自动刷新
    startAutoRefresh,
    stopAutoRefresh,
  }
}
