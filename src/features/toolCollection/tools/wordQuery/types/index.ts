// 单词查询 — 共享类型与语言映射
import type { Plugin } from "siyuan"

/** 子组件共享 Props 接口 — CodeTranslationPanel / CodeCommentGenerator / CodeExplainer / RegexGenerator 统一使用 */
export interface WordQueryComponentProps {
  i18n: Record<string, any>
  plugin?: Plugin
}

/** 语言代码 → 语言名称 映射，作为 index.vue LANGUAGE_OPTIONS 与 translateText 共享的单一数据源 */
export const LANGUAGE_MAP: Record<string, string> = {
  auto: "自动检测",
  zh: "中文",
  en: "英文",
  ja: "日文",
  ko: "韩文",
  fr: "法文",
  de: "德文",
  es: "西班牙文",
}
