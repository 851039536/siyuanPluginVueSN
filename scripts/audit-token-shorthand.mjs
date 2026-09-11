// SCSS Token 短名规范检查脚本
// 用途：检测 .scss 中仍在使用旧长名 Token（$radius-* / $spacing-* / $font-size-* 等），
//      提示改用短名（$r-* / $s-* / $t-* 等）。规范见 docs/token-shorthand.md
// 用法：node scripts/audit-token-shorthand.mjs [--dry] [--json]
//   --dry   只统计不写盘（默认行为，本脚本不产出文件）
//   --json  以 JSON 输出，便于 CI 消费
// 退出码：0 = 无违规；1 = 存在违规（可用于 CI 门禁）
// 例外：Token 真源文件（variables.scss）的旧名别名段不报警

import { globSync, readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")
const argv = process.argv.slice(2)
const AS_JSON = argv.includes("--json")

/** 旧长名 → 新短名 映射（与 docs/token-shorthand.md § 三 一一对应） */
const TOKEN_MAP = {
  "$radius-none": "$r-0",
  "$radius-2px": "$r-px2",
  "$radius-px": "$r-px3",
  "$radius-sm": "$r-sm",
  "$radius-base": "$r-base",
  "$radius-md": "$r-md",
  "$radius-lg": "$r-lg",
  "$radius-xl": "$r-xl",
  "$radius-2xl": "$r-2xl",
  "$radius-full": "$r-full",
  "$vp-radius": "$r-base",
  "$spacing-0": "$s-0",
  "$spacing-1px": "$s-px1",
  "$spacing-2px": "$s-px2",
  "$spacing-px": "$s-px3",
  "$spacing-5px": "$s-px5",
  "$spacing-6px": "$s-px6",
  "$spacing-7px": "$s-px7",
  "$spacing-10px": "$s-px10",
  "$spacing-14px": "$s-px14",
  "$spacing-18px": "$s-px18",
  "$spacing-1": "$s-1",
  "$spacing-2": "$s-2",
  "$spacing-3": "$s-3",
  "$spacing-4": "$s-4",
  "$spacing-5": "$s-5",
  "$spacing-6": "$s-6",
  "$spacing-8": "$s-8",
  "$spacing-10": "$s-10",
  "$spacing-12": "$s-12",
  "$spacing-16": "$s-16",
  "$font-size-2xs": "$t-2xs",
  "$font-size-xs": "$t-xs",
  "$font-size-sm": "$t-sm",
  "$font-size-base": "$t-base",
  "$font-size-lg": "$t-lg",
  "$font-size-2xl": "$t-2xl",
  "$font-size-3xl": "$t-3xl",
  "$font-size-4xl": "$t-4xl",
  "$font-weight-light": "$fw-light",
  "$font-weight-normal": "$fw-normal",
  "$font-weight-medium": "$fw-medium",
  "$font-weight-semibold": "$fw-semibold",
  "$font-weight-bold": "$fw-bold",
  "$line-height-tight": "$lh-tight",
  "$line-height-normal": "$lh-normal",
  "$line-height-relaxed": "$lh-relaxed",
  "$color-fg": "$c-fg",
  "$color-bg": "$c-bg",
  "$color-muted": "$c-muted",
  "$color-surface": "$c-surface",
  "$color-border": "$c-border",
  "$color-primary": "$c-primary",
  "$color-secondary": "$c-secondary",
  "$color-accent": "$c-accent",
  "$color-danger": "$c-danger",
  "$color-danger-bright": "$c-danger-bright",
  "$color-success": "$c-success",
  "$color-warning": "$c-warning",
  "$color-info": "$c-info",
  "$font-zh": "$ff-zh",
  "$vp-mono": "$ff-mono",
  "$mobile-breakpoint": "$bp-mobile",
}

/**
 * 例外文件：Token 真源。其「旧长名兼容别名」段必须保留旧名，不报警。
 * 其他文件出现旧名即为待迁移点。
 */
const EXEMPT_FILES = [
  "src/components/kit/variables.scss",
]

/** 匹配 $token-name 形式，右侧不能接 [\w-]（避免 $spacing-1 命中 $spacing-10） */
const TOKEN_RE = /\$(?:radius|spacing|font-size|font-weight|line-height|color|font-zh|mobile-breakpoint|vp-radius|vp-mono)(?:-[a-z0-9]+)*/g

function scanFile(absPath) {
  const rel = relative(ROOT, absPath).replaceAll("\\", "/")
  if (EXEMPT_FILES.includes(rel)) return []

  let text
  try {
    text = readFileSync(absPath, "utf8")
  } catch {
    return []
  }
  if (!text) return []

  const findings = []
  const lines = text.split(/\r?\n/)

  lines.forEach((raw, i) => {
    // 剥离行内注释后再匹配，避免注释里的示例代码产生噪音
    const code = raw.replace(/\/\/.*$/, "")
    TOKEN_RE.lastIndex = 0
    const seen = new Set()
    let m
    while ((m = TOKEN_RE.exec(code)) !== null) {
      const oldName = m[0]
      // 仅在映射表中精确存在时才算违规（TOKEN_RE 会切出前缀片段）
      if (!(oldName in TOKEN_MAP)) continue
      if (seen.has(oldName)) continue
      seen.add(oldName)
      findings.push({
        file: rel,
        line: i + 1,
        oldName,
        newName: TOKEN_MAP[oldName],
      })
    }
  })

  return findings
}

function main() {
  const files = globSync("src/**/*.scss", { cwd: ROOT, absolute: true })
  const all = files.flatMap(scanFile)

  // 按旧名归组统计
  const byToken = new Map()
  for (const f of all) {
    byToken.set(f.oldName, (byToken.get(f.oldName) ?? 0) + 1)
  }
  // 按文件归组统计
  const byFile = new Map()
  for (const f of all) {
    byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1)
  }

  if (AS_JSON) {
    console.log(JSON.stringify({
      scannedFiles: files.length,
      totalFindings: all.length,
      affectedFiles: byFile.size,
      byToken: Object.fromEntries([...byToken].sort((a, b) => b[1] - a[1])),
      findings: all,
    }, null, 2))
    process.exit(all.length > 0 ? 1 : 0)
  }

  console.log("=".repeat(64))
  console.log("SCSS Token 短名规范检查（docs/token-shorthand.md）")
  console.log("=".repeat(64))
  console.log(`扫描 .scss 文件：${files.length}`)
  console.log(`旧长名命中：${all.length} 处 / ${byFile.size} 个文件`)
  console.log("")

  if (all.length === 0) {
    console.log("✅ 未发现旧长名 Token，已全面使用短名。")
    process.exit(0)
  }

  console.log("── 按旧 Token 归组（TOP 20）──")
  const top = [...byToken].sort((a, b) => b[1] - a[1]).slice(0, 20)
  for (const [name, count] of top) {
    console.log(`  ${String(count).padStart(5)}  ${name.padEnd(24)} → ${TOKEN_MAP[name]}`)
  }
  console.log("")
  console.log("── 按文件归组（TOP 15）──")
  const topFiles = [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15)
  for (const [file, count] of topFiles) {
    console.log(`  ${String(count).padStart(5)}  ${file}`)
  }
  console.log("")
  console.log("提示：迁移期新旧名等值共存，可分批替换。批次顺序见 docs/token-shorthand.md § 四。")
  console.log("      加 --json 获取逐条明细。")

  process.exit(1)
}

main()
