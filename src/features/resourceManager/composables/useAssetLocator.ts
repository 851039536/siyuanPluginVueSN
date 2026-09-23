// 资源定位 composable：查询引用资源的块并以 siyuan:// 协议跳转（assets 等值 → blocks 全路径 → 文件名兜底）
import type { ResourceManagerI18n } from "../types"
import { sql } from "@/api"
import { openBlock } from "@/utils/domUtils"
import { buildPathVariants, escapeSqlString, queryBlocksByMarkdown } from "../utils"

/** assets 表单资源引用查询上限 */
const ASSET_REF_LIMIT = 32
/** blocks 表兜底查询上限 */
const BLOCK_REF_LIMIT = 5

/**
 * assets 表按 path 等值查询引用块 id；
 * 返回 null 表示查询失败（内核/数据库异常），空 Set 表示查询成功但无引用
 */
async function queryAssetRefs(path: string): Promise<Set<string> | null> {
  const ids = new Set<string>()
  for (const variant of buildPathVariants(path)) {
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

/**
 * blocks 表 markdown 模糊匹配引用块 id（needle 为完整路径或文件名片段）；
 * 返回 null 表示查询失败，与"无引用"严格区分，避免内核故障被误报为未找到
 */
async function queryBlockRefs(needle: string): Promise<Set<string> | null> {
  const ids = new Set<string>()
  for (const variant of buildPathVariants(needle)) {
    const rows = await queryBlocksByMarkdown(variant, BLOCK_REF_LIMIT)
    if (!rows) return null
    for (const row of rows) {
      if (row.id) ids.add(row.id)
    }
  }
  return ids
}

/** 资源定位逻辑，供 useResourceManager 组合复用；showMsg 由调用方注入以复用统一提示封装 */
export function useAssetLocator(i18n: ResourceManagerI18n, showMsg: (msg: string) => void) {
  /**
   * 定位资源引用并跳转：assets 等值 → blocks 全路径 → 文件名兜底
   * 文件名兜底覆盖"移动后思源索引异步刷新、旧路径尚未更新"的窗口期
   * （移动仅改目录不改文件名，旧索引行仍含同名文件名可命中）
   * 任一层查询失败（返回 null）即中止并提示定位失败，不降级为"未找到"
   */
  async function handleLocateAsset(path: string) {
    const queries: (() => Promise<Set<string> | null>)[] = [() => queryAssetRefs(path)]
    const baseName = path.split("/").pop()
    queries.push(() => queryBlockRefs(path))
    if (baseName) queries.push(() => queryBlockRefs(`/${baseName}`))

    let refIds: Set<string> | null = null
    for (const query of queries) {
      refIds = await query()
      if (!refIds) {
        showMsg(i18n.locateFailed)
        return
      }
      if (refIds.size > 0) break
    }

    if (!refIds || refIds.size === 0) {
      showMsg(i18n.locateNotFound)
      return
    }
    if (refIds.size > 1) showMsg((i18n.locateRefs ?? "").replace("{count}", String(refIds.size)))
    openBlock([...refIds][0])
  }

  return { handleLocateAsset }
}
