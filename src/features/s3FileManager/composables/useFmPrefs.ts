/**
 * S3 文件管理器视图偏好 composable
 *
 * 维护视图模式（详细信息 / 图标网格）与排序偏好的响应式状态、持久化与
 * 与「条目列表排序 ref」的双向同步（排序来自 useS3Entries，偏好写入存储槽）。
 * 落盘按序串行：快速切换排序/视图时后一次写盘等待前一次完成，最终落盘为最新状态。
 */
import { ref, watch } from "vue"
import type { Ref } from "vue"
import type { FmPrefs, SortField, ViewMode } from "../types"
import { DEFAULT_FM_PREFS } from "../types"
import type { S3FileManagerStorage } from "../types/storage"

export function useFmPrefs(deps: {
  storage: S3FileManagerStorage
  /** 条目列表的排序 ref（来自 useS3Entries） */
  sortField: Ref<SortField>
  sortAsc: Ref<boolean>
}) {
  const prefs = ref<FmPrefs>({ ...DEFAULT_FM_PREFS })
  /** 落盘串行链：后一次写盘等待前一次完成，保证最终落盘为最新状态 */
  let writeChain: Promise<void> = Promise.resolve()

  /** 落盘当前偏好（排序字段从条目列表 ref 同步进来，保证列头排序也被记住） */
  function savePrefs(): Promise<void> {
    prefs.value.sortField = deps.sortField.value
    prefs.value.sortAsc = deps.sortAsc.value
    const write = deps.storage.prefs.save({ ...prefs.value }).then((ok) => {
      if (!ok) { console.warn("[S3文件管理] 视图偏好落盘失败") }
    })
    writeChain = writeChain.then(() => write, () => write)
    return write
  }

  /** 切换视图模式并持久化 */
  async function setViewMode(mode: ViewMode): Promise<void> {
    prefs.value.viewMode = mode
    await savePrefs()
  }

  /** 启动加载偏好并回填排序 ref */
  async function loadPrefs(): Promise<void> {
    prefs.value = await deps.storage.prefs.loadOrDefault()
    deps.sortField.value = prefs.value.sortField
    deps.sortAsc.value = prefs.value.sortAsc
  }

  // 排序变更即时持久化（列头 toggleSort 不经过 setViewMode）
  // 与已存偏好一致时跳过，避免启动恢复时冗余落盘
  watch([deps.sortField, deps.sortAsc], () => {
    if (prefs.value.sortField === deps.sortField.value && prefs.value.sortAsc === deps.sortAsc.value) { return }
    void savePrefs()
  })

  return { prefs, setViewMode, loadPrefs }
}
