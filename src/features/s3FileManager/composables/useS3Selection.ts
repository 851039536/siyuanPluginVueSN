/**
 * S3 文件管理器多选状态 composable
 *
 * 维护选中 key 集合与 Windows 资源管理器式选择语义：
 * 单击单选、Ctrl+单击切换、Shift+单击范围选择、全选/清空。纯逻辑无 IO。
 */
import { computed, ref } from "vue"
import type { Ref } from "vue"
import type { S3Entry } from "../types"

export function useS3Selection(deps: { orderedEntries: Ref<S3Entry[]> }) {
  const selectedKeys = ref<Set<string>>(new Set())
  /** Shift 范围选择的锚点 key */
  let anchorKey: string | null = null

  const selectedEntries = computed<S3Entry[]>(() =>
    deps.orderedEntries.value.filter((e) => selectedKeys.value.has(e.key)),
  )

  const selectedCount = computed(() => selectedKeys.value.size)

  function isSelected(key: string): boolean {
    return selectedKeys.value.has(key)
  }

  /** 资源管理器式点击选择：普通单选 / Ctrl 切换 / Shift 范围 */
  function handleItemClick(entry: S3Entry, ev: MouseEvent): void {
    const list = deps.orderedEntries.value
    if (ev.shiftKey && anchorKey) {
      const anchorIdx = list.findIndex((e) => e.key === anchorKey)
      const clickIdx = list.findIndex((e) => e.key === entry.key)
      if (anchorIdx >= 0 && clickIdx >= 0) {
        const [start, end] = anchorIdx < clickIdx ? [anchorIdx, clickIdx] : [clickIdx, anchorIdx]
        selectedKeys.value = new Set(list.slice(start, end + 1).map((e) => e.key))
        return
      }
    }
    if (ev.ctrlKey || ev.metaKey) {
      const next = new Set(selectedKeys.value)
      if (next.has(entry.key)) {
        next.delete(entry.key)
      } else {
        next.add(entry.key)
      }
      selectedKeys.value = next
      anchorKey = entry.key
      return
    }
    selectedKeys.value = new Set([entry.key])
    anchorKey = entry.key
  }

  /** 右键时若目标未选中则改为单选它（资源管理器行为） */
  function ensureSelected(entry: S3Entry): void {
    if (!selectedKeys.value.has(entry.key)) {
      selectedKeys.value = new Set([entry.key])
      anchorKey = entry.key
    }
  }

  function selectAll(): void {
    selectedKeys.value = new Set(deps.orderedEntries.value.map((e) => e.key))
  }

  function clearSelection(): void {
    selectedKeys.value = new Set()
    anchorKey = null
  }

  return {
    selectedKeys,
    selectedEntries,
    selectedCount,
    isSelected,
    handleItemClick,
    ensureSelected,
    selectAll,
    clearSelection,
  }
}
