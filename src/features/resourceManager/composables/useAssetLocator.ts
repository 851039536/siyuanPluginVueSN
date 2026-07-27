// 资源定位 composable：查询引用资源的块并以 siyuan:// 协议跳转（assets 等值 → blocks 全路径 → 文件名兜底）
import type { ResourceManagerI18n } from "../types"
import { showMessage } from "siyuan"
import { sql } from "@/api"
import { escapeSqlLike, escapeSqlString } from "../utils"

/** assets 表单资源引用查询上限 */
const ASSET_REF_LIMIT = 32
/** blocks 表兜底查询上限 */
const BLOCK_REF_LIMIT = 5

/** 生成原始与 URL 编码双形态（含中文/空格的路径在 markdown 中以编码形式存储） */
function buildVariants(str: string): string[] {
  const encoded = encodeURI(str)
  return encoded === str ? [str] : [str, encoded]
}

/** assets 表按 path 等值查询引用块 id；sql 静默失败时返回 null */
async function queryAssetRefs(path: string): Promise<Set<string> | null> {
  const ids = new Set<string>()
  for (const variant of buildVariants(path)) {
    const rows = await sql(
      `SELECT block_id, root_id FROM assets WHERE path = '${escapeSqlString(variant)}' LIMIT ${ASSET_REF_LIMIT}`,
    ) as { block_id: string, root_id: string }[] | null
    if (!rows) return null
    for (const row of rows) {
      const id = row.block_id || row.root_id
      if (id) ids.add(id)
    }
  }
  return ids
}

/** blocks 表 markdown 模糊匹配引用块 id（needle 为完整路径或文件名片段） */
async function queryBlockRefs(needle: string): Promise<Set<string>> {
  const ids = new Set<string>()
  for (const variant of buildVariants(needle)) {
    const rows = await sql(
      `SELECT DISTINCT id, root_id FROM blocks WHERE markdown LIKE '%${escapeSqlLike(variant)}%' ESCAPE '\\' ORDER BY updated DESC LIMIT ${BLOCK_REF_LIMIT}`,
    ) as { id: string, root_id: string }[] | null
    for (const row of rows || []) {
      const id = row.id || row.root_id
      if (id) ids.add(id)
    }
  }
  return ids
}

/** 资源定位逻辑，供 useResourceManager 组合复用 */
export function useAssetLocator(i18n: ResourceManagerI18n) {
  function showMsg(msg: string) {
    try { showMessage(msg, 3000, "info") }
    catch { /* ignore */ }
  }

  /**
   * 定位资源引用并跳转：assets 等值 → blocks 全路径 → 文件名兜底
   * 文件名兜底覆盖"移动后思源索引异步刷新、旧路径尚未更新"的窗口期
   * （移动仅改目录不改文件名，旧索引行仍含同名文件名可命中）
   */
  async function handleLocateAsset(path: string) {
    let refIds = await queryAssetRefs(path)
    if (!refIds) {
      showMsg(i18n.locateFailed)
      return
    }
    if (refIds.size === 0) refIds = await queryBlockRefs(path)
    if (refIds.size === 0) {
      const baseName = path.split("/").pop()
      if (baseName) refIds = await queryBlockRefs(`/${baseName}`)
    }
    if (refIds.size === 0) {
      showMsg(i18n.locateNotFound)
      return
    }
    if (refIds.size > 1) showMsg(i18n.locateRefs.replace("{count}", String(refIds.size)))
    window.open(`siyuan://blocks/${[...refIds][0]}`)
  }

  return { handleLocateAsset }
}
