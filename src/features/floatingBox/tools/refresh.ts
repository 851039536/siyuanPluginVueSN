import type { FloatingTool, FloatingToolChild } from "../types"
import {
  reloadUI,
  reloadFiletree,
  reloadTag,
} from "@/api"
import { showMessage } from "siyuan"

function makeChildren(plugin?: any): FloatingToolChild[] {
  return [
    {
      id: "refresh-filetree",
      label: plugin?.i18n?.floatingBox?.refreshFiletree || "文件树",
      title: plugin?.i18n?.floatingBox?.refreshFiletreeTitle || "重载文件树",
      action: async () => {
        try {
          await reloadFiletree()
          showMessage("文件树已刷新", 2000, "info")
        } catch (error) {
          console.error("重载文件树失败:", error)
        }
      },
    },
    {
      id: "refresh-tag",
      label: plugin?.i18n?.floatingBox?.refreshTag || "标签树",
      title: plugin?.i18n?.floatingBox?.refreshTagTitle || "重载标签树",
      action: async () => {
        try {
          await reloadTag()
          showMessage("标签树已刷新", 2000, "info")
        } catch (error) {
          console.error("重载标签树失败:", error)
        }
      },
    },
    {
      id: "refresh-ui",
      label: plugin?.i18n?.floatingBox?.refreshUI || "完整刷新",
      title: plugin?.i18n?.floatingBox?.refreshUITitle || "重载整个界面",
      action: async () => {
        try {
          await reloadUI()
        } catch (error) {
          console.error("刷新界面失败:", error)
        }
      },
    },
  ]
}

export function createRefreshTool(plugin?: any): FloatingTool {
  return {
    id: "refresh",
    label: plugin?.i18n?.floatingBox?.refresh || "刷新",
    title: plugin?.i18n?.floatingBox?.refreshTitle || "刷新界面",
    icon: '<path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>',
    bgColor: "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)",
    action: async () => {
      try {
        await reloadUI()
      } catch (error) {
        console.error("刷新界面失败:", error)
      }
    },
    children: makeChildren(plugin),
  }
}
