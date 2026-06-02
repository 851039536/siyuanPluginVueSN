import type {
  BilibiliTheme,
  CodeWrapMode,
} from "../types/storage"
import type { BaseThemeColors } from "./mdToShared"
import {
  BILIBILI_STYLE_OVERRIDES,
  buildThemeList,
  convertMarkdown,
} from "./mdToShared"

/**
 * 哔哩哔哩主题配色定义
 */
const BILIBILI_THEMES: Record<BilibiliTheme, BaseThemeColors> = {
  default: {
    primary: "#00a1d6",
    headingColor: "#18191c",
    textColor: "#333333",
    quoteBorderColor: "#00a1d6",
    quoteBgColor: "#f0faff",
    codeBgColor: "#f6f8fa",
    inlineCodeBgColor: "#fff1f0",
    inlineCodeColor: "#ff4d4f",
    linkColor: "#00a1d6",
    hrColor: "#e3e5e7",
    tableHeaderBg: "#f6f8fa",
    tableBorderColor: "#e3e5e7",
    strongColor: "#18191c",
    codeBlockHeaderBg: "#e3e5e7",
    codeBlockHeaderColor: "#9499a0",
  },
  pink: {
    primary: "#fb7299",
    headingColor: "#18191c",
    textColor: "#333333",
    quoteBorderColor: "#fb7299",
    quoteBgColor: "#fff0f5",
    codeBgColor: "#f9f0f4",
    inlineCodeBgColor: "#fff0f5",
    inlineCodeColor: "#fb7299",
    linkColor: "#fb7299",
    hrColor: "#e3e5e7",
    tableHeaderBg: "#fff0f5",
    tableBorderColor: "#f9b4c8",
    strongColor: "#18191c",
    codeBlockHeaderBg: "#fce4ec",
    codeBlockHeaderColor: "#9499a0",
  },
  dark: {
    primary: "#23ade5",
    headingColor: "#e6e6e6",
    textColor: "#c9c9c9",
    quoteBorderColor: "#23ade5",
    quoteBgColor: "#2a2a2a",
    codeBgColor: "#1e1e1e",
    inlineCodeBgColor: "#2d2d2d",
    inlineCodeColor: "#23ade5",
    linkColor: "#23ade5",
    hrColor: "#3a3a3a",
    tableHeaderBg: "#2a2a2a",
    tableBorderColor: "#3a3a3a",
    strongColor: "#e6e6e6",
    codeBlockHeaderBg: "#333333",
    codeBlockHeaderColor: "#9499a0",
  },
  mint: {
    primary: "#2db84b",
    headingColor: "#18191c",
    textColor: "#333333",
    quoteBorderColor: "#2db84b",
    quoteBgColor: "#f0fff4",
    codeBgColor: "#f0f9f1",
    inlineCodeBgColor: "#f0fff4",
    inlineCodeColor: "#2db84b",
    linkColor: "#2db84b",
    hrColor: "#e3e5e7",
    tableHeaderBg: "#f0fff4",
    tableBorderColor: "#b7eb8f",
    strongColor: "#18191c",
    codeBlockHeaderBg: "#e8f5e9",
    codeBlockHeaderColor: "#9499a0",
  },
}

/**
 * 哔哩哔哩主题元数据（名称和预览色）
 */
const BILIBILI_THEME_META: Record<BilibiliTheme, { label: string, color: string }> = {
  default: {
    label: "哔哩蓝",
    color: "#00a1d6",
  },
  pink: {
    label: "少女粉",
    color: "#fb7299",
  },
  dark: {
    label: "暗夜黑",
    color: "#333333",
  },
  mint: {
    label: "薄荷绿",
    color: "#2db84b",
  },
}

/**
 * 将 Markdown 转换为哔哩哔哩专栏格式
 */
export async function convertMdToBilibili(
  markdown: string,
  options: {
    theme: BilibiliTheme
    fontSize: number
    lineHeight: number
    codeHighlight: boolean
    codeWrap?: CodeWrapMode
  },
): Promise<string> {
  const {
    theme,
    ...rest
  } = options
  return convertMarkdown(markdown, rest, BILIBILI_THEMES[theme], BILIBILI_STYLE_OVERRIDES)
}

/**
 * 获取哔哩哔哩主题列表
 */
export function getBilibiliThemes(): { value: BilibiliTheme, label: string, color: string }[] {
  return buildThemeList(BILIBILI_THEME_META)
}
