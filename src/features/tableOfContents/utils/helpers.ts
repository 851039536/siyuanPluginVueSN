/**
 * 目录索引工具函数
 */
import * as api from "@/api"
import { getCurrentBlockId } from "@/utils/domUtils"

/** 当前文档/块上下文 */
export interface CurrentContext {
  docId: string | null
  blockId: string | null
}

/**
 * 获取当前激活的编辑器
 */
export function getActiveProtyle(): any {
  const activeTab = document.querySelector(
    ".layout__wnd--active .protyle:not(.fn__none)",
  )
  return activeTab
}

/**
 * 一次性获取当前文档 ID 和块 ID，避免分开调用时的重复 DOM 遍历。
 * 优先通过光标所在块获取，其次使用激活窗口。
 */
export async function getCurrentContext(): Promise<CurrentContext> {
  const blockId = getCurrentBlockId()

  if (blockId) {
    const docId = await api.getDocIdByBlockId(blockId)
    if (docId) { return {
      docId,
      blockId,
    }
    }
  }

  // 降级：通过激活窗口获取文档 ID
  const protyle = getActiveProtyle()
  const docId = protyle
    ?.querySelector(".protyle-background")
    ?.getAttribute("data-node-id") ?? null
  return {
    docId,
    blockId,
  }
}

/**
 * 获取当前文档 ID（优先使用光标所在文档，其次使用激活窗口）。
 * 如需同时获取 blockId，请使用 getCurrentContext() 以避免重复 DOM 查询。
 */
export async function getCurrentDocId(): Promise<string | null> {
  const { docId } = await getCurrentContext()
  return docId
}

/**
 * 转义SQL字符串,防止SQL注入
 */
export function escapeSqlString(str: string): string {
  if (!str) return ""
  // 转义单引号,防止SQL注入
  return str.replace(/'/g, "''")
}

/**
 * 查找文档中该类型的所有索引块 ID。
 * 第一步：通过 ial LIKE 找到候选块，第二步：通过 getBlockAttrs 过滤类型。
 * 与开源项目 Szerelem0617/siyuan-plugins-index 模式完全一致。
 */
export async function findExistingIndexBlockIds(
  docId: string,
  indexType: string,
): Promise<string[]> {
  const safeDocId = escapeSqlString(docId)

  try {
    const rows = await api.sql(`
      SELECT b.id
      FROM blocks b
      WHERE b.root_id = '${safeDocId}'
      AND b.ial LIKE '%custom-toc-type%'
      ORDER BY b.sort ASC
    `)

    if (!rows || rows.length === 0) return []

    const attrPromises = rows.map((r: any) => api.getBlockAttrs(r.id))
    const allAttrs = await Promise.all(attrPromises)

    return rows
      .filter((_: any, i: number) => allAttrs[i]?.["custom-toc-type"] === indexType)
      .map((r: any) => r.id)
  } catch (error) {
    console.error("查找索引块失败:", error)
    return []
  }
}
