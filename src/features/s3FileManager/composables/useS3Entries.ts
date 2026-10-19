/**
 * S3 文件管理器目录浏览 composable
 *
 * 维护当前目录前缀、条目列表（delimiter 懒加载 + 有界目录缓存）、排序与
 * 面包屑导航。服务端**明确不支持** delimiter（405/501 等方法集错误）时降级为
 * 全量列举 + 客户端聚合；网络/鉴权错误直接进入 loadError，不再伪装成能力缺陷。
 */
import { computed, onUnmounted, ref, shallowRef } from "vue"
import type { S3Client } from "@/utils/s3/s3Client"
import { DelimiterUnsupportedError, listDir } from "@/utils/s3/s3ObjectOps"
import type { S3DirListing } from "@/utils/s3/s3ObjectOps"
import type { S3FileInfo } from "@/utils/s3/types"
import { getErrorMessage } from "@/utils/stringUtils"
import type { S3Entry, SortField } from "../types"
import { MAX_CACHE_DIRS, RENDER_BATCH_SIZE } from "../types"
import {
  buildEntries, compareEntries, normalizeListing,
  parentPrefix, prefixFromSegments, relativeSegments,
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

  /**
   * 目录缓存：prefix → 条目列表。
   * persistent Modal 不随面板关闭卸载，无上限会在长会话遍历大量目录后持续驻留，
   * 故按插入顺序淘汰最旧条目（Map 保序，等价简易 LRU）。
   */
  const cache = new Map<string, S3Entry[]>()
  /** delimiter 能力探测：true = 服务端明确拒绝 delimiter 参数（405/501 等），后续直接全量列举 */
  let delimiterUnsupported = false
  /**
   * 请求序号：每次 loadDir 自增并记录，响应回来时比对。
   * 快速连续导航（A→B）时 A 的慢响应会晚于 B 返回，若无此令牌会把 B 的列表
   * 覆盖成 A 的内容、并把 currentPrefix 改回 A（面包屑回跳 + 缓存写错位）。
   */
  let requestSeq = 0

  // ========== 计算属性 ==========

  const sortedEntries = computed<S3Entry[]>(() =>
    [...entries.value].sort((a, b) => compareEntries(a, b, sortField.value, sortAsc.value)),
  )

  /**
   * 名称子串过滤（大小写不敏感）。空查询原样通过；
   * 过滤作用在排序之后、增量切片之前——搜索结果仍受"加载更多"批大小约束。
   */
  const filteredEntries = computed<S3Entry[]>(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) { return sortedEntries.value }
    return sortedEntries.value.filter((e) => e.name.toLowerCase().includes(q))
  })

  const visibleEntries = computed(() => filteredEntries.value.slice(0, renderLimit.value))

  const hasMore = computed(() => filteredEntries.value.length > renderLimit.value)

  /** 搜索过滤词（工具栏输入框绑定；仅作用于当前目录展示，不影响加载） */
  const searchQuery = ref("")

  /** 面包屑段（相对浏览根前缀） */
  const pathSegments = computed(() => relativeSegments(currentPrefix.value, deps.getRootPrefix()))

  const isAtRoot = computed(() => currentPrefix.value === deps.getRootPrefix())

  // ========== 缓存 ==========

  function readCache(prefix: string): S3Entry[] | undefined {
    const hit = cache.get(prefix)
    if (hit) {
      // 刷新为最新：命中后重新插入以维持"末尾 = 最近使用"的顺序
      cache.delete(prefix)
      cache.set(prefix, hit)
    }
    return hit
  }

  function writeCache(prefix: string, value: S3Entry[]): void {
    cache.delete(prefix)
    cache.set(prefix, value)
    while (cache.size > MAX_CACHE_DIRS) {
      const oldest = cache.keys().next()
      if (oldest.done) { break }
      cache.delete(oldest.value)
    }
  }

  // ========== 方法 ==========

  /** 加载指定目录（命中缓存直接展示；force 跳过缓存） */
  async function loadDir(prefix: string, force = false): Promise<void> {
    // 本次请求的令牌：任何赋值前都校验它仍是最新请求，过期响应整体丢弃
    const seq = ++requestSeq

    if (!force) {
      const cached = readCache(prefix)
      if (cached) {
        entries.value = cached
        currentPrefix.value = prefix
        renderLimit.value = RENDER_BATCH_SIZE
        loadError.value = ""
        // 缓存命中不经过下方 finally：必须在此熄灭上一个请求遗留的 loading，
        // 否则其响应因令牌过期被丢弃后，loading 再无人复位（列表永久转圈）
        loading.value = false
        return
      }
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
          // 仅当服务端明确拒绝 delimiter（405/501 等方法集错误）才降级；
          // 403/超时/断网等普通错误必须冒泡到 loadError，否则会被误判成能力缺陷并永久钉住降级路径
          if (!(err instanceof DelimiterUnsupportedError)) { throw err }
          console.warn("[S3文件管理] 服务端不支持 delimiter，降级为全量聚合:", getErrorMessage(err))
          delimiterUnsupported = true
        }
      }

      let files: S3FileInfo[]
      let folders: string[]
      // delimiter 被静默忽略时（OpenList 等代理返回扁平递归结果）listDir 本身就能成功返回，
      // normalizeListing 会把嵌套对象折回当前层 —— 无需切换到更重的 client.list 全量路径
      const normalized = normalizeListing(listing ?? { files: await client.list(prefix), folders: [] }, prefix)
      files = normalized.files
      folders = normalized.folders

      const built = buildEntries(files, folders)
      // 过期响应：已发起更新的请求，本次结果一律丢弃（不写缓存、不改状态，避免覆盖新目录）
      if (seq !== requestSeq) { return }
      writeCache(prefix, built)
      entries.value = built
      currentPrefix.value = prefix
      renderLimit.value = RENDER_BATCH_SIZE
    } catch (err) {
      if (seq !== requestSeq) { return }
      loadError.value = getErrorMessage(err)
    } finally {
      // 仅最新请求有权结束 loading，否则旧请求的 finally 会提前熄灭新请求的加载态
      if (seq === requestSeq) { loading.value = false }
    }
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

  /** 失效全部目录缓存（写操作后调用） */
  function invalidateCache(): void {
    cache.clear()
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

  // 面板销毁后自增令牌，使在途列举的响应整体失效（不再写缓存与已销毁组件的状态）
  onUnmounted(() => { requestSeq++ })

  return {
    currentPrefix,
    entries,
    loading,
    loadError,
    sortField,
    sortAsc,
    sortedEntries,
    filteredEntries,
    visibleEntries,
    hasMore,
    searchQuery,
    pathSegments,
    isAtRoot,
    loadDir,
    navigateUp,
    navigateToSegment,
    refresh,
    invalidateCache,
    resetCapabilityProbe,
    loadMore,
    toggleSort,
  }
}
