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

/** 语言代码 → i18n 键（界面展示本地化名称，prompt 内仍用 LANGUAGE_MAP 的中文名） */
export const LANGUAGE_I18N_KEYS: Record<string, string> = {
  auto: "autoDetect",
  zh: "chinese",
  en: "english",
  ja: "japanese",
  ko: "korean",
  fr: "french",
  de: "german",
  es: "spanish",
}
