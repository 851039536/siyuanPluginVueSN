import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import {
  ref,
  watch,
} from "vue"
import { getApiConfigFromPlugin } from "@/utils/aiApi"

/**
 * 代码相关子组件共享逻辑：
 * - errorMessage 状态管理
 * - 输入变化时自动清除错误
 * - 统一的 API 配置获取
 */
export function useCodeFeature(plugin?: Plugin) {
  const errorMessage = ref("")

  /**
   * 监听输入变化，自动清除错误信息
   */
  function clearErrorOnInput(inputRef: Ref<string>) {
    watch(inputRef, () => {
      if (errorMessage.value) {
        errorMessage.value = ""
      }
    })
  }

  /**
   * 获取当前 API 配置
   */
  function getApiConfig() {
    return getApiConfigFromPlugin(plugin)
  }

  return {
    errorMessage,
    clearErrorOnInput,
    getApiConfig,
  }
}
