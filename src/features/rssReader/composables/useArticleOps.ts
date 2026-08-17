/**
 * RSS文章操作组合式函数 — 文章列表/详情中的标记、收藏、打开等操作
 */
import type {
  Ref,
} from "vue"
import type {
  RssItem,
} from "../types"

export interface ArticleOpsDeps {
  items: Ref<RssItem[]>
  selectedItem: Ref<RssItem | null>
  showItemDetail: Ref<boolean>
  /** 持久化 items 变更 */
  persist: () => Promise<void>
}

export function useArticleOps(deps: ArticleOpsDeps) {
  const {
    items,
    selectedItem,
    showItemDetail,
    persist,
  } = deps

  /**
   * 标记所有文章为已读
   */
  async function markAllAsRead() {
    if (!Array.isArray(items.value)) return
    items.value.forEach((i) => {
      i.read = true
    })
    await persist()
  }

  /**
   * 切换收藏状态
   */
  async function toggleStar(itemId: string) {
    if (!Array.isArray(items.value)) return
    const item = items.value.find((i) => i.link === itemId || (i as any).id === itemId)
    if (item) {
      item.starred = !item.starred
      await persist()
    }
  }

  /**
   * 打开文章详情
   */
  function openItemDetail(item: RssItem) {
    // 标记为已读
    if (!item.read) {
      item.read = true
      persist()
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

  return {
    markAllAsRead,
    toggleStar,
    openItemDetail,
    closeItemDetail,
    openInBrowser,
  }
}
