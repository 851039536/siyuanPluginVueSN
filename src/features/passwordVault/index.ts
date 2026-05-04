/**
 * 密码箱功能模块
 */
import { Plugin } from "siyuan"
import { showPasswordVault } from "./types"

/**
 * 注册密码箱功能
 */
export function registerPasswordVault(plugin: Plugin) {
  // 注册快捷键命令
  plugin.addCommand({
    langKey: "passwordVault",
    langText: "密码箱",
    hotkey: "⌃⌥W", // Ctrl+Alt+W
    callback: () => {
      showPasswordVault()
    },
  })
}

export {
  hidePasswordVault,
  passwordVaultVisible,
  showPasswordVault,
  togglePasswordVault,
} from "./types"
export * from "./types"
