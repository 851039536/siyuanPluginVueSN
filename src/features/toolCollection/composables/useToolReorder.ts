/**
 * 工具合集 - 工具列表拖拽排序 composable
 * 使用 HTML5 Drag & Drop API，排序持久化到 TypedStorage
 */
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import type { ToolMeta } from "../types"
import { ref } from "vue"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

export interface ToolReorderReturn {
  dragIndex: Ref<number>
  onDragStart: (index: number) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (index: number) => void
  onDragEnd: () => void
}

export function useToolReorder(
  tools: Ref<ToolMeta[]>,
  plugin: Plugin
): ToolReorderReturn {
  const dragIndex = ref(-1)
  const storage = new PluginStorage(plugin)
  // 存储键沿用历史的 "toolCollection-tabOrder"，避免丢失用户已持久化的排序数据
  const orderSlot = new TypedStorage<string[]>(storage, "toolCollection-tabOrder", [])

  // 启动时恢复持久化排序
  orderSlot.loadOrDefault().then((savedOrder) => {
    if (savedOrder.length === 0) return
    const map = new Map(tools.value.map((t) => [t.id, t]))
    const reordered: ToolMeta[] = []
    for (const id of savedOrder) {
      const tool = map.get(id)
      if (tool) {
        reordered.push(tool)
        map.delete(id)
      }
    }
    // 追加新增的工具（不在持久化列表中的）
    for (const tool of map.values()) reordered.push(tool)
    if (reordered.length === tools.value.length) tools.value = reordered
  })

  const onDragStart = (index: number) => {
    dragIndex.value = index
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
  }

  const onDrop = (targetIndex: number) => {
    const from = dragIndex.value
    if (from < 0 || from === targetIndex) return
    const list = [...tools.value]
    const [moved] = list.splice(from, 1)
    list.splice(targetIndex, 0, moved)
    tools.value = list
    // 持久化新顺序
    orderSlot.save(list.map((t) => t.id))
    dragIndex.value = -1
  }

  const onDragEnd = () => {
    dragIndex.value = -1
  }

  return { dragIndex, onDragStart, onDragOver, onDrop, onDragEnd }
}
