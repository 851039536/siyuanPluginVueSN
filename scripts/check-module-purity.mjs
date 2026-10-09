// 模块图纯净性检查（开发期工具，非构建/测试流程的一部分）
//
// 用途：Vitest 的测试文件必须在 Node 环境下可加载。项目里 `siyuan` 包的 exports 字段
// 在 node 条件下不可解析，因此任何「把运行时 siyuan 依赖拉进模块图」的 import 都会让
// 相关单测整体失败（报 `"." is not exported under the conditions [...]`）。
//
// 本脚本从入口文件出发遍历相对/@ 导入，报告可达的 siyuan 依赖及其引入路径，用于定位
// 需要改成「直连纯类型/纯函数模块」的 import。
//
// 用法：node scripts/check-module-purity.mjs <入口文件> [更多入口...]
import { existsSync, readFileSync, statSync } from "node:fs"
import { basename, dirname, resolve } from "node:path"

const SRC = resolve(import.meta.dirname, "..", "src")
const entries = process.argv.slice(2)
if (entries.length === 0) {
  console.error("用法: node scripts/check-module-purity.mjs <入口文件> [...]")
  process.exit(2)
}

/** 解析一个导入说明符为实际文件路径（只处理相对与 @/ 别名，其余视为外部依赖） */
function resolveSpec(spec, fromFile) {
  if (!spec.startsWith(".") && !spec.startsWith("@/")) return null
  const base = spec.startsWith("@/") ? resolve(SRC, spec.slice(2)) : resolve(dirname(fromFile), spec)
  for (const ext of ["", ".ts", ".vue", "/index.ts"]) {
    const candidate = base + ext
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

const visited = new Set()
const offenders = []

/**
 * 判定某模块是否"值导入"了 siyuan。
 * `import type {...} from "siyuan"` 与 `import { type X } from "siyuan"` 在构建时被完全擦除，
 * 不会让 Node/Vitest 去解析该包；只有值导入（含默认导入与副作用导入）才是真问题。
 */
function valueImportsSiyuan(src) {
  // 副作用导入：import "siyuan"
  if (/^\s*import\s+["']siyuan["']/m.test(src)) return true
  // clause 以非空白字符收尾（\S），避免 [\s\S]*? 与分隔用的 \s+ 重叠而产生回溯歧义。
  // 注意：分隔符必须用 \s+ 而非 [ \t]+，否则「from 换行书写」的 import 会漏检。
  for (const match of src.matchAll(/^\s*import\s+(type\s+)?([\s\S]*?\S)\s+from\s+["']siyuan["']/gm)) {
    if (match[1]) continue // import type ... —— 纯类型，构建时擦除
    const clause = match[2].trim()
    // `import { type A, type B }` 全部带 type 修饰符时同样会被擦除
    const inner = clause.match(/^\{([\s\S]*)\}$/)
    if (inner && inner[1].split(",").every((part) => !part.trim() || /^type\s/.test(part.trim()))) continue
    return true
  }
  return false
}

function walk(file, trail) {
  if (visited.has(file)) return
  visited.add(file)
  let src
  try {
    src = readFileSync(file, "utf8")
  } catch {
    return
  }
  if (valueImportsSiyuan(src)) {
    offenders.push({ file, trail })
    return
  }
  for (const match of src.matchAll(/from\s+["']([^"']+)["']/g)) {
    const next = resolveSpec(match[1], file)
    if (next) walk(next, [...trail, basename(file)])
  }
}

for (const entry of entries) {
  const abs = resolve(entry)
  if (!existsSync(abs)) {
    console.error(`入口不存在: ${abs}`)
    process.exit(2)
  }
  walk(abs, [])
}

console.log(`已遍历 ${visited.size} 个模块，入口 ${entries.length} 个`)
if (offenders.length === 0) {
  console.log("✅ 模块图纯净：不可达任何运行时 siyuan 依赖，可在 Node 单测环境加载")
  process.exit(0)
}
console.log(`❌ 发现 ${offenders.length} 条可达的运行时 siyuan 依赖：`)
for (const { file, trail } of offenders) {
  const rel = file.slice(SRC.length + 1).replace(/\\/g, "/")
  console.log(`   ${rel}  <=  ${[...trail].reverse().join("  <=  ")}`)
}
process.exit(1)
