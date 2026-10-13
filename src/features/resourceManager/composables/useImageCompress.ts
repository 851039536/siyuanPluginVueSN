// 图片压缩 composable：选中集合管理、批量压缩、写回原图
//
// 自 imageCompressor 功能块迁入：压缩不再是独立弹窗功能，而是资源管理「图片资源」页签的批量操作。
// 与独立功能块的差异：目标列表直接来自页签已加载的资源路径（无需再全盘扫描 assets 目录），
// 故不再需要 scanner / 分页 / 缩略图 blob URL 管理这三块逻辑。
import type { Ref } from "vue"
import type {
  CompressOptions,
  CompressResult,
  ResourceManagerI18n,
} from "../types"
import {
  computed,
  ref,
  shallowRef,
} from "vue"
import {
  batchCompressImages,
  batchReplaceImages,
  DEFAULT_COMPRESS_OPTIONS,
  getCompressStats,
} from "../services/compressor"

/** 压缩结果统计的零值形态（结果为空时展示，避免面板渲染 NaN） */
const EMPTY_STATS = {
  total: 0,
  success: 0,
  failed: 0,
  averageRatio: 0,
  totalSavedMB: "0.00",
}

/** i18n 占位符替换（缺失文案时回退空串，调用方不再二次判空） */
function fill(template: string | undefined, values: Record<string, string | number>): string {
  let out = template ?? ""
  for (const [key, value] of Object.entries(values)) {
    // 用 split/join 而非 replaceAll：构建 target 低于 ES2021，replaceAll 不可用
    out = out.split(`{${key}}`).join(String(value))
  }
  return out
}

export function useImageCompress(
  /** 当前页签已加载的图片资源路径（全量，非分页切片） */
  imagePaths: Ref<string[]>,
  i18n: ResourceManagerI18n,
  /** 统一提示出口（由 useResourceManager 注入） */
  showMsg: (msg: string) => void,
) {
  /** 选中压缩的资源路径集合（跨筛选保留，便于「筛选后批量选」） */
  const selectedPaths = ref<Set<string>>(new Set())
  const compressing = ref(false)
  const replacing = ref(false)
  const compressDialogOpen = ref(false)
  const compressResults = shallowRef<CompressResult[]>([])
  const compressProgressText = ref("")

  const selectedCount = computed(() => selectedPaths.value.size)

  const hasResult = computed(() => compressResults.value.length > 0)

  const stats = computed(() =>
    compressResults.value.length === 0 ? EMPTY_STATS : getCompressStats(compressResults.value),
  )

  /**
   * 选中集合变更须整体替换引用：
   * `Set` 的原地增删不会触发 Vue 的响应式更新（`ref` 对集合只做浅层代理）。
   */
  function mutateSelection(operation: (set: Set<string>) => void) {
    const next = new Set(selectedPaths.value)
    operation(next)
    selectedPaths.value = next
  }

  function toggleSelect(path: string) {
    mutateSelection((set) => {
      if (set.has(path)) set.delete(path)
      else set.add(path)
    })
  }

  /** 全选当前页签已加载的图片（受「加载数量」限制，不越过已加载范围） */
  function selectAll() {
    mutateSelection((set) => {
      imagePaths.value.forEach((path) => set.add(path))
    })
  }

  function deselectAll() {
    selectedPaths.value = new Set()
  }

  /** 批量压缩选中的资源（弹窗确认参数后调用） */
  async function runCompress(options: CompressOptions) {
    compressDialogOpen.value = false

    const targets = imagePaths.value.filter((path) => selectedPaths.value.has(path))
    if (targets.length === 0) {
      showMsg(i18n.selectHint)
      return
    }

    compressing.value = true
    compressResults.value = []
    try {
      const results = await batchCompressImages(
        targets.map((path) => ({ path })),
        options,
        (current, total, path) => {
          compressProgressText.value = `${i18n.compressing} ${current}/${total} - ${path.split("/").pop() ?? path}`
        },
      )
      compressResults.value = results

      const next = getCompressStats(results)
      showMsg(fill(i18n.compressDoneDetail, {
        success: next.success,
        failed: next.failed,
        ratio: next.averageRatio,
      }))
    }
    finally {
      compressing.value = false
      compressProgressText.value = ""
    }
  }

  /**
   * 将压缩结果写回原路径（覆盖原图）。
   * @param onReplaced 写回成功后回调（父层据此剔除列表中的失效缩略图缓存）
   */
  async function replaceOriginals(onReplaced: (paths: string[]) => void) {
    if (compressResults.value.length === 0) return

    replacing.value = true
    try {
      const { success, failed } = await batchReplaceImages(
        compressResults.value,
        (current, total) => {
          compressProgressText.value = `${i18n.replacing} ${current}/${total}`
        },
      )

      const replacedPaths = compressResults.value
        .filter((r) => r.success)
        .map((r) => r.originalPath)

      compressResults.value = []
      if (replacedPaths.length > 0) onReplaced(replacedPaths)

      showMsg(fill(i18n.replaceDoneDetail, { success, failed }))
    }
    finally {
      replacing.value = false
      compressProgressText.value = ""
    }
  }

  /** 清空压缩结果面板（不写盘） */
  function clearResults() {
    compressResults.value = []
  }

  return {
    selectedPaths,
    selectedCount,
    compressing,
    replacing,
    compressDialogOpen,
    compressResults,
    compressProgressText,
    hasResult,
    stats,
    defaultOptions: DEFAULT_COMPRESS_OPTIONS,
    toggleSelect,
    selectAll,
    deselectAll,
    runCompress,
    replaceOriginals,
    clearResults,
  }
}
