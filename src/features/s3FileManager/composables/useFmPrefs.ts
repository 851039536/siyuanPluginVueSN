/**
 * S3 文件管理器视图偏好 composable
 *
 * 维护视图模式（详细信息 / 图标网格）与排序偏好的响应式状态、持久化与
 * 与「条目列表排序 ref」的双向同步（排序来自 useS3Entries，偏好写入存储槽）。
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

  /** 落盘当前偏好（排序字段从条目列表 ref 同步进来，保证列头排序也被记住） */
  async function savePrefs(): Promise<void> {
    prefs.value.sortField = deps.sortField.value
    prefs.value.sortAsc = deps.sortAsc.value
    await deps.storage.prefs.save({ ...prefs.value })
  }

  /** 切换视图模式并持久化 */
  async function setViewMode(mode: ViewMode): Promise<void> {
    prefs.value.viewMode = mode
    await savePrefs()
  }

  /** 启动加载偏好并回填排序 ref */
  async function loadPrefs(): Promise<void> {
    try {
      prefs.value = await deps.storage.prefs.loadOrDefault()
      deps.sortField.value = prefs.value.sortField
      deps.sortAsc.value = prefs.value.sortAsc
    } catch {
      // 偏好加载失败用默认值（不阻断面板打开）
      prefs.value = { ...DEFAULT_FM_PREFS }
    }
  }

  // 排序变更即时持久化（列头 toggleSort 不经过 setViewMode）
  // 与已存偏好一致时跳过，避免启动恢复时冗余落盘
  watch([deps.sortField, deps.sortAsc], () => {
    if (prefs.value.sortField === deps.sortField.value && prefs.value.sortAsc === deps.sortAsc.value) { return }
    void savePrefs()
  })

  return { prefs, setViewMode, loadPrefs }
}
