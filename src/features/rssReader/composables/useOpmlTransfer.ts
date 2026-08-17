/**
 * RSS OPML 导入导出组合式函数
 */
import { showMessage } from "siyuan"
import type { Ref } from "vue"
import type { RssFeed } from "../types"
import {
  exportToOpml,
  parseOpml,
} from "../utils/opml"

export interface OpmlTransferDeps {
  feeds: Ref<RssFeed[]>
  i18n: Record<string, string>
  addFeed: (url: string, group?: string, options?: { silent?: boolean }) => Promise<boolean>
}

export function useOpmlTransfer(deps: OpmlTransferDeps) {
  const {
    feeds,
    i18n,
    addFeed,
  } = deps

  /**
   * 导出 OPML 文件（返回 XML 字符串，空列表返回 ""）
   */
  function exportOpml(): string {
    return exportToOpml(feeds.value)
  }

  /**
   * 导入 OPML 文件
   */
  async function importOpml(xml: string): Promise<{ success: number, failed: number }> {
    const outlines = parseOpml(xml)
    if (outlines.length === 0) {
      showMessage(i18n.noValidFeeds, 3000, "error")
      return {
        success: 0,
        failed: 0,
      }
    }

    let success = 0
    let failed = 0
    for (const outline of outlines) {
      try {
        const ok = await addFeed(outline.url, outline.group, { silent: true })
        if (ok) success++
        else failed++
      } catch {
        failed++
      }
    }
    showMessage(`${i18n.opmlImportResult}: ${success} succeeded, ${failed} failed`, 4000, "info")
    return {
      success,
      failed,
    }
  }

  return {
    exportOpml,
    importOpml,
  }
}
