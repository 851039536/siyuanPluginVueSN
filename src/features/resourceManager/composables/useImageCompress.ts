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
  getCompressStats,
} from "../services/compressor"
import { fillTemplate } from "../utils"

/**
 * 压缩结果统计的零值形态（结果为空时展示，避免面板渲染 NaN）。
 *
 * 由 `getCompressStats([])` 派生而非手写：统计对象有 8 个字段，
 * 手写子集会让 `stats` 的推断类型退化为两个分支的联合（消费方读非空分支独有字段即得 `undefined`）。
 * 派生后两分支同型，且服务层新增字段时零值自动跟进。
 * 冻结为只读；`stats` 的空分支返回其浅拷贝，避免消费方误改共享对象。
 */
const EMPTY_STATS = Object.freeze(getCompressStats([]))

/**
 * 图片压缩逻辑，供 useResourceManager 组合复用。
 *
 * 依赖全部经 deps 注入：`imagePaths` 为页签已加载的图片资源（全量，非分页切片），
 * `showMsg` 复用统一提示封装。
 */
export function useImageCompress(deps: {
  /** 当前页签已加载的图片资源路径（全量，非分页切片） */
  imagePaths: Ref<string[]>
  i18n: ResourceManagerI18n
  /** 统一提示出口（由 useResourceManager 注入） */
  showMsg: (msg: string) => void
}) {
  const {
    imagePaths,
    i18n,
    showMsg,
  } = deps

  /** 选中压缩的资源路径集合（跨筛选保留，便于「筛选后批量选」） */
  const selectedPaths = ref<Set<string>>(new Set())
  const compressing = ref(false)
  const replacing = ref(false)
  const compressDialogOpen = ref(false)
  const compressResults = shallowRef<CompressResult[]>([])
  const compressProgressText = ref("")
  /**
   * 缩略图缓存破坏版本表：路径 → 版本号。
   * 覆盖写回后资源 URL 不变，浏览器会命中旧图缓存，故对已替换路径自增版本，
   * 由 AssetGridList 附加为 `?v=N` 强制重取（未替换路径不追加，正常缓存不受影响）。
   */
  const srcVersions = ref<Map<string, number>>(new Map())

  const selectedCount = computed(() => selectedPaths.value.size)

  const hasResult = computed(() => compressResults.value.length > 0)

  const stats = computed(() =>
    compressResults.value.length === 0 ? { ...EMPTY_STATS } : getCompressStats(compressResults.value),
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

  /**
   * 全选**当前可见**的图片。
   *
   * ⚠️ 必须由调用方传入可见列表（`currentAssetList`：已按分类筛选并受「加载数量」截断），
   * 不能遍历 `imagePaths`（全量图片）——否则分类筛选/加载数量生效时，
   * 「全选」会选中屏幕上并不存在的项，压缩后连同写回一起覆盖用户没看到的图片。
   */
  function selectAll(visiblePaths: string[]) {
    mutateSelection((set) => {
      visiblePaths.forEach((path) => set.add(path))
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
      showMsg(fillTemplate(i18n.compressDoneDetail, {
        success: next.success,
        failed: next.failed,
        ratio: next.averageRatio,
      }))
    }
    catch (e: unknown) {
      // 服务层已逐张兜底，此处捕获的是批次级意外异常（如回调抛错）；
      // 不吞掉：明确提示并留痕，避免 Promise 拒绝无人接管
      console.error("批量压缩失败:", e)
      showMsg(fillTemplate(i18n.compressBatchFailed, {
        error: e instanceof Error ? e.message : String(e),
      }))
    }
    finally {
      compressing.value = false
      compressProgressText.value = ""
    }
  }

  /**
   * 将压缩结果写回原路径（覆盖原图）。
   *
   * 写回成功后由本 composable 内部释放这些路径的选中态：
   * 缩略图缓存失效走自增版本号（见 `bumpSrcVersions`），选中态走 `mutateSelection`，父层无需回调。
   */
  async function replaceOriginals() {
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
      if (replacedPaths.length > 0) {
        // 磁盘内容已变但 URL 未变，须让缩略图绕过旧缓存
        bumpSrcVersions(replacedPaths)
        // 已替换的路径不再需要保留选中态：选中集合由本 composable 内部释放
        const replaced = new Set(replacedPaths)
        mutateSelection((set) => {
          for (const path of replaced) set.delete(path)
        })
      }

      showMsg(fillTemplate(i18n.replaceDoneDetail, { success, failed }))
    }
    catch (e: unknown) {
      // 保留 compressResults 不清空：写回中途失败时用户可修复后重试
      console.error("写回原图失败:", e)
      showMsg(i18n.replaceFailed)
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

  /** 自增指定路径的缩略图版本，强制浏览器重取被覆盖的图片 */
  function bumpSrcVersions(paths: string[]) {
    const next = new Map(srcVersions.value)
    for (const path of paths) next.set(path, (next.get(path) ?? 0) + 1)
    srcVersions.value = next
  }

  return {
    selectedPaths,
    selectedCount,
    compressing,
    replacing,
    compressDialogOpen,
    compressProgressText,
    hasResult,
    stats,
    srcVersions,
    toggleSelect,
    selectAll,
    deselectAll,
    runCompress,
    replaceOriginals,
    clearResults,
  }
}
