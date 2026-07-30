/**
 * S3 文件管理器目录浏览 composable
 *
 * 维护当前目录前缀、条目列表（delimiter 懒加载 + 目录缓存）、排序与
 * 面包屑导航；服务端不支持 delimiter 时降级为全量列举 + 客户端聚合。
 */
import { computed, ref, shallowRef } from "vue"
import type { S3Client } from "@/utils/s3/s3Client"
import { listDir } from "@/utils/s3/s3ObjectOps"
import type { S3DirListing } from "@/utils/s3/s3ObjectOps"
import { getErrorMessage } from "@/utils/stringUtils"
import type { S3Entry, SortField } from "../types"
import { RENDER_BATCH_SIZE } from "../types"
import {
  aggregateEntries, buildEntries, compareEntries,
  parentPrefix, prefixFromSegments, splitPrefixSegments,
} from "../utils"

export function useS3Entries(deps: {
  requireClient: () => S3Client
  getRootPrefix: () => string
}) {
  // ========== 状态 ==========

  const currentPrefix = ref("")
  /** 大目录场景用 shallowRef 存储，整体替换避免深层响应式开销 */
  const entries = shallowRef<S3Entry[]>([])
  const loading = ref(false)
  const loadError = ref("")
  const sortField = ref<SortField>("name")
  const sortAsc = ref(true)
  /** 增量渲染上限（大目录先渲染一批，"加载更多"递增） */
  const renderLimit = ref(RENDER_BATCH_SIZE)

  /** 目录缓存：prefix → 条目列表（写操作后定向失效） */
  const cache = new Map<string, S3Entry[]>()
  /** 服务端 delimiter 能力探测结果（首次失败后固定走降级路径） */
  let delimiterUnsupported = false

  // ========== 计算属性 ==========

  const sortedEntries = computed<S3Entry[]>(() =>
    [...entries.value].sort((a, b) => compareEntries(a, b, sortField.value, sortAsc.value)),
  )

  const visibleEntries = computed(() => sortedEntries.value.slice(0, renderLimit.value))

  const hasMore = computed(() => sortedEntries.value.length > renderLimit.value)

  /** 面包屑段（相对浏览根前缀） */
  const pathSegments = computed(() => {
    const root = deps.getRootPrefix()
    const relative = currentPrefix.value.startsWith(root)
      ? currentPrefix.value.slice(root.length)
      : currentPrefix.value
    return splitPrefixSegments(relative)
  })

  const isAtRoot = computed(() => currentPrefix.value === deps.getRootPrefix())

  // ========== 方法 ==========

  /** 加载指定目录（命中缓存直接展示；force 跳过缓存） */
  async function loadDir(prefix: string, force = false): Promise<void> {
    if (!force && cache.has(prefix)) {
      entries.value = cache.get(prefix)!
      currentPrefix.value = prefix
      renderLimit.value = RENDER_BATCH_SIZE
      loadError.value = ""
      return
    }

    loading.value = true
    loadError.value = ""
    try {
      const client = deps.requireClient()
      let listing: S3DirListing | null = null

      if (!delimiterUnsupported) {
        try {
          listing = await listDir(client, prefix)
        } catch (err) {
          // 代理不支持 delimiter 时降级为全量列举 + 客户端按 / 聚合（能力探测结果缓存）
          console.warn("[S3文件管理] delimiter 列举失败，降级为全量聚合:", getErrorMessage(err))
          delimiterUnsupported = true
        }
      }

      let files: S3DirListing["files"]
      let folders: string[]
      if (listing) {
        // 防御性客户端聚合：服务端静默忽略 delimiter（返回扁平递归列举且无 CommonPrefixes）时，
        // 把嵌套对象按 / 折叠回当前层文件夹，避免子目录文件冒到上层、当前文件夹自嵌套。
        // delimiter 正常时 listing.files 本就是直接子项，聚合为幂等无副作用。
        const agg = aggregateEntries(listing.files, prefix)
        files = agg.files
        folders = [...new Set([...listing.folders, ...agg.folders])]
        // 探测到 delimiter 被忽略（无 CommonPrefixes 却聚合出子目录）→ 后续直接走全量列举，省一次无效 delimiter 请求
        if (listing.folders.length === 0 && agg.folders.length > 0) {
          delimiterUnsupported = true
        }
      } else {
        const all = await client.list(prefix)
        // 诊断日志：降级全量列举的返回样本（前 5 条），与 listDir 同口径取证后端 prefix 行为
        console.info(`[S3文件管理] 全量列举 prefix="${prefix}" 共 ${all.length} 条`,
          { fileKeys: all.slice(0, 5).map((f) => f.key) })
        const agg = aggregateEntries(all, prefix)
        files = agg.files
        folders = agg.folders
      }

      const built = buildEntries(files, folders)
      cache.set(prefix, built)
      entries.value = built
      currentPrefix.value = prefix
      renderLimit.value = RENDER_BATCH_SIZE
    } catch (err) {
      loadError.value = getErrorMessage(err)
    } finally {
      loading.value = false
    }
  }

  /** 进入指定目录前缀 */
  function navigateTo(prefix: string): Promise<void> {
    return loadDir(prefix)
  }

  /** 返回上级目录（不越过浏览根） */
  function navigateUp(): Promise<void> {
    if (isAtRoot.value) { return Promise.resolve() }
    const parent = parentPrefix(currentPrefix.value)
    const root = deps.getRootPrefix()
    return loadDir(parent.length < root.length ? root : parent)
  }

  /** 面包屑跳转：index=-1 回根，否则跳到第 index 段 */
  function navigateToSegment(index: number): Promise<void> {
    const root = deps.getRootPrefix()
    if (index < 0) { return loadDir(root) }
    return loadDir(root + prefixFromSegments(pathSegments.value, index))
  }

  /** 刷新当前目录（跳过缓存） */
  function refresh(): Promise<void> {
    return loadDir(currentPrefix.value, true)
  }

  /** 失效缓存（无参全清；写操作后调用） */
  function invalidateCache(prefix?: string): void {
    if (prefix === undefined) {
      cache.clear()
    } else {
      cache.delete(prefix)
    }
  }

  /** 重置 delimiter 能力探测（切换 endpoint/bucket 后旧探测结果不再适用） */
  function resetCapabilityProbe(): void {
    delimiterUnsupported = false
  }

  /** 展示下一批条目（大目录增量渲染） */
  function loadMore(): void {
    renderLimit.value += RENDER_BATCH_SIZE
  }

  /** 点击列头切换排序：同字段翻转方向，异字段切换并升序 */
  function toggleSort(field: SortField): void {
    if (sortField.value === field) {
      sortAsc.value = !sortAsc.value
    } else {
      sortField.value = field
      sortAsc.value = true
    }
  }

  return {
    currentPrefix,
    entries,
    loading,
    loadError,
    sortField,
    sortAsc,
    sortedEntries,
    visibleEntries,
    hasMore,
    pathSegments,
    isAtRoot,
    loadDir,
    navigateTo,
    navigateUp,
    navigateToSegment,
    refresh,
    invalidateCache,
    resetCapabilityProbe,
    loadMore,
    toggleSort,
  }
}
