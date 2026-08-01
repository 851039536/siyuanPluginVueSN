/**
 * hljs 高亮主题注册表
 * ?inline 导入官方主题 CSS，按 .hljs-theme-<id> 前缀作用域化后注入
 */
import atomDarkCss from "highlight.js/styles/atom-one-dark.css?inline"
import atomLightCss from "highlight.js/styles/atom-one-light.css?inline"
import githubCss from "highlight.js/styles/github.css?inline"
import githubDarkCss from "highlight.js/styles/github-dark.css?inline"
import monokaiCss from "highlight.js/styles/monokai.css?inline"
import tokyoNightCss from "highlight.js/styles/tokyo-night-dark.css?inline"
import {
  injectStyle,
  removeStyle,
} from "@/utils/domUtils"

export interface HljsThemeDef {
  id: string
  /** i18n 键（hljsGitHubLight 等） */
  labelKey: string
  /** 默认跟随的容器主题倾向（light/dark） */
  suggests: "light" | "dark"
  css: string
}

/** 可用 hljs 高亮主题（6 套） */
export const HLJS_THEMES: HljsThemeDef[] = [
  { id: "github", labelKey: "hljsGitHubLight", suggests: "light", css: githubCss },
  { id: "githubDark", labelKey: "hljsGitHubDark", suggests: "dark", css: githubDarkCss },
  { id: "atomLight", labelKey: "hljsAtomLight", suggests: "light", css: atomLightCss },
  { id: "atomDark", labelKey: "hljsAtomDark", suggests: "dark", css: atomDarkCss },
  { id: "monokai", labelKey: "hljsMonokai", suggests: "dark", css: monokaiCss },
  { id: "tokyoNight", labelKey: "hljsTokyoNight", suggests: "dark", css: tokyoNightCss },
]

/** 默认 hljs 主题 id（跟随容器主题） */
export function defaultHljsTheme(containerTheme: string): string {
  return HLJS_THEMES.find((t) => t.suggests === containerTheme)?.id ?? "github"
}

/** 将主题 CSS 作用域化为 .hljs-theme-<id> 下的规则（丢弃 code.hljs / pre code.hljs 布局规则） */
export function scopeHljsCss(css: string, themeId: string): string {
  const wrapper = `.hljs-theme-${themeId}`
  return css
    .split(/\}/)
    .map((chunk) => {
      const brace = chunk.indexOf("{")
      if (brace < 0) return chunk
      const selector = chunk.slice(0, brace).trim()
      const body = chunk.slice(brace)
      if (!selector.includes(".hljs")) return `${chunk}}`
      // 布局规则（pre code.hljs / code.hljs）由组件自身样式负责，直接丢弃
      if (/code\.hljs/.test(selector)) return ""
      const scoped = selector
        .split(",")
        .map((s) => `${wrapper} ${s.trim()}`)
        .join(", ")
      return `${scoped}${body}}`
    })
    .join("")
}

/** 注入指定 hljs 主题（覆盖同名旧样式） */
export function injectHljsTheme(themeId: string): void {
  const def = HLJS_THEMES.find((t) => t.id === themeId)
  if (!def) return
  removeStyle(`code-image-hljs-${themeId}`)
  injectStyle(`code-image-hljs-${themeId}`, scopeHljsCss(def.css, themeId))
}

/** 移除指定 hljs 主题样式 */
export function removeHljsTheme(themeId: string): void {
  removeStyle(`code-image-hljs-${themeId}`)
}
