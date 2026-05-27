/**
 * 全局主题色功能模块
 *
 * 通过覆盖思源笔记 CSS 变量（--b3-theme-primary / --b3-theme-primary-rgb）
 * 将全局主题色切换为暖橙色。
 */
import { Plugin } from "siyuan"

const THEME_PRIMARY = "#d97757"
const THEME_PRIMARY_RGB = "217, 119, 87"

export function registerThemeColor(plugin: Plugin) {
  document.documentElement.style.setProperty("--b3-theme-primary", THEME_PRIMARY)
  document.documentElement.style.setProperty("--b3-theme-primary-rgb", THEME_PRIMARY_RGB)

  try {
    const cfg = (plugin as any).dataDir
    if (cfg) {
      plugin.addCommand({
        langKey: "themeColor",
        hotkey: "",
        callback: () => {
          const current = document.documentElement.style.getPropertyValue("--b3-theme-primary")
          if (current === THEME_PRIMARY) {
            document.documentElement.style.removeProperty("--b3-theme-primary")
            document.documentElement.style.removeProperty("--b3-theme-primary-rgb")
          } else {
            document.documentElement.style.setProperty("--b3-theme-primary", THEME_PRIMARY)
            document.documentElement.style.setProperty("--b3-theme-primary-rgb", THEME_PRIMARY_RGB)
          }
        },
      })
    }
  } catch {
    // 命令注册非必需，静默处理
  }

  return {
    destroy: () => {
      document.documentElement.style.removeProperty("--b3-theme-primary")
      document.documentElement.style.removeProperty("--b3-theme-primary-rgb")
    },
  }
}
