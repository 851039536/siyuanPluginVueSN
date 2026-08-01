/**
 * 图片生成功能：文章封面 + 代码图片（纯弹出型，入口由 App.vue 统一调度）
 */
import type { Plugin } from "siyuan"

export function registerImageCreation(_plugin: Plugin) {
  // 纯弹出型功能，由状态栏功能抽屉驱动入口；无需注册命令或事件监听
}

export {
  activeTab,
  hideImageCreation,
  imageCreationVisible,
  showImageCreation,
  switchTab,
} from "./composables/useImageCreationState"
