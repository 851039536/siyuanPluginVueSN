/**
 * RSS订阅功能模块
 */
import type { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createVueDockApp } from "@/utils/vueAppHelper"
import RssReaderPanel from "./index.vue"

/**
 * 注册RSS订阅功能（Dock 侧边栏面板）
 */
export function registerRssReader(plugin: Plugin) {
  // 注册 RSS 自定义图标（注册后可在 dock 配置中通过 iconRss 引用）
  plugin.addIcons(`<symbol id="iconRss" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></symbol>`)

  createVueDockApp(plugin, RssReaderPanel, {
    icon: "iconRss",
    title: (plugin.i18n as any)?.rssReader?.title || "RSS订阅",
    type: "rss-reader-dock",
    width: 400,
    i18n: (plugin.i18n as any)?.rssReader || {},
  })

  // 注册快捷键命令
  plugin.addCommand({
    langKey: "rssReader",
    langText: "RSS订阅",
    hotkey: "",
    callback: () => {
      emitCustomEvent("dock-click", { dockId: "rss-reader-dock" })
    },
  })
}

