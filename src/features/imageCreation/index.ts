import type { Plugin } from "siyuan"

export function registerImageCreation(_plugin: Plugin) {
  // 纯弹出型功能，由状态栏功能抽屉驱动入口
  // 无需注册命令或事件监听
}

export {
  activeTab,
  hideImageCreation,
  imageCreationInitialKeywords,
  imageCreationInitialTitle,
  imageCreationVisible,
  showCodeImage,
  showImageCreation,
  switchTab,
} from "./composables/useImageCreationState"
