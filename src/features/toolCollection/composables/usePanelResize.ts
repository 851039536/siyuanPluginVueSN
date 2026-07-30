/**
 * 工具合集 - 面板尺寸管理 composable
 * 封装宽度/高度的响应式状态、持久化加载、调整逻辑
 */
import type { Plugin } from "siyuan"
import type { ComputedRef, Ref } from "vue"
import { computed, ref } from "vue"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

const DEFAULT_WIDTH = 1060
const DEFAULT_HEIGHT = 60 // vh

export interface PanelResizeReturn {
  panelWidth: Ref<number>
  panelHeight: Ref<number>
  panelStyle: ComputedRef<Record<string, string>>
  adjustDimension: (key: "width" | "height", delta: number, min: number, max: number) => Promise<void>
  loadPersistedSize: () => Promise<void>
  saveHeight: (value: number) => void
}

export function usePanelResize(plugin: Plugin): PanelResizeReturn {
  const panelWidth = ref(DEFAULT_WIDTH)
  const panelHeight = ref(DEFAULT_HEIGHT)

  const storage = new PluginStorage(plugin)
  const widthSlot = new TypedStorage<number>(storage, "toolCollection-width", DEFAULT_WIDTH)
  const heightSlot = new TypedStorage<number>(storage, "toolCollection-height", DEFAULT_HEIGHT)

  const panelStyle = computed(() => ({
    maxWidth: `${panelWidth.value}px`,
    height: `${panelHeight.value}vh`,
    maxHeight: `calc(88vh - 36px)`,
  }))

  /** 从持久化存储加载尺寸（仅在仍为默认值时应用） */
  const loadPersistedSize = async () => {
    const [w, h] = await Promise.all([widthSlot.loadOrDefault(), heightSlot.loadOrDefault()])
    if (w >= 500 && w <= 1600 && panelWidth.value === DEFAULT_WIDTH) panelWidth.value = w
    if (h >= 30 && h <= 100 && panelHeight.value === DEFAULT_HEIGHT) panelHeight.value = h
  }

  /** 调整指定维度并持久化 */
  const adjustDimension = async (
    key: "width" | "height",
    delta: number,
    min: number,
    max: number
  ) => {
    const target = key === "width" ? panelWidth : panelHeight
    target.value = Math.max(min, Math.min(max, target.value + delta))
    const slot = key === "width" ? widthSlot : heightSlot
    await slot.save(target.value)
  }

  return {
    panelWidth,
    panelHeight,
    panelStyle,
    adjustDimension,
    loadPersistedSize,
    saveHeight: (value: number) => { heightSlot.save(value) },
  }
}
