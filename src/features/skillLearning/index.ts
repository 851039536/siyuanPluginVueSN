/**
 * 技能学习功能 - 入口注册
 * 参考 rssReader/index.ts 的最简 Dock 注册模式
 */
import type { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createVueDockApp } from "@/utils/vueAppHelper"
import SkillLearningPanel from "./index.vue"

export function registerSkillLearning(plugin: Plugin) {
  // i18n 兼容两种合并结构：嵌套（skillLearning 子对象，当前风格）与扁平（键位于顶层）
  // —— 与 bookmarkMarker/index.ts 的双形态写法一致
  const root = plugin.i18n as unknown as Record<string, any> | undefined
  const i18n = (root?.skillLearning ?? root ?? {}) as Record<string, any>

  createVueDockApp(plugin, SkillLearningPanel, {
    icon: "iconCode",
    title: i18n.panelTitle,
    type: "skilllearning-dock",
    position: "RightTop",
    width: 420,
    i18n,
  })

  // 注册快捷键命令
  plugin.addCommand({
    langKey: "skillLearning",
    langText: i18n.panelTitle,
    hotkey: "Ctrl+Alt+L",
    callback: () => {
      emitCustomEvent("dock-click", { dockId: "skilllearning-dock" })
    },
  })
}
