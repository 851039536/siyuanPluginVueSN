/**
 * 刷新工具 — 悬浮框快捷入口，父级 action 执行完整刷新，子菜单提供文件树/标签树/界面三级颗粒度刷新
 */
import type { Plugin } from "siyuan"
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

/** 共用：执行完整界面刷新 */
async function refreshUI(): Promise<void> {
  try {
    await reloadUI()
  } catch (error) {
    console.error("刷新界面失败:", error)
  }
}

function makeChildren(plugin: Plugin): FloatingToolChild[] {
  const i18n = (plugin.i18n as any)?.floatingBox || {}
  return [
    {
      id: "refresh-filetree",
      label: i18n.refreshFiletree || "文件树",
      title: i18n.refreshFiletreeTitle || "重载文件树",
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
      label: i18n.refreshTag || "标签树",
      title: i18n.refreshTagTitle || "重载标签树",
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
      label: i18n.refreshUI || "完整刷新",
      title: i18n.refreshUITitle || "重载整个界面",
      action: refreshUI,
    },
  ]
}

export function createRefreshTool(plugin: Plugin): FloatingTool {
  const i18n = (plugin.i18n as any)?.floatingBox || {}
  return {
    id: "refresh",
    label: i18n.refresh || "刷新",
    title: i18n.refreshTitle || "刷新界面",
    icon: "mdi:refresh",
    bgColor: "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)",
    // 父级 action 与子项"完整刷新"共用重构后的 refreshUI
    action: refreshUI,
    children: makeChildren(plugin),
  }
}
