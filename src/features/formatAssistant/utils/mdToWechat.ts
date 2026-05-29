import type { WechatTheme } from "../types/storage"
import type { BaseThemeColors } from "./mdToShared"
import {
  buildThemeList,
  convertMarkdown,
  WECHAT_STYLE_OVERRIDES,
} from "./mdToShared"

/**
 * 微信公众号主题配色定义
 */
const WECHAT_THEMES: Record<WechatTheme, BaseThemeColors> = {
  default: {
    primary: "#07c160",
    headingColor: "#1a1a1a",
    textColor: "#3f3f3f",
    quoteBorderColor: "#07c160",
    quoteBgColor: "#f0faf4",
    codeBgColor: "#f6f8fa",
    inlineCodeBgColor: "#fff5f5",
    inlineCodeColor: "#ff502c",
    linkColor: "#07c160",
    hrColor: "#e0e0e0",
    tableHeaderBg: "#f6f8fa",
    tableBorderColor: "#dfe2e5",
    strongColor: "#1a1a1a",
  },
  green: {
    primary: "#52c41a",
    headingColor: "#135200",
    textColor: "#333333",
    quoteBorderColor: "#52c41a",
    quoteBgColor: "#f6ffed",
    codeBgColor: "#f0f5eb",
    inlineCodeBgColor: "#f6ffed",
    inlineCodeColor: "#52c41a",
    linkColor: "#52c41a",
    hrColor: "#d9d9d9",
    tableHeaderBg: "#f6ffed",
    tableBorderColor: "#b7eb8f",
    strongColor: "#135200",
  },
  orange: {
    primary: "#fa8c16",
    headingColor: "#873800",
    textColor: "#333333",
    quoteBorderColor: "#fa8c16",
    quoteBgColor: "#fff7e6",
    codeBgColor: "#fff8f0",
    inlineCodeBgColor: "#fff7e6",
    inlineCodeColor: "#fa8c16",
    linkColor: "#fa8c16",
    hrColor: "#d9d9d9",
    tableHeaderBg: "#fff7e6",
    tableBorderColor: "#ffd591",
    strongColor: "#873800",
  },
  purple: {
    primary: "#722ed1",
    headingColor: "#22075e",
    textColor: "#333333",
    quoteBorderColor: "#722ed1",
    quoteBgColor: "#f9f0ff",
    codeBgColor: "#f5f0f8",
    inlineCodeBgColor: "#f9f0ff",
    inlineCodeColor: "#722ed1",
    linkColor: "#722ed1",
    hrColor: "#d9d9d9",
    tableHeaderBg: "#f9f0ff",
    tableBorderColor: "#d3adf7",
    strongColor: "#22075e",
  },
  blue: {
    primary: "#1890ff",
    headingColor: "#003a8c",
    textColor: "#333333",
    quoteBorderColor: "#1890ff",
    quoteBgColor: "#e6f7ff",
    codeBgColor: "#f0f7ff",
    inlineCodeBgColor: "#e6f7ff",
    inlineCodeColor: "#1890ff",
    linkColor: "#1890ff",
    hrColor: "#d9d9d9",
    tableHeaderBg: "#e6f7ff",
    tableBorderColor: "#91d5ff",
    strongColor: "#003a8c",
  },
}

/**
 * 微信主题元数据（名称和预览色）
 */
const WECHAT_THEME_META: Record<WechatTheme, { label: string, color: string }> = {
  default: {
    label: "微信绿",
    color: "#07c160",
  },
  green: {
    label: "清新绿",
    color: "#52c41a",
  },
  orange: {
    label: "活力橙",
    color: "#fa8c16",
  },
  purple: {
    label: "优雅紫",
    color: "#722ed1",
  },
  blue: {
    label: "科技蓝",
    color: "#1890ff",
  },
}

/**
 * 将 Markdown 转换为微信公众号格式
 */
export async function convertMdToWechat(
  markdown: string,
  options: {
    theme: WechatTheme
    fontSize: number
    lineHeight: number
    codeHighlight: boolean
  },
): Promise<string> {
  const {
    theme,
    ...rest
  } = options
  return convertMarkdown(markdown, rest, WECHAT_THEMES[theme], WECHAT_STYLE_OVERRIDES)
}

/**
 * 获取主题列表
 */
export function getWechatThemes(): { value: WechatTheme, label: string, color: string }[] {
  return buildThemeList(WECHAT_THEME_META)
}
