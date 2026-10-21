// 代码子组件共享逻辑 — 错误管理、API 配置获取、剪贴板操作
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import {
  ref,
  watch,
} from "vue"
import { getApiConfigFromPlugin } from "@/utils/aiApi"
import { copyToClipboard } from "@/utils/domUtils"

/**
 * 代码相关子组件共享逻辑：
 * - errorMessage 状态管理 + clearError 快捷方法
 * - 输入变化时自动清除错误
 * - 统一的 API 配置获取
 * - 统一的剪贴板操作（遵循 AGENTS.md 统一入口原则）
 * @param plugin 思源插件实例
 * @param i18n 词条文案（提示信息国际化）
 */
export function useCodeFeature(plugin?: Plugin, i18n?: Record<string, string>) {
  const errorMessage = ref("")

  /**
   * 清除当前错误信息
   */
  function clearError() {
    errorMessage.value = ""
  }

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

  /**
   * 复制文本到剪贴板，成功/失败自动提示
   */
  async function copyText(text: string, successMsg?: string) {
    if (!text) {
      showMessage(i18n?.noCopyContent || "没有可复制的内容", 2000, "error")
      return
    }
    const ok = await copyToClipboard(text)
    if (ok) {
      showMessage(successMsg || i18n?.copySuccess || "已复制到剪贴板", 1500, "info")
    } else {
      showMessage(i18n?.copyFailed || "复制失败", 3000, "error")
    }
  }

  return {
    errorMessage,
    clearError,
    clearErrorOnInput,
    getApiConfig,
    copyText,
  }
}
