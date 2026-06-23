/**
 * Base64图片转换器功能模块
 * 
 * 此功能已迁移为工具合集 (toolCollection) 的 Tab 页。
 * 保留此文件以维持 features/index.ts 的导出兼容性和 i18n 键访问。
 */
import type { Plugin } from "siyuan"

/**
 * 注册 Base64 图片转换器功能（no-op）
 * 
 * Base64 图片转换器现作为工具合集的 Tab 页运行，
 * 不再独立注册 Dock 面板。
 */
export function registerBase64Image(_plugin: Plugin) {
  // no-op：功能已迁移至 toolCollection/tools/base64Image/
}

