// SCSS 规范审计脚本
// 用途：以思源主题变量快照为基准，扫描 src/**/*.scss 与 *.vue 内的 style 块，
//      按三轮优化（R1 冗余 / R2 结构 / R3 规范）输出可定位、可对比、可分级的清单。
// 依据：AGENTS_STYLE.md、docs/参考/siyuan-theme-vars.md、docs/completed/scss-review.md
//
// 用法：
//   node scripts/audit-scss.mjs                       全量扫描（默认仅 P0 阻塞退出码）
//   node scripts/audit-scss.mjs --only=r1,r3          只跑指定规则组
//   node scripts/audit-scss.mjs --json                机器可读输出
//   node scripts/audit-scss.mjs --fail-on=p0,p1       门禁：命中即退出码 1
//   node scripts/audit-scss.mjs --fail-on=none        纯报告
//   node scripts/audit-scss.mjs --write-baseline      冻结存量指纹（只降不升）
//   node scripts/audit-scss.mjs --changed             只扫 git 变更文件
//   node scripts/audit-scss.mjs --strict              含建议级噪声规则（如 fallback 检查）
//   node scripts/audit-scss.mjs --refresh-theme-vars <siyuan-install-dir>
//
// 退出码：0 = 通过；1 = 命中门禁级别；2 = 配置/环境错误

import { existsSync, globSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { join, relative, resolve } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")
const CONFIG_PATH = join(ROOT, "scripts/audit-scss.config.json")
const BASELINE_PATH = join(ROOT, "scripts/audit-scss.baseline.json")
const THEME_VARS_PATH = join(ROOT, "scripts/data/siyuan-theme-vars.json")

// ========== 规则表（ID 稳定，报告与基线均按此引用）==========
// level: P0 样式实际失效 / P1 违反强制规范 / P2 冗余与建议
const RULES = {
  "R1-commented-style": { group: "r1", level: "P2", desc: "注释中残留的样式块" },
  "R1-duplicate-decl": { group: "r1", level: "P1", desc: "同一规则块内属性重复声明" },
  "R1-duplicate-selector": { group: "r1", level: "P2", desc: "同一文件内选择器重复定义（同特异性覆盖需人工确认）" },
  "R1-empty-block": { group: "r1", level: "P2", desc: "空规则块" },
  "R1-important": { group: "r1", level: "P2", desc: "!important 覆盖" },
  "R1-debug-style": { group: "r1", level: "P1", desc: "调试用样式（纯色描边/背景）" },
  "R1-style-in-vue": { group: "r1", level: "P1", desc: "样式未外置（.vue 内联 style）" },
  "R1-unused-class": { group: "r1", level: "P2", desc: "类名未见引用（需人工确认）" },

  "R2-file-size": { group: "r2", level: "P2", desc: "样式文件超出体量阈值" },
  "R2-syntax-unbalanced": { group: "r2", level: "P0", desc: "花括号不平衡（编译会失败）" },
  "R2-deep-nesting": { group: "r2", level: "P2", desc: "选择器嵌套过深" },
  "R2-selector-list": { group: "r2", level: "P2", desc: "选择器列表过长（应提取复用）" },
  "R2-shared-pattern": { group: "r2", level: "P2", desc: "重复的遮罩/弹窗范式（应提取 mixin）" },

  "R3-hardcoded-color": { group: "r3", level: "P1", desc: "硬编码颜色值" },
  "R3-color-in-var-fallback": { group: "r3", level: "P2", desc: "fallback 内硬编码颜色" },
  "R3-hardcoded-font-size": { group: "r3", level: "P1", desc: "硬编码字号" },
  "R3-hardcoded-font-weight": { group: "r3", level: "P1", desc: "硬编码字重" },
  "R3-hardcoded-line-height": { group: "r3", level: "P1", desc: "硬编码行高" },
  "R3-hardcoded-radius": { group: "r3", level: "P1", desc: "硬编码圆角" },
  "R3-hardcoded-spacing": { group: "r3", level: "P1", desc: "硬编码间距" },
  "R3-font-size-over-base": { group: "r3", level: "P2", desc: "字号超过 16px 基准" },
  "R3-box-shadow": { group: "r3", level: "P2", desc: "非焦点/浮层的装饰性阴影" },
  "R3-backdrop-filter": { group: "r3", level: "P1", desc: "禁用毛玻璃效果" },
  "R3-transition-duration": { group: "r3", level: "P2", desc: "过渡时长偏离 0.12s" },
  "R3-z-index": { group: "r3", level: "P2", desc: "z-index 超出全局基准" },
  "R3-mobile-breakpoint": { group: "r3", level: "P1", desc: "移动端断点缺少粗指针兜底" },
  "R3-deep-in-nonscoped": { group: "r3", level: "P1", desc: "非 scoped 样式中的 :deep()" },
  "R3-theme-var-unknown": { group: "r3", level: "P1", desc: "引用了思源未定义的变量" },
  "R3-theme-var-no-fallback": { group: "r3", level: "P2", desc: "主题变量缺少 fallback" },
}

// ========== 硬编码 → Token 建议映射（与 AGENTS_STYLE.md 一致）==========
const FONT_SIZE_TOKEN = { 10: "$t-2xs", 12: "$t-xs", 14: "$t-sm", 16: "$t-base", 18: "$t-lg" }
const FONT_WEIGHT_TOKEN = { 300: "$fw-light", 400: "$fw-normal", 500: "$fw-medium", 600: "$fw-semibold", 700: "$fw-bold" }
const LINE_HEIGHT_TOKEN = { 1.25: "$lh-tight", 1.5: "$lh-normal", 1.75: "$lh-relaxed" }
const RADIUS_TOKEN = { 2: "$r-px2", 3: "$r-px3", 4: "$r-sm", 6: "$r-base", 8: "$r-md", 12: "$r-lg", 9999: "$r-full" }
const SPACING_TOKEN = {
  2: "$s-px2",
  3: "$s-px3",
  4: "$s-1",
  8: "$s-2",
  12: "$s-3",
  16: "$s-4",
  20: "$s-5",
  24: "$s-6",
  32: "$s-8",
  40: "$s-10",
  48: "$s-12",
  64: "$s-16",
}

const SPACING_PROPS = new Set([
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "gap",
  "row-gap",
  "column-gap",
])

const DEFAULT_CONFIG = {
  thresholds: {
    maxFileLines: 500,
    maxFileBytes: 12288,
    maxNestingDepth: 4,
    maxSelectorItems: 6,
    minUnusedClassLength: 5,
  },
  rules: {},
  whitelist: [],
  ignore: [],
}

// ========== 参数解析 ==========
function parseArgs(argv) {
  const opts = {
    only: null,
    json: false,
    failOn: ["p0"],
    writeBaseline: false,
    noBaseline: false,
    changed: false,
    strict: false,
    limit: 20,
    themeVars: THEME_VARS_PATH,
    refresh: null,
    version: null,
  }
  for (const arg of argv) {
    if (arg === "--json") opts.json = true
    else if (arg === "--write-baseline") opts.writeBaseline = true
    else if (arg === "--no-baseline") opts.noBaseline = true
    else if (arg === "--changed") opts.changed = true
    else if (arg === "--strict") opts.strict = true
    else if (arg.startsWith("--only=")) opts.only = arg.slice(7).split(",").map(s => s.trim().toLowerCase())
    else if (arg.startsWith("--fail-on=")) {
      const raw = arg.slice(10).trim().toLowerCase()
      opts.failOn = raw === "none" ? [] : raw.split(",").map(s => s.trim()).filter(Boolean)
    } else if (arg.startsWith("--limit=")) opts.limit = Number(arg.slice(8)) || 0
    else if (arg.startsWith("--theme-vars=")) opts.themeVars = resolve(ROOT, arg.slice(14))
    else if (arg.startsWith("--refresh-theme-vars=")) opts.refresh = arg.slice(21).replace(/^"|"$/g, "")
    else if (arg.startsWith("--siyuan-version=")) opts.version = arg.slice(17)
  }
  const idx = argv.indexOf("--refresh-theme-vars")
  if (idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith("--")) opts.refresh = argv[idx + 1]
  return opts
}

// ========== 通用工具 ==========
function toPosix(p) {
  return p.split("\\").join("/")
}

function rel(file) {
  return toPosix(relative(ROOT, file))
}

function normalizeSnippet(text) {
  return text.replace(/\s+/g, " ").trim()
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")
  return new RegExp(`^${escaped}$`)
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    console.error(`[audit-scss] 无法解析 ${rel(path)}：${error.message}`)
    process.exit(2)
  }
}

function suggestionFor(map, value) {
  const num = Number.parseFloat(value)
  if (Number.isNaN(num)) return null
  return map[num] ?? null
}

// ========== 注释剥离 ==========
// 返回剥离块注释后的行数组与注释片段（用于检测「注释掉的样式块」）
function stripComments(text) {
  const lines = text.split(/\r?\n/)
  const kept = []
  const comments = []
  let inComment = false
  let buffer = []
  let startLine = 0
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    let out = ""
    let guard = 0
    while (guard++ < 50) {
      if (inComment) {
        const end = line.indexOf("*/")
        if (end === -1) {
          buffer.push(line)
          line = ""
          break
        }
        buffer.push(line.slice(0, end))
        comments.push({ line: startLine, body: buffer.join("\n") })
        inComment = false
        buffer = []
        line = line.slice(end + 2)
        continue
      }
      const start = line.indexOf("/*")
      if (start === -1) {
        out += line
        break
      }
      out += line.slice(0, start)
      const end = line.indexOf("*/", start + 2)
      if (end === -1) {
        inComment = true
        startLine = i + 1
        buffer = [line.slice(start + 2)]
        line = ""
        break
      }
      comments.push({ line: i + 1, body: line.slice(start + 2, end) })
      line = line.slice(end + 2)
    }
    kept.push(out)
  }
  if (inComment) comments.push({ line: startLine, body: buffer.join("\n") })
  return { lines: kept, comments }
}

function stripInlineComment(line) {
  const idx = line.indexOf("//")
  if (idx === -1) return line
  const prev = line[idx - 1]
  // 保留 url(http://...) 与引号内的 // 片段
  if (prev === ":" || prev === "\"" || prev === "'") return line
  return line.slice(0, idx)
}

// 把 `#{...}` 插值替换为等长占位，便于用下标定位真正的块括号
function maskInterpolation(text) {
  return text.replace(/#\{[^{}]*\}/g, m => `#${"_".repeat(m.length - 1)}`)
}

// 只有指令语句、没有声明与子块的块（如纯 @include）不算空块
const AT_STATEMENT_RE = /^@(include|extend|content|if|else|each|for|while|return|debug|warn|error|use|forward|import|mixin|function)\b/

// ========== 收集器 ==========
function createCollector({ file, matchesWhitelist }) {
  const issues = []
  const push = (issue) => {
    if (!issue) return false
    if (matchesWhitelist(issue)) return false
    issues.push(issue)
    return true
  }
  const makeIssue = (ruleId, line, snippet, suggestion, levelOverride) => {
    const rule = RULES[ruleId]
    return {
      ruleId,
      level: levelOverride ?? rule.level,
      file,
      line,
      snippet: normalizeSnippet(snippet),
      suggestion,
      message: rule.desc,
      fingerprint: `${ruleId}|${file}|${normalizeSnippet(snippet)}`,
    }
  }
  return { file, issues, push, makeIssue }
}

// ========== 声明级检查 ==========
const COLOR_MATCH_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[^)]*\)|\bhsla?\(\s*[^)]*\)/g
const COLOR_TEST_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[^)]*\)|\bhsla?\(\s*[^)]*\)/
const VAR_RE = /var\(\s*(--[\w-]+)\s*(,[^)]*)?\)/g

function classifyDeclaration(ctx, prop, value, line) {
  const emitted = new Set()
  const emit = (ruleId, suggestion, levelOverride) => {
    if (emitted.has(ruleId)) return
    const issue = ctx.makeIssue(ruleId, line, `${prop}: ${value}`, suggestion, levelOverride)
    if (ctx.push(issue)) emitted.add(ruleId)
  }

  // 颜色：var() 内的 fallback 单独降级处理，先剔除；
  // CSS 相对颜色语法 rgb(from …) / hsl(from …) 是「由主题色派生」，不是硬编码，整段剔除
  const colorFree = value
    .replace(/\b(?:rgb|hsl)a?\(\s*from\b[^)]*\)/g, "RELPAL")
    .replace(/var\([^)]*\)/g, "VAR")
  for (const color of colorFree.match(COLOR_MATCH_RE) ?? []) {
    // rgba($token, α) / rgba(stats.$token, α) 是「Token + 透明度」，不是硬编码
    const isLiteral = color.startsWith("#") || /^rgba?\(\s*\d/i.test(color) || /^hsla?\(\s*\d/i.test(color)
    if (!isLiteral) continue
    const compact = color.replace(/\s+/g, "")
    const isMask = prop === "background" && /^rgba?\(0,0,0,0?\.5\)$/i.test(compact)
    if (isMask) continue
    emit("R3-hardcoded-color", "改用 $c-* Token 或 var(--b3-*) 主题变量")
  }

  for (const m of value.matchAll(/var\(\s*--[\w-]+\s*,\s*([^)]*)\)/g)) {
    if (COLOR_TEST_RE.test(m[1])) emit("R3-color-in-var-fallback", "fallback 改用对应 $c-* Token")
  }

  if (prop === "font-size") {
    const m = value.match(/^(\d+(?:\.\d+)?)px$/)
    if (m) {
      const token = suggestionFor(FONT_SIZE_TOKEN, m[1])
      // 无对应档位（如图表数据 8px / 40px）降为 P2：属于「需新增 Token 或注释说明」而非强制违规
      emit("R3-hardcoded-font-size", token ? `改用 ${token}` : "无对应档位：取最近档位或新增 Token 并注释", token ? undefined : "P2")
      if (Number.parseFloat(m[1]) > 16) emit("R3-font-size-over-base", "标题字号上限为 $t-base（16px）")
    }
  }

  if (prop === "font-weight") {
    const token = FONT_WEIGHT_TOKEN[Number(value)]
    if (token) emit("R3-hardcoded-font-weight", `改用 ${token}`)
  }

  if (prop === "line-height") {
    const token = LINE_HEIGHT_TOKEN[Number(value)]
    if (token) emit("R3-hardcoded-line-height", `改用 ${token}`)
  }

  if (prop === "border-radius" && !value.includes("$") && !value.includes("var(") && !value.includes("%")) {
    const m = value.match(/^(\d+(?:\.\d+)?)px$/)
    if (m && m[1] !== "0") {
      const token = suggestionFor(RADIUS_TOKEN, m[1])
      emit("R3-hardcoded-radius", token ? `改用 ${token}` : "无对应档位：取最近档位或新增 Token 并注释", token ? undefined : "P2")
    }
  }

  if (SPACING_PROPS.has(prop) && /(^|\s)-?\d+(\.\d+)?px/.test(value)) {
    const skip = value.includes("$") || value.includes("var(") || value.includes("calc(") || value.includes("env(") || value.includes("%") || /^(0|auto|inherit|initial|unset)$/.test(value.trim())
    if (!skip) {
      const suggested = value.replace(/(-?\d+(?:\.\d+)?)px/g, (raw, num) => {
        const sign = raw.startsWith("-") ? "-" : ""
        return sign + (SPACING_TOKEN[Number(num)] ?? raw.replace("-", ""))
      })
      // 值本身已无法映射（建议里仍是原始 px）时降为 P2
      emit("R3-hardcoded-spacing", `改用 Token：${suggested}`, suggested === value ? "P2" : undefined)
    }
  }

  if (prop === "box-shadow" && value !== "none" && !/focus|tooltip|active|--b3/i.test(`${ctx.selector} ${value}`)) {
    emit("R3-box-shadow", "卡片/弹窗用边框表达层级，禁用装饰性阴影")
  }

  if (prop === "backdrop-filter" || prop === "-webkit-backdrop-filter") {
    emit("R3-backdrop-filter", "移除毛玻璃，遮罩统一 rgba(0,0,0,0.5)")
  }

  if (prop === "transition" || prop === "transition-duration") {
    for (const d of value.matchAll(/(\d*\.?\d+)(ms|s)\b/g)) {
      const seconds = d[2] === "ms" ? Number(d[1]) / 1000 : Number(d[1])
      if (Math.abs(seconds - 0.12) < 0.0001) continue
      if (/spin|rotate|infinite/i.test(value) || /spin|skeleton|loader/i.test(ctx.selector)) continue
      emit("R3-transition-duration", "统一 0.12s")
    }
  }

  if (prop === "z-index") {
    const num = Number(value)
    // 允许区间：0–11000（遮罩 10000 + 子弹窗/浮层 10001–11000），以及 -1（伪元素背景层）
    if (!Number.isNaN(num) && (num > 11000 || (num < 0 && num !== -1))) {
      emit("R3-z-index", "全屏遮罩基准 10000，子级叠加上限 11000；禁止 99999/100000 这类历史值")
    }
  }

  if (value.includes("!important")) emit("R1-important", "改用更高特异性的选择器或组件变体")

  if (/^(red|blue|lime|magenta|cyan|yellow)$/i.test(value.trim()) || /^1px\s+solid\s+(red|blue|lime|magenta|cyan)$/i.test(value.trim())) {
    emit("R1-debug-style", "删除调试样式")
  }

  checkThemeVars(ctx, value, line, prop)
}

function checkThemeVars(ctx, value, line, prop) {
  if (!ctx.validVars) return
  for (const m of value.matchAll(VAR_RE)) {
    const name = m[1]
    // 只校验思源主题变量；--vp-* / --si-* / --btn-* 等是插件自定义属性
    if (!name.startsWith("--b3-")) continue
    if (name.endsWith("-")) continue
    const fallback = (m[2] ?? "").slice(1).trim()
    const hasFallback = fallback.length > 0
    if (!ctx.validVars.has(name)) {
      const issue = ctx.makeIssue(
        "R3-theme-var-unknown",
        line,
        `${prop}: ${name}`,
        hasFallback
          ? `变量在思源 ${ctx.themeVersion} 中不存在，fallback 与主题脱节，改用有效变量`
          : `变量不存在且无 fallback，样式实际失效，改用有效变量或补 fallback`,
        hasFallback ? "P1" : "P0",
      )
      ctx.push(issue)
    } else if (!hasFallback && ctx.strict) {
      ctx.push(ctx.makeIssue("R3-theme-var-no-fallback", line, `${prop}: ${name}`, "建议补 fallback：var(--b3-x, #{$c-*})", "P2"))
    }
  }
}

// ========== SCSS 结构扫描 ==========
function scanScss(text, file, scanCtx) {
  const { config, matchesWhitelist } = scanCtx
  const thresholds = config.thresholds ?? DEFAULT_CONFIG.thresholds
  const collector = createCollector({ file, matchesWhitelist })
  const ctx = { ...collector, validVars: scanCtx.validVars, themeVersion: scanCtx.themeVersion, strict: scanCtx.strict, selector: "" }

  const { lines, comments } = stripComments(text)
  const stack = []
  const blockSignatures = new Map()
  const classDefs = new Map()

  for (const c of comments) {
    if (/\{[^{}]*:[^{}]*\}/.test(c.body) && !/^\s*(@|使用|示例|用法)/.test(c.body.trim())) {
      collector.push(collector.makeIssue("R1-commented-style", c.line, normalizeSnippet(c.body).slice(0, 80), "删除注释中的样式块，历史交给 git"))
    }
  }

  const currentKey = () => stack.map(s => s.text).join(" >> ")
  const selDepth = () => stack.filter(s => s.kind === "sel").length

  const openBlock = (head, line) => {
    const isAt = head.startsWith("@")
    const node = { kind: isAt ? "at" : "sel", text: head, line, decls: [], hasChild: false, hasStatement: false }
    if (stack.length > 0) stack[stack.length - 1].hasChild = true
    if (!isAt) {
      node.key = `${currentKey()} >> ${normalizeSnippet(head)}`
      const depth = selDepth() + 1
      if (depth > thresholds.maxNestingDepth) {
        collector.push(collector.makeIssue("R2-deep-nesting", line, `深度 ${depth}：${normalizeSnippet(head).slice(0, 60)}`, `嵌套上限 ${thresholds.maxNestingDepth} 层，扁平化或用 mixin`))
      }
      const items = head.split(",").length
      if (items > thresholds.maxSelectorItems) {
        collector.push(collector.makeIssue("R2-selector-list", line, `选择器 ${items} 项`, "选择器列表过长，提取公共状态类"))
      }
      for (const m of head.matchAll(/\.([A-Za-z][\w-]*)/g)) {
        const name = m[1]
        if (name.startsWith("b3-") || name.startsWith("protyle") || name.startsWith("vditor")) continue
        if (!classDefs.has(name)) classDefs.set(name, { file, line })
      }
    }
    stack.push(node)
  }

  const closeBlock = () => {
    const node = stack.pop()
    if (!node || node.kind !== "sel") return
    const parent = stack[stack.length - 1]
    if (parent && parent.kind === "sel") parent.hasChild = true
    if (node.decls.length === 0 && !node.hasChild && !node.hasStatement) {
      collector.push(collector.makeIssue("R1-empty-block", node.line, normalizeSnippet(node.text).slice(0, 60), "删除空规则块"))
    }
    // 只有「声明集完全相同」才算冗余；分段覆盖（先共性后差异）是合法写法
    if (node.key) {
      const sig = node.decls.map(d => `${d.prop}:${d.value}`).sort().join(";")
      const list = blockSignatures.get(node.key) ?? []
      list.push({ line: node.line, sig })
      blockSignatures.set(node.key, list)
    }
    const map = new Map(node.decls.map(d => [d.prop, d.value]))
    const insetOk = /^0(\s+0)*$/.test(map.get("inset") ?? "")
    const edgeOk = ["top", "left", "right", "bottom"].every(p => map.get(p) === "0")
    const isOverlay = map.get("position") === "fixed" &&
      (insetOk || edgeOk) &&
      map.get("align-items") === "center" &&
      map.get("justify-content") === "center"
    if (isOverlay && /overlay|mask|modal|dialog|backdrop/i.test(node.text)) {
      collector.push(collector.makeIssue("R2-shared-pattern", node.line, normalizeSnippet(node.text).slice(0, 60), "与 kit/mixins.scss 的遮罩范式重复，提取共享 mixin"))
    }
  }

  const parseDecl = (raw) => {
    const text2 = raw.trim()
    if (!text2) return null
    const colon = text2.indexOf(":")
    if (colon === -1) return null
    const prop = text2.slice(0, colon).trim()
    let value = text2.slice(colon + 1).trim()
    if (value.endsWith(";")) value = value.slice(0, -1).trim()
    if (!prop || prop.startsWith("@")) return null
    // 自定义属性与局部变量：是合法块内容，但不参与硬编码规则
    if (prop.startsWith("--") || prop.startsWith("$")) return { prop, value, custom: true }
    if (!/^[a-z-]+$/i.test(prop)) return null
    if (!value) return null
    return { prop, value, custom: false }
  }

  const applyDecl = (decl, line) => {
    const top = stack[stack.length - 1]
    if (!top || top.kind !== "sel") return
    const dup = top.decls.find(d => d.prop === decl.prop)
    if (decl.custom) {
      if (dup) {
        collector.push(collector.makeIssue("R1-duplicate-decl", line, `${decl.prop}: ${decl.value}`, `第 ${dup.line} 行已声明 ${decl.prop}，后者会覆盖前者`))
      }
      top.decls.push({ prop: decl.prop, value: decl.value, line })
      return
    }
    if (dup) {
      collector.push(collector.makeIssue("R1-duplicate-decl", line, `${decl.prop}: ${decl.value}`, `第 ${dup.line} 行已声明 ${decl.prop}，后者会覆盖前者`))
    }
    top.decls.push({ prop: decl.prop, value: decl.value, line })
    ctx.selector = `${top.text} ${decl.prop}`
    classifyDeclaration(ctx, decl.prop, decl.value, line)
  }

  for (let i = 0; i < lines.length; i++) {
    let rest = stripInlineComment(lines[i]).trim()
    if (!rest) continue
    const lineNo = i + 1

    let guard = 0
    while (rest.startsWith("}") && guard++ < 50) {
      if (stack.length === 0) {
        collector.push(collector.makeIssue("R2-syntax-unbalanced", lineNo, "多余的 }", "花括号不平衡：检查最近的块删除是否连带删掉了选择器列表项"))
        rest = rest.slice(1).trim()
        continue
      }
      closeBlock()
      rest = rest.slice(1).trim()
    }
    if (!rest) continue

    if (rest.startsWith("@media") && rest.includes("max-width: $bp-mobile") && !rest.includes("pointer: coarse")) {
      collector.push(collector.makeIssue("R3-mobile-breakpoint", lineNo, rest.slice(0, 80), "改用 @include mobile（自带 (pointer: coarse) and (hover: none) 兜底）"))
    }

    // mixin 参数里的变量名字符串会被拼进 var()，静态声明扫描看不到，需单独校验
    if (ctx.validVars) {
      for (const m of rest.matchAll(/["'](--b3-[\w-]+)["']/g)) {
        if (!ctx.validVars.has(m[1])) {
          collector.push(collector.makeIssue("R3-theme-var-unknown", lineNo, `mixin 参数: ${m[1]}`, `变量在思源 ${ctx.themeVersion} 中不存在（mixin 会把它拼进 var()），改用有效变量`, "P1"))
        }
      }
    }

    // 声明行优先：`--x: #{$v};` 这类插值会让 `{` 被误判为块开括号
    const withoutInterpolation = rest.replace(/#\{[^{}]*\}/g, "X")
    const isDeclLike = /^[a-z-]+\s*:/i.test(rest) && !withoutInterpolation.includes("{")
    if (isDeclLike) {
      const decl = parseDecl(rest)
      if (decl) applyDecl(decl, lineNo)
      continue
    }

    // 纯语句（@include / @extend / @content 等）只标记块内容；
    // @mixin / @function / @if 等带 `{` 的指令必须继续走块解析，否则内部选择器会并入父级路径
    if (AT_STATEMENT_RE.test(rest) && !rest.includes("{")) {
      const top = stack[stack.length - 1]
      if (top) top.hasStatement = true
      continue
    }

    const masked = maskInterpolation(rest)
    const braceIdx = masked.indexOf("{")
    if (braceIdx !== -1) {
      const head = rest.slice(0, braceIdx).trim()
      const tail = rest.slice(braceIdx + 1)
      const closeIdx = masked.slice(braceIdx + 1).indexOf("}")
      if (closeIdx === -1) {
        if (head) openBlock(head, lineNo)
        continue
      }
      // 单行闭合块：head { a: b; c: d; }
      if (head) openBlock(head, lineNo)
      for (const part of tail.slice(0, closeIdx).split(";")) {
        const decl = parseDecl(part)
        if (decl) applyDecl(decl, lineNo)
      }
      closeBlock()
      continue
    }

    const decl = parseDecl(rest)
    if (decl) applyDecl(decl, lineNo)
  }
  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1]
    collector.push(collector.makeIssue("R2-syntax-unbalanced", unclosed.line, `未闭合：${normalizeSnippet(unclosed.text).slice(0, 40)}`, "缺少 }，SCSS 编译会失败"))
  }
  while (stack.length > 0) closeBlock()

  for (const [key, list] of blockSignatures) {
    if (list.length < 2) continue
    const seen = new Map()
    for (const item of list) {
      if (!item.sig) continue
      if (seen.has(item.sig)) {
        const prevLine = seen.get(item.sig)
        collector.push(collector.makeIssue("R1-duplicate-selector", item.line, key.split(" >> ").pop(), `与第 ${prevLine} 行声明完全相同，删除后者`))
      } else {
        seen.set(item.sig, item.line)
      }
    }
  }

  const lineCount = text.split(/\r?\n/).length
  const byteCount = Buffer.byteLength(text, "utf8")
  if (lineCount > thresholds.maxFileLines || byteCount > thresholds.maxFileBytes) {
    collector.push(collector.makeIssue("R2-file-size", 1, `${lineCount} 行 / ${Math.round(byteCount / 1024)}KB`, `拆分至 ${thresholds.maxFileLines} 行或 ${Math.round(thresholds.maxFileBytes / 1024)}KB 以内`))
  }

  return { issues: collector.issues, classDefs }
}

// ========== .vue 内联样式 ==========
function scanVue(text, file, scanCtx) {
  const issues = []
  // 屏蔽 <script> 区域：其中模板字符串可能含 `<style>...</style>`（如 iframe srcdoc 常量），
  // 用等长空白替换以保持索引与行号不变
  const masked = text.replace(/<script[\s\S]*?<\/script>/gi, m => m.replace(/[^\n]/g, " "))
  const styleRe = /<style([^>]*)>([\s\S]*?)<\/style>/g
  for (const m of masked.matchAll(styleRe)) {
    const attrs = m[1] ?? ""
    const rawBlock = text.slice(m.index, m.index + m[0].length)
    const body = rawBlock.replace(/^<style[^>]*>/, "").replace(/<\/style>\s*$/, "")
    if (!body.trim()) continue
    // 纯 `@use` 桥接块（允许带注释）：样式实体已外置到 styles/*.scss，属规范写法
    const bridged = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      .replace(/@(?:use|import|forward)\s+[^;]+;/g, "")
      .trim()
    if (!bridged) continue
    const startLine = text.slice(0, m.index).split("\n").length
    const collector = createCollector({ file, matchesWhitelist: scanCtx.matchesWhitelist })
    collector.push(collector.makeIssue("R1-style-in-vue", startLine, `<style${attrs}>`, "样式必须外置到 styles/*.scss（AGENTS_STYLE.md）"))
    const nested = scanScss(body, file, scanCtx)
    for (const issue of nested.issues) issues.push({ ...issue, line: issue.line + startLine - 1 })
    if (/:deep\(/.test(body) && !/\bscoped\b/.test(attrs)) {
      collector.push(collector.makeIssue("R3-deep-in-nonscoped", startLine, ":deep(", "非 scoped 样式里 :deep() 会原样进产物，直接写后代选择器"))
    }
    issues.push(...collector.issues)
  }
  return issues
}

// ========== 未引用类名 ==========
function collectUnusedClassIssues(definedClasses, scanCtx) {
  const { config, matchesWhitelist } = scanCtx
  const thresholds = config.thresholds ?? DEFAULT_CONFIG.thresholds
  const minLen = thresholds.minUnusedClassLength ?? 5
  // Vue <Transition> 的 enter/leave 类名由运行时注入，不可能在源码中被引用
  const TRANSITION_CLASS_RE = /(?:enter|leave)(?:-active|-from|-to)?$/
  const candidates = [...definedClasses.keys()].filter(name =>
    name.length >= minLen &&
    !name.includes("__") &&
    !name.includes("--") &&
    !TRANSITION_CLASS_RE.test(name),
  )
  if (candidates.length === 0) return []

  const candidateSet = new Set(candidates)
  const used = new Set()
  let corpus = ""
  for (const abs of globSync("src/**/*.{vue,ts}", { cwd: ROOT, absolute: true })) {
    const text = readFileSync(abs, "utf8")
    corpus += `${text}\n`
    for (const m of text.matchAll(/[A-Za-z][\w-]*/g)) {
      if (candidateSet.has(m[0])) used.add(m[0])
    }
  }

  const issues = []
  for (const name of candidates) {
    if (used.has(name)) continue
    const prefix = name.replace(/[-_][^-_]+$/, "")
    if (prefix.length >= 4 && corpus.includes(prefix)) continue
    // 模板字符串拼接（如 `is-${granularity}` → is-week）：前缀通常很短，需单独识别
    if (corpus.includes(`\`${prefix}-$\{`)) continue
    const meta = definedClasses.get(name)
    const collector = createCollector({ file: meta.file, matchesWhitelist })
    collector.push(collector.makeIssue("R1-unused-class", meta.line, `.${name}`, "未见引用：确认非动态拼接后删除"))
    issues.push(...collector.issues)
  }
  return issues
}

// ========== 白名单 ==========
function buildWhitelistMatcher(config) {
  const entries = (config.whitelist ?? []).map(entry => ({
    rule: entry.rule,
    files: (entry.files ?? []).map(globToRegExp),
    patterns: (entry.patterns ?? []).map(p => new RegExp(p)),
    reason: entry.reason ?? "",
  }))
  return issue => entries.some(entry =>
    (!entry.rule || entry.rule === issue.ruleId) &&
    (entry.files.length === 0 || entry.files.some(re => re.test(issue.file))) &&
    (entry.patterns.length === 0 || entry.patterns.some(re => re.test(issue.snippet))),
  )
}

// ========== 主题变量快照 ==========
function loadThemeVars(opts) {
  const data = readJson(opts.themeVars, null)
  if (!data || !Array.isArray(data.valid)) {
    console.warn(`[audit-scss] 未找到主题变量快照 ${rel(opts.themeVars)}，跳过 R3-theme-var-* 规则`)
    return { validVars: null, themeVersion: "unknown" }
  }
  return { validVars: new Set(data.valid), themeVersion: data.version ?? "unknown" }
}

function parseThemeFile(file) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/)
  const root = {}
  const lang = {}
  let cur = null
  for (const raw of lines) {
    const t = raw.trim()
    if (/^:root\s*\{/.test(t)) {
      cur = root
      continue
    }
    const lm = t.match(/^:root:lang\(([\w-]+)\)\s*\{/)
    if (lm) {
      lang[lm[1]] ??= {}
      cur = lang[lm[1]]
      continue
    }
    if (t === "}") {
      cur = null
      continue
    }
    const vm = t.match(/^(--b3-[\w-]+)\s*:\s*(.+?);$/)
    if (cur && vm) cur[vm[1]] = vm[2].trim()
  }
  return { root, lang }
}

function resolveResourcesDir(input) {
  for (const dir of [input, join(input, "resources")]) {
    if (existsSync(join(dir, "appearance/themes/daylight/theme.css"))) return dir
  }
  throw new Error(`未在 ${input} 下找到 appearance/themes/daylight/theme.css，请传入思源安装目录或其 resources 目录`)
}

function refreshThemeVars(input, versionOverride) {
  const resources = resolveResourcesDir(input)
  const daylight = parseThemeFile(join(resources, "appearance/themes/daylight/theme.css"))
  const midnight = parseThemeFile(join(resources, "appearance/themes/midnight/theme.css"))

  const appDir = join(resources, "stage/build/app")
  const base = {}
  let baseFile = ""
  if (existsSync(appDir)) {
    baseFile = readdirSync(appDir).find(f => f.startsWith("base.") && f.endsWith(".css")) ?? ""
    if (baseFile) {
      const css = readFileSync(join(appDir, baseFile), "utf8")
      for (const m of css.matchAll(/(--b3-[\w-]+)\s*:\s*([^;}]+)/g)) {
        if (!(m[1] in base)) base[m[1]] = m[2].trim()
      }
    }
  }

  let version = versionOverride
  if (!version) {
    const pkgPath = join(resources, "app/package.json")
    if (existsSync(pkgPath)) {
      try {
        version = JSON.parse(readFileSync(pkgPath, "utf8")).version
      } catch {}
    }
  }

  const valid = [...new Set([...Object.keys(daylight.root), ...Object.keys(midnight.root), ...Object.keys(base)])].sort()
  const out = {
    version: version ?? "unknown",
    collectedAt: new Date().toISOString().slice(0, 10),
    source: {
      theme: "SiYuan install: resources/appearance/themes/{daylight,midnight}/theme.css",
      base: baseFile ? `SiYuan install: resources/stage/build/app/${baseFile}` : "SiYuan install: resources/stage/build/app/base.*.css",
      note: "Regenerate with: node scripts/audit-scss.mjs --refresh-theme-vars <siyuan-install-dir>",
    },
    counts: { light: Object.keys(daylight.root).length, dark: Object.keys(midnight.root).length, base: Object.keys(base).length, valid: valid.length },
    light: daylight.root,
    dark: midnight.root,
    langOverrides: { light: daylight.lang, dark: midnight.lang },
    base,
    valid,
  }
  writeFileSync(THEME_VARS_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8")
  console.log(`[audit-scss] 已更新 ${rel(THEME_VARS_PATH)}`)
  console.log(`  version=${out.version} light=${out.counts.light} dark=${out.counts.dark} base=${out.counts.base} valid=${out.counts.valid}`)
}

// ========== 变更文件过滤 ==========
function changedFiles() {
  try {
    const out = execSync("git status --porcelain", { cwd: ROOT, encoding: "utf8" })
    return out.split(/\r?\n/).filter(Boolean).map(line => line.slice(3).trim().replace(/^"|"$/g, "")).map(toPosix)
  } catch {
    return null
  }
}

// ========== 输出 ==========
function summarize(issues) {
  const byLevel = { P0: 0, P1: 0, P2: 0 }
  const byRule = new Map()
  const byFile = new Map()
  for (const issue of issues) {
    byLevel[issue.level] = (byLevel[issue.level] ?? 0) + 1
    byRule.set(issue.ruleId, (byRule.get(issue.ruleId) ?? 0) + 1)
    byFile.set(issue.file, (byFile.get(issue.file) ?? 0) + 1)
  }
  return { byLevel, byRule, byFile }
}

function printReport({ scanned, issues, fresh, baselineInfo, limit }) {
  const { byLevel, byRule, byFile } = summarize(issues)
  console.log("=".repeat(72))
  console.log("SCSS 规范审计（R1 冗余 / R2 结构 / R3 规范）")
  console.log("=".repeat(72))
  console.log(`扫描：${scanned.scss} 个 .scss + ${scanned.vue} 个 .vue`)
  console.log(`问题：P0 ${byLevel.P0} / P1 ${byLevel.P1} / P2 ${byLevel.P2}（共 ${issues.length}）`)
  if (baselineInfo) console.log(`基线：${baselineInfo.total} 条存量，本轮新增 ${fresh.length} 条`)
  console.log("")

  const order = { P0: 0, P1: 1, P2: 2 }
  const sorted = [...issues].sort((a, b) => (order[a.level] - order[b.level]) || a.file.localeCompare(b.file) || a.line - b.line)
  for (const level of ["P0", "P1", "P2"]) {
    const list = sorted.filter(i => i.level === level)
    if (list.length === 0) continue
    console.log(`── ${level}（${list.length}）──`)
    const shown = limit > 0 ? list.slice(0, limit) : list
    for (const issue of shown) {
      console.log(`  ${issue.file}:${issue.line}  ${issue.ruleId}  ${issue.snippet}`)
      console.log(`      → ${issue.suggestion}`)
    }
    if (shown.length < list.length) console.log(`  … 其余 ${list.length - shown.length} 条用 --json 或 --limit=0 查看`)
    console.log("")
  }

  console.log("── 按规则 ──")
  for (const [ruleId, count] of [...byRule].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${ruleId.padEnd(28)} ${RULES[ruleId]?.desc ?? ""}`)
  }
  console.log("")
  console.log("── 按文件 TOP 15 ──")
  for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(count).padStart(5)}  ${file}`)
  }
  console.log("")
}

// ========== 主流程 ==========
function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.refresh) {
    try {
      refreshThemeVars(opts.refresh, opts.version)
      process.exit(0)
    } catch (error) {
      console.error(`[audit-scss] ${error.message}`)
      process.exit(2)
    }
  }

  const config = { ...DEFAULT_CONFIG, ...readJson(CONFIG_PATH, {}) }
  config.thresholds = { ...DEFAULT_CONFIG.thresholds, ...(config.thresholds ?? {}) }
  const matchesWhitelist = buildWhitelistMatcher(config)

  const disabled = new Set(Object.entries(config.rules ?? {}).filter(([, v]) => v && v.enabled === false).map(([k]) => k))
  const ruleGroups = new Set(opts.only ?? ["r1", "r2", "r3"])
  const isRuleEnabled = (ruleId) => {
    const rule = RULES[ruleId]
    if (!rule || !ruleGroups.has(rule.group)) return false
    return !disabled.has(ruleId)
  }

  const { validVars, themeVersion } = loadThemeVars(opts)
  const scanCtx = { config, strict: opts.strict, validVars, themeVersion, matchesWhitelist }

  const ignoreRes = (config.ignore ?? []).map(globToRegExp)
  const ignored = path => ignoreRes.some(re => re.test(path))

  let scssFiles = globSync("src/**/*.scss", { cwd: ROOT, absolute: true }).filter(f => !ignored(rel(f)))
  let vueFiles = globSync("src/**/*.vue", { cwd: ROOT, absolute: true }).filter(f => !ignored(rel(f)))

  const changed = opts.changed ? changedFiles() : null
  if (changed) {
    scssFiles = scssFiles.filter(f => changed.includes(rel(f)))
    vueFiles = vueFiles.filter(f => changed.includes(rel(f)))
  }

  const issues = []
  const definedClasses = new Map()
  for (const abs of scssFiles) {
    const file = rel(abs)
    const result = scanScss(readFileSync(abs, "utf8"), file, scanCtx)
    for (const issue of result.issues) {
      if (isRuleEnabled(issue.ruleId)) issues.push(issue)
    }
    for (const [name, meta] of result.classDefs) {
      if (!definedClasses.has(name)) definedClasses.set(name, meta)
    }
  }

  if (isRuleEnabled("R1-style-in-vue")) {
    for (const abs of vueFiles) {
      const file = rel(abs)
      for (const issue of scanVue(readFileSync(abs, "utf8"), file, scanCtx)) {
        if (isRuleEnabled(issue.ruleId)) issues.push(issue)
      }
    }
  }

  if (isRuleEnabled("R1-unused-class")) {
    for (const issue of collectUnusedClassIssues(definedClasses, scanCtx)) issues.push(issue)
  }

  // 基线比对：只对「基线之外的新增」执行门禁
  let baselineInfo = null
  let fresh = issues
  if (!opts.noBaseline && existsSync(BASELINE_PATH)) {
    const baseline = readJson(BASELINE_PATH, { fingerprints: [] })
    const known = new Set(baseline.fingerprints ?? [])
    fresh = issues.filter(i => !known.has(i.fingerprint))
    baselineInfo = { total: known.size }
  }

  const failLevels = new Set(opts.failOn.map(l => l.toUpperCase()))
  const failed = fresh.filter(i => failLevels.has(i.level))

  if (opts.json) {
    const summary = summarize(issues)
    console.log(JSON.stringify({
      scanned: { scss: scssFiles.length, vue: vueFiles.length },
      themeVersion,
      totals: { all: issues.length, fresh: fresh.length, failed: failed.length, ...summary.byLevel },
      byRule: Object.fromEntries(summary.byRule),
      baseline: baselineInfo,
      issues,
    }, null, 2))
  } else {
    printReport({ scanned: { scss: scssFiles.length, vue: vueFiles.length }, issues, fresh, baselineInfo, limit: opts.limit })
    if (failed.length > 0) {
      console.log(`❌ 门禁失败：${failed.length} 条命中 ${[...failLevels].join("/")}`)
    } else if (baselineInfo) {
      console.log(`✅ 门禁通过：无新增 ${[...failLevels].join("/")} 问题`)
    } else if (issues.length > 0) {
      console.log(`提示：未建立基线，当前 ${issues.length} 条问题全部计入门禁。首次推进前执行 --write-baseline 冻结存量。`)
    } else {
      console.log("✅ 未发现问题")
    }
  }

  if (opts.writeBaseline) {
    const payload = {
      generatedAt: new Date().toISOString().slice(0, 10),
      total: issues.length,
      fingerprints: [...new Set(issues.map(i => i.fingerprint))].sort(),
    }
    writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
    console.log(`[audit-scss] 已写入基线 ${rel(BASELINE_PATH)}（${payload.total} 条，去重后 ${payload.fingerprints.length}）`)
  }

  process.exit(failed.length > 0 ? 1 : 0)
}

main()
