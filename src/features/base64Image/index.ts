/**
 * Base64图片转换器功能模块
 */
import type { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import Base64ImagePanel from "./index.vue"

/**
 * 注册 Base64 图片转换器功能
 */
export function registerBase64Image(plugin: Plugin) {
  createVueDockApp(plugin, Base64ImagePanel, {
    icon: "iconImage",
    title: plugin.i18n.base64Image || "Base64图片转换",
    type: "base64-image-dock",
    width: 400,
    i18n: plugin.i18n,
  })
}

export * from "./types"
