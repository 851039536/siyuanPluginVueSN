// Token 短名迁移正确性校验（基于 git diff，最权威）
// 原理：检查每一处改动行，若「旧行」与「新行」在把短名还原为旧长名后完全相同，则为纯重命名。
// 用法：node scripts/verify-token-migration.mjs < git-diff-output.txt

import { readFileSync } from "node:fs"

const input = process.argv[2]
  ? readFileSync(process.argv[2], "utf8")
  : readFileSync(0, "utf8")

/** 短名 → 旧长名（还原用）。$r-base 同时承担 $radius-base 与 $vp-radius 的收敛目标。 */
const REVERSE = {
  "$lh-tight": ["$line-height-tight"], "$lh-normal": ["$line-height-normal"], "$lh-relaxed": ["$line-height-relaxed"],
  "$fw-light": ["$font-weight-light"], "$fw-normal": ["$font-weight-normal"], "$fw-medium": ["$font-weight-medium"],
  "$fw-semibold": ["$font-weight-semibold"], "$fw-bold": ["$font-weight-bold"],
  "$t-2xs": ["$font-size-2xs"], "$t-xs": ["$font-size-xs"], "$t-sm": ["$font-size-sm"],
  "$t-base": ["$font-size-base"], "$t-lg": ["$font-size-lg"], "$t-2xl": ["$font-size-2xl"],
  "$t-3xl": ["$font-size-3xl"], "$t-4xl": ["$font-size-4xl"],
  "$c-fg": ["$color-fg"], "$c-bg": ["$color-bg"], "$c-muted": ["$color-muted"], "$c-surface": ["$color-surface"],
  "$c-border": ["$color-border"], "$c-primary": ["$color-primary"], "$c-secondary": ["$color-secondary"],
  "$c-accent": ["$color-accent"], "$c-danger-bright": ["$color-danger-bright"], "$c-danger": ["$color-danger"],
  "$c-success": ["$color-success"], "$c-warning": ["$color-warning"], "$c-info": ["$color-info"],
  "$r-0": ["$radius-none"], "$r-px2": ["$radius-2px"], "$r-px3": ["$radius-px"], "$r-sm": ["$radius-sm"],
  "$r-base": ["$radius-base", "$vp-radius"], "$r-md": ["$radius-md"], "$r-lg": ["$radius-lg"],
  "$r-xl": ["$radius-xl"], "$r-2xl": ["$radius-2xl"], "$r-full": ["$radius-full"],
  "$s-px1": ["$spacing-1px"], "$s-px2": ["$spacing-2px"], "$s-px3": ["$spacing-px"], "$s-px5": ["$spacing-5px"],
  "$s-px6": ["$spacing-6px"], "$s-px7": ["$spacing-7px"], "$s-px10": ["$spacing-10px"],
  "$s-px14": ["$spacing-14px"], "$s-px18": ["$spacing-18px"], "$s-0": ["$spacing-0"],
  "$s-1": ["$spacing-1"], "$s-2": ["$spacing-2"], "$s-3": ["$spacing-3"], "$s-4": ["$spacing-4"],
  "$s-5": ["$spacing-5"], "$s-6": ["$spacing-6"], "$s-8": ["$spacing-8"], "$s-10": ["$spacing-10"],
  "$s-12": ["$spacing-12"], "$s-16": ["$spacing-16"],
  "$ff-zh": ["$font-zh"], "$ff-mono": ["$vp-mono"], "$bp-mobile": ["$mobile-breakpoint"],
}

/** 生成「把短名折叠为占位符」的函数：多候选来源折叠为同一占位符 */
// 注意：必须「短名先折叠」，否则长名被折叠成 `\0$c-x\0` 后，短名规则会二次命中导致重复包裹
function fold(text) {
  let out = text
  for (const [short, longs] of Object.entries(REVERSE)) {
    const ph = `\u0000${short}\u0000`
    out = out.replace(new RegExp(`\\${short}(?![\\w-])`, "g"), ph)
    for (const l of longs) {
      out = out.replace(new RegExp(`\\${l}(?![\\w-])`, "g"), ph)
    }
  }
  return out
}

// 解析 git diff：分别收集删除行(-)与新增行(+)，按 hunk 内相邻配对
const lines = input.split(/\r?\n/)
let currentFile = ""
const problems = []
let removed = []
let added = []
let checkedFiles = new Set()

function flush() {
  if (removed.length === 0 && added.length === 0) return
  // 用多重集合比较：对每行做 fold 后排序，两侧集合应完全相等
  const a = removed.map(fold).sort()
  const b = added.map(fold).sort()
  if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
    // 找出首个不同项用于定位
    const onlyA = a.filter(x => !b.includes(x))[0]
    const onlyB = b.filter(x => !a.includes(x))[0]
    problems.push({
      file: currentFile,
      reason: `折叠后内容不等 (${removed.length} 删 / ${added.length} 增)`,
      sample: onlyA !== undefined || onlyB !== undefined
        ? `仅有旧侧: ${JSON.stringify(onlyA)}\n    仅有新侧: ${JSON.stringify(onlyB)}`
        : "",
    })
  }
  removed = []
  added = []
}

for (const line of lines) {
  if (line.startsWith("diff --git ")) {
    flush()
    const m = line.match(/ b\/(.+)$/)
    currentFile = m ? m[1] : line
    checkedFiles.add(currentFile)
  } else if (line.startsWith("@@")) {
    flush()
  } else if (line.startsWith("---") || line.startsWith("+++")) {
    continue
  } else if (line.startsWith("-")) {
    removed.push(line.slice(1))
  } else if (line.startsWith("+")) {
    added.push(line.slice(1))
  } else {
    flush()
  }
}
flush()

// 真源文件含刻意的短名定义，单独豁免
const SOURCE = "src/components/kit/variables.scss"
const realProblems = problems.filter(p => p.file !== SOURCE)
const sourceProblem = problems.find(p => p.file === SOURCE)

console.log("=".repeat(60))
console.log("Token 短名迁移正确性校验（git diff 逐行）")
console.log("=".repeat(60))
console.log(`检查文件：${checkedFiles.size}`)
console.log(`非纯重命名行组：${realProblems.length}`)
if (sourceProblem) console.log(`（另有真源文件 ${SOURCE} 含新增短名定义，属预期）`)
if (realProblems.length > 0) {
  console.log("")
  for (const p of realProblems.slice(0, 20)) {
    console.log(`  ✗ ${p.file} — ${p.reason}`)
    if (p.sample) console.log(`     ${p.sample}`)
  }
  process.exit(1)
}
console.log("")
console.log("✅ 所有改动行均为纯 Token 重命名，无任何内容副作用。")
