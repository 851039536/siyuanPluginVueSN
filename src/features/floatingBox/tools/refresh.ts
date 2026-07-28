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
import { getFloatingBoxI18n } from "./utils"

/** 共用：执行完整界面刷新 */
async function refreshUI(): Promise<void> {
  try {
    await reloadUI()
  } catch (error) {
    console.error("刷新界面失败:", error)
  }
}

function makeChildren(i18n: Record<string, string>): FloatingToolChild[] {
  return [
    {
      id: "refresh-filetree",
      label: i18n.refreshFiletree,
      title: i18n.refreshFiletreeTitle,
      action: async () => {
        try {
          await reloadFiletree()
          showMessage(i18n.refreshFiletreeDone, 2000, "info")
        } catch (error) {
          console.error("重载文件树失败:", error)
        }
      },
    },
    {
      id: "refresh-tag",
      label: i18n.refreshTag,
      title: i18n.refreshTagTitle,
      action: async () => {
        try {
          await reloadTag()
          showMessage(i18n.refreshTagDone, 2000, "info")
        } catch (error) {
          console.error("重载标签树失败:", error)
        }
      },
    },
  ]
}

export function createRefreshTool(plugin: Plugin): FloatingTool {
  const i18n = getFloatingBoxI18n(plugin)
  return {
    id: "refresh",
    label: i18n.refresh,
    title: i18n.refreshTitle,
    icon: "mdi:refresh",
    bgColor: "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)",
    // 父级点击 = 完整刷新（最常用且移动端可用）；hover 展开子菜单选择文件树/标签树细粒度刷新
    action: refreshUI,
    children: makeChildren(i18n),
  }
}
