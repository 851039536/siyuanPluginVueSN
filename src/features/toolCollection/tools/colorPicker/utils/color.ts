/**
 * 颜色选择器工具 - 纯函数
 * 提供 HEX/RGB/HSL 颜色格式互转
 */

export interface RGB {
  r: number
  g: number
  b: number
}

export interface HSL {
  h: number
  s: number
  l: number
}

/** HEX → RGB */
export function hexToRgb(hex: string): RGB | null {
  const clean = hex.replace(/^#/, "")
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

/** RGB → HEX */
export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** RGB → HSL */
export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
    if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / delta + 2) / 6
    else h = ((rn - gn) / delta + 4) / 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/** HSL → RGB */
export function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100
  const ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2
  let rn = 0
  let gn = 0
  let bn = 0

  if (h < 60) { rn = c; gn = x; bn = 0 }
  else if (h < 120) { rn = x; gn = c; bn = 0 }
  else if (h < 180) { rn = 0; gn = c; bn = x }
  else if (h < 240) { rn = 0; gn = x; bn = c }
  else if (h < 300) { rn = x; gn = 0; bn = c }
  else { rn = c; gn = 0; bn = x }

  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255),
  }
}

/** 格式化 RGB 为 CSS 字符串 */
export function formatRgb({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`
}

/** 格式化 HSL 为 CSS 字符串 */
export function formatHsl({ h, s, l }: HSL): string {
  return `hsl(${h}, ${s}%, ${l}%)`
}
