// Paginator 页码窗口：按窗口大小以当前页为中心滑动，两端超出折叠为省略号
// （纯函数，不依赖 Vue 响应式；Paginator.vue 的私有模块，禁止 feature 直接导入）

import type { PageLink } from "./types"
import { PAGE_LINK_ELLIPSIS } from "./types"

/**
 * 解析要展示的页码窗口。
 *
 * 规则：
 * - `totalPages <= pageLinkSize` ⇒ 全量返回，不折叠
 * - 否则窗口以当前页为中心滑动，且**首页与末页恒显**
 * - 窗口与首页/末页之间**只隔 1 页时直接补上该页**（不产生「跳号却不显示省略号」的错觉），
 *   间隔 ≥ 2 页才以单个省略号占位
 *
 * 约定入参 `totalPages >= 1` 且 `page` 已收敛到 `[1, totalPages]`（调用方负责收敛）。
 *
 * 例（totalPages = 20、pageLinkSize = 5）：
 * - page = 1  ⇒ [1, 2, 3, 4, 5, "ellipsis", 20]
 * - page = 10 ⇒ [1, "ellipsis", 8, 9, 10, 11, 12, "ellipsis", 20]
 * - page = 20 ⇒ [1, "ellipsis", 16, 17, 18, 19, 20]
 */
export function resolvePageLinks(
  page: number,
  totalPages: number,
  pageLinkSize: number,
): PageLink[] {
  const windowSize = Math.max(1, Math.floor(pageLinkSize))

  if (totalPages <= windowSize) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  // 先按当前页居中取窗口，再回拉保证窗口总是满的（不出现「窗口只有 1~2 项」）
  const half = Math.floor(windowSize / 2)
  let start = Math.max(1, page - half)
  let end = Math.min(totalPages, start + windowSize - 1)
  start = Math.max(1, end - windowSize + 1)

  const links: PageLink[] = []

  if (start > 1) {
    links.push(1)
    // 窗口从第 3 页起 ⇒ 与首页之间正好只隔第 2 页，补上而不折叠
    if (start === 3) {
      links.push(2)
    } else if (start > 3) {
      links.push(PAGE_LINK_ELLIPSIS)
    }
  }

  for (let current = start; current <= end; current += 1) {
    links.push(current)
  }

  if (end < totalPages) {
    // 与末页之间正好只隔 1 页 ⇒ 补上；相邻 ⇒ 直接接末页；否则折叠
    if (end === totalPages - 2) {
      links.push(end + 1)
    } else if (end < totalPages - 1) {
      links.push(PAGE_LINK_ELLIPSIS)
    }
    links.push(totalPages)
  }

  return links
}
