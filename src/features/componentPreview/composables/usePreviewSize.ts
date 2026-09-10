/**
 * 组件预览 — 组件尺寸档位：启动加载 / 切换 / 持久化
 */
import type { Plugin } from "siyuan"
import { ref } from "vue"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import type { ComponentSize } from "../types/size"
import {
  DEFAULT_COMPONENT_SIZE,
  isComponentSize,
} from "../types/size"

const STORAGE_KEY = "component-preview-size"

export function usePreviewSize(plugin: Plugin) {
  const storage = new PluginStorage(plugin)
  const slot = new TypedStorage<ComponentSize>(
    storage,
    STORAGE_KEY,
    DEFAULT_COMPONENT_SIZE,
  )

  const size = ref<ComponentSize>(DEFAULT_COMPONENT_SIZE)

  /** 启动即加载偏好（从未保存过时保持默认档位；损坏值经 isComponentSize 兜底） */
  const loadSize = async () => {
    const saved = await slot.loadOrDefault()
    if (isComponentSize(saved)) {
      size.value = saved
    }
  }

  /** 切换档位并持久化（写入失败不阻断交互） */
  const setSize = (value: ComponentSize) => {
    size.value = value
    void slot.save(value)
  }

  return {
    size,
    loadSize,
    setSize,
  }
}
