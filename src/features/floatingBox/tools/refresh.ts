import type {
  FloatingTool,
  FloatingToolChild,
} from "../types"
import { showMessage } from "siyuan"
import {
  reloadFiletree,
  reloadTag,
  reloadUI,
} from "@/api"

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
    icon: "mdi:refresh",
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
