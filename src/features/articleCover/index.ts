import type { Plugin } from "siyuan"

export function registerArticleCover(_plugin: Plugin) {
  // 纯弹出型功能，由状态栏功能抽屉驱动入口
  // 无需注册命令或事件监听
}

export {
  articleCoverInitialKeywords,
  articleCoverInitialTitle,
  articleCoverVisible,
  hideArticleCover,
  showArticleCover,
} from "./types"
