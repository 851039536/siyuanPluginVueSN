/**
 * Everything 搜索「缓存清理」面板编排 composable
 * 托管状态引用与树形勾选，把扫描/清理的执行委托给 tasks.ts（IO 全部在 cacheScan 层）
 */
import type { ComputedRef } from "vue"
import type {
  CacheCleanMode,
  CacheCleanResult,
  CacheCleanSettings,
  CacheEntry,
  CacheRootId,
  CacheRootScanResult,
  CacheScanProgress,
  CacheScanResult,
  ResolvedCacheRoot,
} from "../types"
import {
  computed,
  isRef,
  onUnmounted,
  ref,
  shallowRef,
} from "vue"
import {
  TimerRegistry,
  type TimerHandle,
} from "@/utils/timerRegistry"
import { CACHE_ROOTS, getCacheRootDef, resolveCacheRoots } from "../cacheScan/roots"
import {
  buildCacheCleanTexts,
  toPercent,
} from "../components/cacheClean/labels"
import { buildCacheCleanSetters } from "../components/cacheClean/preferences"
import { buildRootRows } from "../components/cacheClean/rows"
import {
  abortActive,
  createAbortHolder,
  runClean,
  runScan,
} from "../components/cacheClean/tasks"
import { flattenCacheEntries, summarizeSize } from "../utils"

/** 依赖注入：外部状态与回调由父层（useSearchConfig）传入 */
export interface UseCacheCleanDeps {
  /** everythingSearch 命名空间的 i18n 文案（computed 或普通对象均可） */
  i18n: ComputedRef<Record<string, string>> | Record<string, string>
  /** 缓存清理持久化偏好（reactive 对象，由父层提供） */
  settings: CacheCleanSettings
  /** 更新单个偏好项（父层已实现防抖落盘） */
  updateSettings: <K extends keyof CacheCleanSettings>(key: K, value: CacheCleanSettings[K]) => void
  /** 记录某分类的显式勾选偏好（缺省项由 CACHE_ROOTS[].defaultEnabled 决定） */
  setRootEnabled: (id: CacheRootId, enabled: boolean) => void
  /** 清理完成后追加历史记录（可选，由 useCleanHistory 提供） */
  onCleaned?: (result: CacheCleanResult, mode: CacheCleanMode) => void
}

export function useCacheClean(deps: UseCacheCleanDeps) {
  const { settings, updateSettings, setRootEnabled } = deps
  const timerRegistry = new TimerRegistry()
  const abortHolder = createAbortHolder()

  /** 取 i18n 文案（缺失返回空串：i18n 是唯一数据源，禁止硬编码兜底） */
  const t = (key: string): string => {
    const dict = isRef(deps.i18n) ? deps.i18n.value : deps.i18n
    return dict[key] ?? ""
  }

  // ── 状态引用（传给 tasks.ts 由执行器写入）──
  const roots = shallowRef<ResolvedCacheRoot[]>(resolveCacheRoots())
  /**
   * 扫描结果必须是 `shallowRef`：单次扫描可含上万条 `CacheEntry`，
   * 用 `ref` 会把它们逐个 Proxy 化并建立依赖追踪（实测为数 MB 级额外占用）。
   * 本状态的所有写入都是**整体替换**（扫描赋值 / `pruneDeletedEntries` 返回新对象），
   * 不存在原地修改嵌套字段的场景，`shallowRef` 语义完全等价。
   */
  const scanResult = shallowRef<CacheScanResult | null>(null)
  const scanStatus = ref<"idle" | "scanning">("idle")
  const scanProgress = ref<CacheScanProgress | null>(null)
  const scanError = ref("")
  const scanCancelled = ref(false)
  const selected = ref<Set<string>>(new Set())
  const cleaning = ref(false)
  const cleanProgress = ref<{ done: number, total: number } | null>(null)
  const cleanResult = ref<CacheCleanResult | null>(null)
  const cleanError = ref("")
  const confirmVisible = ref(false)

  let feedbackTimer: TimerHandle | null = null

  /** 某分类是否被勾选为扫描位置（显式偏好优先，缺省取定义里的默认值） */
  const isRootEnabled = (id: CacheRootId): boolean => {
    const explicit = settings.enabledRoots[id]
    if (explicit !== undefined) return explicit
    return getCacheRootDef(id)?.defaultEnabled ?? false
  }

  /** rootId → 已解析路径（同一分类可能解析出多个候选目录） */
  const pathsByRoot = computed(() => {
    const map = new Map<CacheRootId, string[]>()
    for (const root of roots.value) {
      const list = map.get(root.def.id) ?? []
      list.push(root.path)
      map.set(root.def.id, list)
    }
    return map
  })

  /** rootId → 扫描结果（条目上限已由扫描侧控制，此处只做聚合查询） */
  const rootResults = computed(() => {
    const map = new Map<CacheRootId, CacheRootScanResult>()
    for (const root of scanResult.value?.roots ?? []) map.set(root.rootId, root)
    return map
  })

  const rootRows = computed(() => buildRootRows({
    defs: CACHE_ROOTS,
    pathsByRoot: pathsByRoot.value,
    resultsByRoot: rootResults.value,
    selected: selected.value,
    isEnabled: isRootEnabled,
    label: labelKey => t(labelKey),
  }))

  /**
   * 全部条目（体积降序）。
   * 平铺 + 排序只在「扫描结果变化」时做一次：勾选变化时若重新平铺排序，
   * 每次点击都要对上万条重排并新建数组（GC 压力与卡顿都来自这里）。
   */
  const allEntries = computed<CacheEntry[]>(() => flattenCacheEntries(scanResult.value))

  /** 已选条目（沿用 `allEntries` 的体积降序，不再二次排序） */
  const selectedEntries = computed<CacheEntry[]>(
    () => allEntries.value.filter(entry => selected.value.has(entry.path)),
  )
  const selectedSize = computed(() => summarizeSize(selectedEntries.value).size)

  const texts = buildCacheCleanTexts(t, {
    scanStatus: () => scanStatus.value,
    scanResult: () => scanResult.value,
    scanProgress: () => scanProgress.value,
    scanError: () => scanError.value,
    scanCancelled: () => scanCancelled.value,
    cleanProgress: () => cleanProgress.value,
    cleanResult: () => cleanResult.value,
    cleanError: () => cleanError.value,
    selectedEntries: () => selectedEntries.value,
    selectedSize: () => selectedSize.value,
  })

  /** 清空反馈自动消失定时器（新任务启动与卸载时调用） */
  const clearFeedbackTimer = () => {
    timerRegistry.clear(feedbackTimer)
    feedbackTimer = null
  }

  /** 执行器运行时：共享同一份状态引用与取消槽 */
  const runtime = {
    state: {
      roots,
      scanResult,
      scanStatus,
      scanProgress,
      scanError,
      scanCancelled,
      selected,
      cleaning,
      cleanProgress,
      cleanResult,
      cleanError,
      confirmVisible,
    },
    settings: () => settings,
    isRootEnabled,
    selectedEntries: () => selectedEntries.value,
    abortHolder,
    clearFeedbackTimer,
    onCleaned: deps.onCleaned,
    scheduleFeedbackClear: (callback: () => void, delayMs: number) => {
      feedbackTimer = timerRegistry.setTimeout(() => {
        feedbackTimer = null
        callback()
      }, delayMs)
    },
  }

  /** 扫描（仅已勾选的分类；取消时保留已完成部分） */
  const scan = () => runScan(runtime)

  /** 取消进行中的扫描/清理 */
  const cancel = () => {
    abortActive(abortHolder)
    scanProgress.value = null
    cleanProgress.value = null
  }

  /** 勾选/取消勾选单条（显式传 checked 时以其为准，供批量操作复用） */
  const toggleEntry = (path: string, checked?: boolean) => {
    const next = new Set(selected.value)
    if (checked ?? !next.has(path)) next.add(path)
    else next.delete(path)
    selected.value = next
  }

  /**
   * 勾选/取消勾选整个分类（树形父节点语义）。
   * 已扫描时批量增删其下条目，并同步「扫描位置」偏好使重扫行为与勾选一致；
   * 未扫描时该行表达的就是扫描位置偏好，直接写偏好。
   */
  const toggleRoot = (rootId: CacheRootId, checked?: boolean) => {
    const entries = rootResults.value.get(rootId)?.entries ?? []
    const allPicked = entries.length > 0 && entries.every(entry => selected.value.has(entry.path))
    const shouldSelect = checked ?? !allPicked
    if (entries.length === 0) {
      setRootEnabled(rootId, shouldSelect)
      return
    }
    const next = new Set(selected.value)
    for (const entry of entries) {
      if (shouldSelect) next.add(entry.path)
      else next.delete(entry.path)
    }
    selected.value = next
    setRootEnabled(rootId, shouldSelect)
  }

  /** 全选 / 全不选（仅作用于条目，不改扫描位置偏好） */
  const selectAll = () => {
    selected.value = new Set(allEntries.value.map(entry => entry.path))
  }
  const selectNone = () => {
    selected.value = new Set()
  }

  /** 打开确认弹窗（未选中任何条目时不响应） */
  const clean = () => {
    if (cleaning.value || selectedEntries.value.length === 0) return
    confirmVisible.value = true
  }
  const closeConfirm = () => {
    confirmVisible.value = false
  }
  /** 执行清理（确认弹窗 accept 回调） */
  const doClean = () => runClean(runtime)

  onUnmounted(() => {
    abortActive(abortHolder)
    timerRegistry.clearAll()
  })

  return {
    // 状态（只暴露模板真正消费的项：roots / selectedSize 为内部派生，不外抛）
    rootRows,
    scanResult,
    scanStatus,
    scanPercent: computed(() => toPercent(scanProgress.value)),
    cleanPercent: computed(() => toPercent(cleanProgress.value)),
    selected,
    selectedEntries,
    /** 待渲染条目（体积降序；容器直接交给列表组件，避免各视图再平铺一次） */
    allEntries,
    cleaning,
    cleanProgress,
    confirmVisible,
    // 文案
    ...texts,
    // 动作
    scan,
    cancel,
    toggleEntry,
    toggleRoot,
    selectAll,
    selectNone,
    clean,
    closeConfirm,
    doClean,
    ...buildCacheCleanSetters(updateSettings),
  }
}
