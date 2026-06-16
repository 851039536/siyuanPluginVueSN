import type { Plugin } from "siyuan"

/** 注册函数：数据由 composable onMounted 初始化，面板通过 showWebsiteNavigation() 打开 */
export function registerWebsiteNavigation(_plugin: Plugin) {
  // 纯 modal 型 feature，无 dock/topBar 需要注册
}

