/**
 * 文本对比功能纯工具函数（不依赖 Vue 响应式）
 */

/**
 * 读取 textDiff 模块的 i18n 文案（UI 文案唯一数据源，缺失时回退为键名便于定位）
 * @param i18n 插件国际化对象
 * @param key  文案键名
 */
export function textDiffI18n(
  i18n: Record<string, any> | undefined,
  key: string,
): string {
  return i18n?.textDiff?.[key] ?? key
}
