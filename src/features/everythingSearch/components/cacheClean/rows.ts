// cacheClean 视图模型构建（纯函数）：根目录行、默认勾选集合、扫描结果修剪与条目平铺

import type {
  CacheEntry,
  CacheRisk,
  CacheRootDef,
  CacheRootId,
  CacheScanResult,
} from "../../types"
import type { CacheRootRow } from "./types"

/** 根目录行构建入参（各数据源由 composable 提供，本函数只做投影） */
export interface RootRowsInput {
  /** 全部根目录定义（`CACHE_ROOTS`，含目录不存在、扫描未覆盖的分类） */
  defs: readonly CacheRootDef[]
  /** rootId → 已解析存在的绝对路径（同一分类可能解析出多个候选目录） */
  pathsByRoot: Map<CacheRootId, string[]>
  /** rootId → 单根扫描结果 */
  resultsByRoot: Map<CacheRootId, {
    size: number
    files: number
    message: string
    entries: CacheEntry[]
  }>
  /** 已选条目路径集合 */
  selected: Set<string>
  /** 分类是否被勾选为扫描位置（显式偏好优先，缺省取 `defaultEnabled`） */
  isEnabled: (id: CacheRootId) => boolean
  /** i18n 取值（入参为 `labelKey`） */
  label: (labelKey: string) => string
}

/**
 * 构建根目录行视图模型。
 *
 * 勾选态语义随扫描状态切换：已扫描时表达「该分类下的条目是否选中」（并用半选态表达部分选中），
 * 未扫描时表达「是否作为扫描位置」—— 二者共用同一个勾选框，避免两套勾选让用户困惑。
 */
export function buildRootRows(input: RootRowsInput): CacheRootRow[] {
  return input.defs.map((def) => {
    const paths = input.pathsByRoot.get(def.id) ?? []
    const result = input.resultsByRoot.get(def.id)
    const entries = result?.entries ?? []
    const picked = entries.filter(entry => input.selected.has(entry.path)).length
    const enabled = input.isEnabled(def.id)
    return {
      id: def.id,
      label: input.label(def.labelKey),
      icon: def.icon,
      risk: def.risk,
      paths,
      enabled,
      // 目录缺失时恒不勾（勾了也扫不到，且会让用户误以为会清理）
      checked: paths.length === 0 ? false : entries.length > 0 ? picked > 0 : enabled,
      indeterminate: picked > 0 && picked < entries.length,
      size: result?.size ?? 0,
      files: result?.files ?? 0,
      message: result?.message ?? "",
    }
  })
}

/**
 * 默认勾选：`risk === "safe"` 的分类下的全部条目。
 *
 * `caution` 分类（Windows Temp / 安装包缓存）不默认勾选 —— 删掉不致命却有副作用，
 * 必须由用户显式勾选，默认集宁小勿大。
 */
export function defaultSelection(
  result: CacheScanResult,
  defs: readonly CacheRootDef[],
): Set<string> {
  const riskByRoot = new Map<CacheRootId, CacheRisk>()
  for (const def of defs) riskByRoot.set(def.id, def.risk)
  const picked = new Set<string>()
  for (const root of result.roots) {
    if (riskByRoot.get(root.rootId) !== "safe") continue
    for (const entry of root.entries) picked.add(entry.path)
  }
  return picked
}

/** 从扫描结果中移除已删除条目并重算合计（部分失败时调用方不应调用本函数） */
export function pruneDeletedEntries(
  result: CacheScanResult,
  deletedPaths: Set<string>,
): CacheScanResult {
  let totalSize = 0
  let totalFiles = 0
  const roots = result.roots.map((root) => {
    const entries = root.entries.filter(entry => !deletedPaths.has(entry.path))
    let size = 0
    for (const entry of entries) {
      if (Number.isFinite(entry.size) && entry.size > 0) size += entry.size
    }
    totalSize += size
    totalFiles += entries.length
    return { ...root, entries, size, files: entries.length }
  })
  return { ...result, roots, size: totalSize, files: totalFiles }
}

/** 把所有分类的条目平铺为一维列表（体积降序，明细区按体积优先展示） */
export function flattenEntries(result: CacheScanResult | null): CacheEntry[] {
  if (!result) return []
  const entries: CacheEntry[] = []
  for (const root of result.roots) entries.push(...root.entries)
  return entries.sort((a, b) => b.size - a.size)
}
