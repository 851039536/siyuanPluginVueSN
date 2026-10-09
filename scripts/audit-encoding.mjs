// 源文件编码规范检查脚本
// 用途：检测源文件中被写坏的中文（乱码），防止「脚本批量改写」类操作悄悄污染文件。
//
// 背景：PowerShell 的 Set-Content / Out-File / 重定向默认按系统 ANSI 代码页写盘，
//   会把中文注释与中文文案写成乱码；而破坏后 git diff 仍显示为可读的改动行数，
//   难以当场发现，直到 build 报 `invalid UTF-8 text` 或打包产物出现乱码才暴露。
//   规则见 AGENTS.md § 硬规则「禁止用脚本批量改写源文件」。
//
// 检测两类问题（对应两种破坏路径）：
//   1. invalid-utf8 —— 文件字节流不是合法 UTF-8（Build 会直接失败）
//   2. replacement-char —— 含 U+FFFD 替换字符（写盘时已发生不可逆替换）
//   3. mojibake —— 含典型乱码片段（如「鍏变韩」「锛」「鈥」），即 UTF-8 被按 GBK 解/编码的产物
//
// 用法：node scripts/audit-encoding.mjs [--json]
//   --json  以 JSON 输出，便于 CI 消费
// 退出码：0 = 无违规；1 = 存在违规（可用于 CI 门禁）；2 = 用法/环境错误
//
// 例外：package.json / pnpm-lock.yaml 等锁文件由包管理器生成，不纳入扫描。

import { globSync, readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")
const AS_JSON = process.argv.slice(2).includes("--json")

/** 扫描范围：手写源文件（含文档与样式），沿用仓库既有 glob 习惯 */
const GLOBS = [
  "src/**/*.{ts,vue,scss,json,md}",
  "scripts/**/*.{mjs,ts}",
  "docs/**/*.md",
  "*.md",
]

/** 排除：依赖、产物、包管理器生成物，以及本脚本自身（内含乱码样例字面量） */
const IGNORE = [
  /^node_modules\//,
  /^dist\//,
  /^\.git\//,
  /^pnpm-lock\.yaml$/,
  /^package\.json$/,
  /^\.codebuddy\//,
  /^scripts\/audit-encoding\.mjs$/,
]

const FFFD = "\uFFFD"

/**
 * 典型乱码片段（UTF-8 字节被按 Latin-1/GBK 解读的产物）。
 * 这些序列在正常中文技术文档里几乎不可能出现，命中即高置信度乱码。
 */
const MOJIBAKE_PATTERNS = [
  // 「共享」被写坏后的常见形态，本次事故的实际产物
  { re: /鍏变韩|鍏变/g, label: "GBK 误解码（如「共享」→「鍏变韩」）" },
  // UTF-8 标点被按 GBK 解读：。（）等的高频前缀
  { re: /锛|鈥|銆|锟斤拷/g, label: "GBK 误解码标点（锛/鈥/銆）" },
  // Latin-1 误解码：多个 Ã/Â 连排
  { re: /[ÃÂ][\u0080-\u00BF]/g, label: "Latin-1 误解码（Ã/Â 连排）" },
]

/** 判断 Buffer 是否为合法 UTF-8（不接受 BOM 之外的任何替代解码） */
function isValidUtf8(buf) {
  // Node 的 TextDecoder 默认以 U+FFFD 替换非法字节且不抛错（除非 fatal: true）
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf)
    return true
  } catch {
    return false
  }
}

/** 扫描单个文件，返回问题列表 */
function scanFile(absPath) {
  const rel = relative(ROOT, absPath).replaceAll("\\", "/")
  if (IGNORE.some((re) => re.test(rel))) return []

  const buf = readFileSync(absPath)
  const findings = []

  // 1. 非法 UTF-8 字节 —— build 会直接失败
  if (!isValidUtf8(buf)) {
    // 定位首个非法字节的行号，便于直接跳转
    const decoded = new TextDecoder("utf-8").decode(buf)
    const upToBad = decoded.split(FFFD)[0]
    findings.push({
      file: rel,
      line: upToBad.split("\n").length,
      kind: "invalid-utf8",
      detail: "字节流不是合法 UTF-8（构建将报 invalid UTF-8 text）",
    })
    // 非法字节已被替换为 U+FFFD，后续检查会重复命中，直接返回
    return findings
  }

  const text = buf.toString("utf8")
  const lines = text.split(/\r?\n/)

  lines.forEach((line, i) => {
    // 2. U+FFFD 替换字符 —— 不可逆的写坏痕迹
    if (line.includes(FFFD)) {
      findings.push({
        file: rel,
        line: i + 1,
        kind: "replacement-char",
        detail: "含 U+FFFD 替换字符（写盘时中文已被替换）",
      })
    }
    // 3. 典型乱码片段
    for (const { re, label } of MOJIBAKE_PATTERNS) {
      re.lastIndex = 0
      if (re.test(line)) {
        findings.push({
          file: rel,
          line: i + 1,
          kind: "mojibake",
          detail: label,
        })
        break
      }
    }
  })

  return findings
}

function main() {
  const files = [...new Set(GLOBS.flatMap((g) => globSync(g, { cwd: ROOT, absolute: true })))]
    .filter((f) => !IGNORE.some((re) => re.test(relative(ROOT, f).replaceAll("\\", "/"))))
    .sort()

  const all = files.flatMap(scanFile)
  const byFile = new Map()
  for (const f of all) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1)

  if (AS_JSON) {
    console.log(JSON.stringify({
      scannedFiles: files.length,
      totalFindings: all.length,
      affectedFiles: byFile.size,
      findings: all,
    }, null, 2))
    process.exit(all.length > 0 ? 1 : 0)
  }

  console.log("=".repeat(64))
  console.log("源文件编码规范检查（AGENTS.md § 硬规则）")
  console.log("=".repeat(64))
  console.log(`扫描文件：${files.length}`)
  console.log(`编码问题：${all.length} 处 / ${byFile.size} 个文件`)
  console.log("")

  if (all.length === 0) {
    console.log("✅ 全部源文件均为合法 UTF-8，未发现乱码或替换字符。")
    process.exit(0)
  }

  console.log("── 问题明细 ──")
  for (const f of all) {
    console.log(`  ${f.file}:${f.line}  [${f.kind}] ${f.detail}`)
  }
  console.log("")
  console.log("修复：用编辑工具（edit / write）重写为正确中文；不要用 Set-Content 等按 ANSI 写盘的命令。")
  console.log("      确需脚本处理时，显式以 New-Object System.Text.UTF8Encoding($false) 写盘。")
  console.log("      加 --json 获取机器可读明细。")

  process.exit(1)
}

main()
