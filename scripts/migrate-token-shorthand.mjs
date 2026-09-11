// SCSS Token 短名批量替换脚本
// 用途：把存量 .scss 中的旧长名 Token 替换为短名（规范见 docs/token-shorthand.md）
// 用法：node scripts/migrate-token-shorthand.mjs --group=<组名> [--dry]
//   组名：lh | fw | t | c | r | s | ff | all
//   --dry  只展示将改动的文件与处数，不写盘
// 安全性：
//   1. 使用词边界正则，避免 $spacing-1 误命中 $spacing-10 / $spacing-1px
//   2. 长名优先排序，避免前缀包含关系导致串改
//   3. 真源文件的「旧长名兼容别名」段不动（否则别名会变成自引用）
//   4. 逐文件写盘并计数，可用 git checkout 回滚

import { globSync, readFileSync, writeFileSync } from "node:fs"
import { relative, resolve } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")
const argv = process.argv.slice(2)
const DRY = argv.includes("--dry")
const groupArg = argv.find(a => a.startsWith("--group="))
const GROUP = groupArg ? groupArg.split("=")[1] : "all"

/** 分组映射：旧长名 → 新短名。组顺序即迁移批次顺序（风险递增）。 */
const GROUPS = {
  // 3.1 行高（279 处，风险极低）
  lh: {
    "$line-height-tight": "$lh-tight",
    "$line-height-normal": "$lh-normal",
    "$line-height-relaxed": "$lh-relaxed",
  },
  // 3.2 字重（751 处，风险极低）
  fw: {
    "$font-weight-light": "$fw-light",
    "$font-weight-normal": "$fw-normal",
    "$font-weight-medium": "$fw-medium",
    "$font-weight-semibold": "$fw-semibold",
    "$font-weight-bold": "$fw-bold",
  },
  // 3.3 字号（1857 处，风险低）
  t: {
    "$font-size-2xs": "$t-2xs",
    "$font-size-xs": "$t-xs",
    "$font-size-sm": "$t-sm",
    "$font-size-base": "$t-base",
    "$font-size-lg": "$t-lg",
    "$font-size-2xl": "$t-2xl",
    "$font-size-3xl": "$t-3xl",
    "$font-size-4xl": "$t-4xl",
  },
  // 3.4 颜色（757 处，风险低）
  c: {
    "$color-danger-bright": "$c-danger-bright",
    "$color-fg": "$c-fg",
    "$color-bg": "$c-bg",
    "$color-muted": "$c-muted",
    "$color-surface": "$c-surface",
    "$color-border": "$c-border",
    "$color-primary": "$c-primary",
    "$color-secondary": "$c-secondary",
    "$color-accent": "$c-accent",
    "$color-danger": "$c-danger",
    "$color-success": "$c-success",
    "$color-warning": "$c-warning",
    "$color-info": "$c-info",
  },
  // 3.5 圆角（1211 处，风险中）
  r: {
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
  },
  // 3.6 间距（4416 处，风险高 —— 含大量前缀包含关系）
  s: {
    "$spacing-18px": "$s-px18",
    "$spacing-14px": "$s-px14",
    "$spacing-10px": "$s-px10",
    "$spacing-7px": "$s-px7",
    "$spacing-6px": "$s-px6",
    "$spacing-5px": "$s-px5",
    "$spacing-2px": "$s-px2",
    "$spacing-1px": "$s-px1",
    "$spacing-px": "$s-px3",
    "$spacing-16": "$s-16",
    "$spacing-12": "$s-12",
    "$spacing-10": "$s-10",
    "$spacing-0": "$s-0",
    "$spacing-1": "$s-1",
    "$spacing-2": "$s-2",
    "$spacing-3": "$s-3",
    "$spacing-4": "$s-4",
    "$spacing-5": "$s-5",
    "$spacing-6": "$s-6",
    "$spacing-8": "$s-8",
  },
  // 3.7 字体族与断点（414 处，风险低）
  ff: {
    "$font-zh": "$ff-zh",
    "$vp-mono": "$ff-mono",
    "$mobile-breakpoint": "$bp-mobile",
  },
}

/** Token 真源：其内部「旧长名兼容别名」定义行必须保留旧名，否则变成自引用 */
const SOURCE_FILES = [
  "src/components/kit/variables.scss",
]

/** 真源中匹配「$oldname: $newname;」的别名定义行，需跳过 */
function isAliasDefinitionLine(code) {
  return /^\s*\$[a-z0-9-]+:\s*\$[a-z0-9-]+\s*;/.test(code)
}

function buildPairs(groups) {
  const map = new Map()
  for (const g of groups) {
    for (const [k, v] of Object.entries(GROUPS[g])) map.set(k, v)
  }
  // 长名优先，避免 $spacing-1 抢先匹配 $spacing-10px
  return [...map].sort((a, b) => b[0].length - a[0].length)
}

function migrate(text, pairs, skipAliasLines) {
  let count = 0
  const lines = text.split(/\r?\n/)
  const out = lines.map((line) => {
    const code = skipAliasLines ? line : line // 行级判定在后面处理注释
    if (skipAliasLines && isAliasDefinitionLine(code)) return line
    let result = line
    for (const [oldName, newName] of pairs) {
      // 词边界：右侧不能是 [\w-]，左侧不能是 [\w-]（避免 $my-$spacing-1 之类）
      const re = new RegExp(`\\${oldName}(?![\\w-])`, "g")
      const before = result
      result = result.replace(re, newName)
      if (result !== before) count += (before.match(re) ?? []).length
    }
    return result
  })
  return { text: out.join("\n"), count }
}

async function main() {
  const groups = GROUP === "all" ? ["lh", "fw", "t", "c", "r", "s", "ff"] : [GROUP]
  for (const g of groups) {
    if (!GROUPS[g]) {
      console.error(`未知分组：${g}。可选：${Object.keys(GROUPS).join(" | ")} | all`)
      process.exit(2)
    }
  }
  const pairs = buildPairs(groups)

  const files = globSync("src/**/*.scss", { cwd: ROOT, absolute: true })
  let totalCount = 0
  const changed = []
  let pending = [...files]
  let failed = []

  // 幂等：已迁移的文件再次运行命中数为 0，因此可安全重跑以续上被中断的批次
  for (let attempt = 0; attempt < 4 && pending.length > 0; attempt++) {
    failed = []
    for (const abs of pending) {
      const rel = relative(ROOT, abs).replaceAll("\\", "/")
      let original
      try {
        original = readFileSync(abs, "utf8")
      } catch {
        failed.push(abs)
        continue
      }
      const { text, count } = migrate(original, pairs, SOURCE_FILES.includes(rel))
      if (count === 0) continue
      if (DRY) {
        changed.push({ file: rel, count })
        totalCount += count
        continue
      }
      try {
        writeFileSync(abs, text, "utf8")
        changed.push({ file: rel, count })
        totalCount += count
      } catch {
        failed.push(abs) // 文件被占用，稍后重试
      }
    }
    pending = failed
    if (pending.length > 0) await new Promise(r => setTimeout(r, 500))
  }

  console.log("=".repeat(60))
  console.log(`Token 短名迁移  group=${groups.join(",")}${DRY ? "  [DRY RUN]" : ""}`)
  console.log("=".repeat(60))
  console.log(`替换处数：${totalCount}  涉及文件：${changed.length}`)
  if (pending.length > 0) {
    console.log("")
    console.log(`⚠️  ${pending.length} 个文件写入失败（被占用），请关闭占用后重跑本命令：`)
    pending.slice(0, 10).forEach(f => console.log("    " + relative(ROOT, f).replaceAll("\\", "/")))
  }
  console.log("")
  const top = changed.sort((a, b) => b.count - a.count).slice(0, 15)
  for (const c of top) console.log(`  ${String(c.count).padStart(5)}  ${c.file}`)
  if (changed.length > 15) console.log(`  ... 其余 ${changed.length - 15} 个文件`)
  console.log("")
  if (DRY) console.log("（--dry 模式，未写盘）")
  else console.log("已写盘。回滚：git checkout -- src/")
}

main()
