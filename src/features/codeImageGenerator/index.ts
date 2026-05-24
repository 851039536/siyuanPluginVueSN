/**
 * 代码图片生成器功能模块
 */
import type { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import CodeImageGeneratorPanel from "./index.vue"

/**
 * 注册代码图片生成器功能
 */
export function registerCodeImageGenerator(plugin: Plugin) {
  createVueDockApp(plugin, CodeImageGeneratorPanel, {
    icon: "iconCode",
    title: plugin.i18n.codeImageGenerator || "图片生成",
    type: "code-image-generator-dock",
    width: 600,
    position: "RightBottom",
    i18n: plugin.i18n,
  })
}

export * from "./types"
