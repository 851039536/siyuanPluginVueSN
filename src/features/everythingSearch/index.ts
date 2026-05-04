/**
 * Everything本地搜索功能模块
 */
import { Plugin } from "siyuan"
import { showEverythingSearch } from "./types"

/**
 * 注册Everything搜索功能
 */
export function registerEverythingSearch(plugin: Plugin) {
  // 注册快捷键命令
  plugin.addCommand({
    langKey: "everythingSearch",
    langText: "Everything本地搜索",
    hotkey: "⌃⌥E", // Ctrl+Alt+E
    callback: () => {
      showEverythingSearch()
    },
  })
}

export {
  everythingSearchVisible,
  hideEverythingSearch,
  showEverythingSearch,
  toggleEverythingSearch,
} from "./types"
export * from "./types"
