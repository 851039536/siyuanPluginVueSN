/**
 * 技能学习功能 - 入口注册
 * 参考 rssReader/index.ts 的最简 Dock 注册模式
 */
import type { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import { emitCustomEvent } from "@/utils/eventBus"
import SkillLearningPanel from "./index.vue"

export function registerSkillLearning(plugin: Plugin) {
  const i18n = (plugin.i18n as Record<string, any>)?.skillLearning || {}

  createVueDockApp(plugin, SkillLearningPanel, {
    icon: "iconCode",
    title: i18n.panelTitle || "技能学习",
    type: "skilllearning-dock",
    position: "RightTop",
    width: 420,
    i18n,
  })

  // 注册快捷键命令
  plugin.addCommand({
    langKey: "skillLearning",
    langText: i18n.panelTitle || "技能学习",
    hotkey: "Ctrl+Alt+L",
    callback: () => {
      emitCustomEvent("dock-click", { dockId: "skilllearning-dock" })
    },
  })
}
