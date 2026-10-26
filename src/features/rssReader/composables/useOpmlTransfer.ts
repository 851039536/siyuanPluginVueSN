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
  addFeed: (url: string, group?: string, options?: { silent?: boolean, deferPersist?: boolean }) => Promise<boolean>
  /** 批量导入结束后统一落盘 */
  persist: () => Promise<void>
}

export function useOpmlTransfer(deps: OpmlTransferDeps) {
  const {
    i18n,
    addFeed,
    persist,
  } = deps

  /**
   * 导出 OPML 文件（返回 XML 字符串，空列表返回 ""）
   */
  function exportOpml(): string {
    return exportToOpml(feeds.value)
  }

  /**
   * 导入 OPML 文件（受控并发抓取校验，全部完成后统一落盘一次）
   */
  async function importOpml(xml: string): Promise<{ success: number, failed: number }> {
    const outlines = parseOpml(xml, i18n.opmlParseFailed)
    if (outlines.length === 0) {
      showMessage(i18n.noValidFeeds, 3000, "error")
      return {
        success: 0,
        failed: 0,
      }
    }

    /** 导入并发上限（addFeed 的状态变更段为同步原子段，并发安全） */
    const IMPORT_CONCURRENCY = 3
    let success = 0
    let failed = 0
    const queue = [...outlines]
    const workers = Array.from(
      { length: Math.min(IMPORT_CONCURRENCY, queue.length) },
      async () => {
        while (queue.length > 0) {
          const outline = queue.shift()
          if (!outline) break
          try {
            const ok = await addFeed(outline.url, outline.group, { silent: true, deferPersist: true })
            if (ok) success++
            else failed++
          } catch {
            failed++
          }
        }
      },
    )
    await Promise.all(workers)

    if (success > 0) {
      await persist()
    }
    const detail = (i18n.opmlImportResultDetail || "{success} succeeded, {failed} failed")
      .replace(/\{success\}/g, String(success))
      .replace(/\{failed\}/g, String(failed))
    showMessage(`${i18n.opmlImportResult}: ${detail}`, 4000, "info")
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
