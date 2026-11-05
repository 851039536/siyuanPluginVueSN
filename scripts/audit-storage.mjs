// ============================================================
// 存储槽审计：源码 key ↔ src/config/storage/ 注册表 双向核对
//
// 用法：
//   pnpm audit:storage           文本报告（退出码 0/1）
//   pnpm audit:storage -- --json 机器可读
//
// 设计说明：
// - 注册表通过正则解析 `jsonSlot(...)` 等「一槽一行」工厂调用，不依赖 TS 运行时；
// - 源码侧解析 TypedStorage 构造、带 KEY 的 load/save 调用、plugin.loadData、
//   localStorage 与 featureTables；常量/import 做同文件 + 一层相对导入解析；
// - 动态拼接的 key 只能报 warning（无法静态求值），不得因此让脚本失效。
// ============================================================
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import fg from "fast-glob"

const ROOT = process.cwd()
const SRC = path.join(ROOT, "src")
const REGISTRY_DIR = path.join(SRC, "config", "storage")
const REGISTRY_FILES = ["jsonSlots.ts", "sqliteSlots.ts", "fileSlots.ts", "localStorageSlots.ts"]
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/
const SQLITE_TABLE = /^[a-z][a-z0-9]*_[a-z0-9_]+$/
const SLOT_RE = /(json|sqlite|file|localStorage)Slot\(\s*"([^"]+)"\s*,\s*\[[^\]]*\]\s*,\s*"([^"]+)"/g

const jsonMode = process.argv.includes("--json")

function read(file) {
  return fs.readFileSync(file, "utf8")
}

function lineAt(content, index) {
  return content.slice(0, index).split("\n").length
}

/** 从工厂调用起点找到配对的右括号（忽略字符串内的括号） */
function callEnd(content, start) {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < content.length; i++) {
    const ch = content[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === "\"") inString = false
      continue
    }
    if (ch === "\"") inString = true
    else if (ch === "(") depth++
    else if (ch === ")") {
      depth--
      if (depth === 0) return i
    }
  }
  return content.length
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/")
}

// ---------- 注册表 ----------

function parseRegistry() {
  const entries = []
  for (const name of REGISTRY_FILES) {
    const file = path.join(REGISTRY_DIR, name)
    if (!fs.existsSync(file)) continue
    const content = read(file)
    const re = new RegExp(SLOT_RE.source, "g")
    let match
    while ((match = re.exec(content))) {
      const line = lineAt(content, match.index)
      // 选项可能跨多行：按配对括号截取整段工厂调用再判断 legacyName
      const block = content.slice(match.index, callEnd(content, match.index) + 1)
      entries.push({
        kind: match[1],
        id: match[2],
        key: match[3],
        legacy: /legacyName:\s*true/.test(block),
        at: `${name}:${line}`,
      })
    }
  }
  return entries
}

// ---------- 源码常量与 import 解析 ----------

const constCache = new Map()
const aliasCache = new Map()
const importCache = new Map()

function getFileConstants(file) {
  if (constCache.has(file)) return constCache.get(file)
  const map = new Map()
  const content = read(file)
  for (const m of content.matchAll(/(?:const|let|readonly)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*"([^"]+)"/g)) {
    map.set(m[1], m[2])
  }
  // 对象字面量中的全大写键（STORAGE_KEYS = { CONFIG: "..." }）
  for (const m of content.matchAll(/\b([A-Z][A-Z0-9_]+)\s*:\s*"([^"]+)"/g)) {
    map.set(m[1], m[2])
  }
  constCache.set(file, map)
  return map
}

/** 对象字面量里的键别名（`S3_CONFIG: S3_BACKUP_CONFIG_KEY`） */
function getFileAliases(file) {
  if (aliasCache.has(file)) return aliasCache.get(file)
  const map = new Map()
  const content = read(file)
  for (const m of content.matchAll(/\b([A-Z][A-Z0-9_]+)\s*:\s*([A-Za-z_$][\w$]*)\s*[,}]/g)) {
    map.set(m[1], m[2])
  }
  aliasCache.set(file, map)
  return map
}

function getFileImports(file) {
  if (importCache.has(file)) return importCache.get(file)
  const map = new Map()
  const content = read(file)
  for (const m of content.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']((?:\.|@\/)[^"']+)["']/g)) {
    for (const raw of m[1].split(",")) {
      const part = raw.trim()
      if (!part) continue
      const asMatch = part.match(/^([\w$]+)\s+as\s+([\w$]+)$/)
      const name = asMatch ? asMatch[1] : part
      const local = asMatch ? asMatch[2] : part
      map.set(local, { spec: m[2], name })
    }
  }
  importCache.set(file, map)
  return map
}

function resolveSpec(fromFile, spec) {
  const base = spec.startsWith("@/")
    ? path.join(SRC, spec.slice(2))
    : path.resolve(path.dirname(fromFile), spec)
  for (const candidate of [`${base}.ts`, `${base}.vue`, path.join(base, "index.ts")]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function resolveIdent(file, ident, seen = new Set()) {
  const guard = `${file}::${ident}`
  if (seen.has(guard)) return null
  seen.add(guard)

  const last = ident.split(".").pop()
  const constants = getFileConstants(file)
  if (constants.has(last)) return constants.get(last)

  const alias = getFileAliases(file).get(last)
  if (alias) {
    const value = resolveIdent(file, alias, seen)
    if (value) return value
  }

  const imports = getFileImports(file)
  const head = ident.split(".")[0]
  const imported = imports.get(head) || imports.get(last)
  if (!imported) return null

  const target = resolveSpec(file, imported.spec)
  if (!target) return null
  return resolveIdent(target, imported.name || last, seen)
}

// ---------- 源码扫描 ----------

function scanSource(files) {
  const found = []
  const unresolved = []
  const namingIssues = []

  const push = (kind, key, file, index, content, via) => {
    const line = lineAt(content, index)
    found.push({
      kind,
      key,
      at: `${rel(file)}:${line}`,
      via,
    })
  }

  for (const file of files) {
    const content = read(file)
    const hasStorage = /\b(TypedStorage|PluginStorage)\b/.test(content)

    if (hasStorage) {
      // TypedStorage 构造：字面量
      for (const m of content.matchAll(/new\s+TypedStorage(?:\s*<[^>]*>)?\s*\(\s*[^,]+,\s*"([^"]+)"/g)) {
        push("json", m[1], file, m.index, content, "TypedStorage")
      }
      // TypedStorage 构造：标识符
      for (const m of content.matchAll(/new\s+TypedStorage(?:\s*<[^>]*>)?\s*\(\s*[^,]+,\s*([A-Za-z_$][\w$.[\]]*)/g)) {
        const ident = m[1]
        if (!/KEY|storage/i.test(ident)) continue
        const value = resolveIdent(file, ident)
        if (value) push("json", value, file, m.index, content, `TypedStorage(${ident})`)
        else unresolved.push({ at: `${rel(file)}:${lineAt(content, m.index)}`, ident })
      }
      // 带 KEY 的 load/save：标识符
      for (const m of content.matchAll(/\.(?:load|save|loadSafe|remove)\s*(?:<[^>]*>)?\s*\(\s*([A-Za-z_$][\w$.[\]]*)/g)) {
        const ident = m[1]
        if (!/KEY/i.test(ident)) continue
        const value = resolveIdent(file, ident)
        if (value) push("json", value, file, m.index, content, `storage(${ident})`)
        else unresolved.push({ at: `${rel(file)}:${lineAt(content, m.index)}`, ident })
      }
      // 带 KEY 的 load/save：字面量
      for (const m of content.matchAll(/\.(?:load|save|loadSafe|remove)\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g)) {
        push("json", m[1], file, m.index, content, "storage(literal)")
      }
    }

    // plugin.loadData / saveData / removeData
    for (const m of content.matchAll(/\.(?:loadData|saveData|removeData)\s*\(\s*"([^"]+)"/g)) {
      push("json", m[1], file, m.index, content, "plugin.*Data")
    }
    for (const m of content.matchAll(/\.(?:loadData|saveData|removeData)\s*\(\s*([A-Za-z_$][\w$.[\]]*)/g)) {
      const ident = m[1]
      if (!/KEY/i.test(ident)) continue
      const value = resolveIdent(file, ident)
      if (value) push("json", value, file, m.index, content, `plugin.*Data(${ident})`)
    }

    // localStorage
    for (const m of content.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\s*\(\s*"([^"]+)"/g)) {
      push("localStorage", m[1], file, m.index, content, "localStorage")
    }

    // SQLite 表
    for (const m of content.matchAll(/featureTables\s*\(\s*"([^"]+)"\s*,\s*\[([^\]]*)\]/g)) {
      for (const entity of m[2].matchAll(/"([^"]+)"/g)) {
        const table = `${m[1]}_${entity[1]}`
        push("sqlite", table, file, m.index, content, "featureTables")
      }
    }
  }

  // 去重（同 key 只保留首个来源）
  const deduped = []
  const seen = new Set()
  for (const item of found) {
    const guard = `${item.kind}:${item.key}`
    if (seen.has(guard)) continue
    seen.add(guard)
    deduped.push(item)
  }

  // 命名检查（存量键已在注册表标 legacy）
  for (const item of deduped) {
    if (item.kind === "json" && !KEBAB_CASE.test(item.key)) namingIssues.push(item)
    if (item.kind === "sqlite" && !SQLITE_TABLE.test(item.key)) namingIssues.push(item)
  }

  return { found: deduped, unresolved, namingIssues }
}

// ---------- 主流程 ----------

function loadIgnoreConfig() {
  const file = path.join(ROOT, "scripts", "audit-storage.config.json")
  if (!fs.existsSync(file)) return { ignoreKeys: [], ignoreZombie: [] }
  try {
    const data = JSON.parse(read(file))
    return {
      ignoreKeys: Array.isArray(data.ignoreKeys) ? data.ignoreKeys : [],
      ignoreZombie: Array.isArray(data.ignoreZombie) ? data.ignoreZombie : [],
    }
  } catch (error) {
    console.warn(`[audit:storage] 忽略配置解析失败，按空配置处理：${error.message}`)
    return { ignoreKeys: [], ignoreZombie: [] }
  }
}

function main() {
  if (!fs.existsSync(REGISTRY_DIR)) {
    console.error("[audit:storage] 找不到 src/config/storage/ 注册表目录")
    process.exit(1)
  }

  const ignore = loadIgnoreConfig()
  const registry = parseRegistry()
  const files = fg.sync(["src/**/*.{ts,vue}"], {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
    ignore: ["**/*.spec.ts", "src/config/storage/**"],
  })

  const { found, unresolved, namingIssues } = scanSource(files)
  // 存量键已在注册表标 legacyName → 源码侧不再重复告警
  const legacyKeys = new Set(registry.filter((entry) => entry.legacy).map((entry) => entry.key))
  const effectiveNamingIssues = namingIssues.filter((item) => !legacyKeys.has(item.key))
  // 通用存储层内部的 this._key / key 是参数化中转，不参与静态核对
  const effectiveUnresolved = unresolved
    .filter((item) => !/^((this\.)?_?key)$/i.test(item.ident))
    // 注册表驱动的通用读写在 modules 内使用 slot.key（受信值），不参与静态核对
    .filter((item) => !/^(slot|entry|usage)\.key$/i.test(item.ident))
    .filter((item) => /KEY/i.test(item.ident))

  const report = {}
  const errors = []

  for (const kind of ["json", "sqlite", "file", "localStorage"]) {
    const reg = registry.filter((entry) => entry.kind === kind)
    const regKeys = new Set(reg.map((entry) => entry.key))
    const srcKeys = new Set(found.filter((item) => item.kind === kind).map((item) => item.key))

    // 文件槽是目录/衍生文件，不做源码 key 比对
    const unregistered = kind === "file"
      ? []
      : [...srcKeys]
        .filter((key) => !regKeys.has(key))
        .filter((key) => !ignore.ignoreKeys.includes(key))
        .map((key) => ({ key, at: found.find((item) => item.kind === kind && item.key === key)?.at }))

    const zombie = kind === "file"
      ? []
      : [...regKeys]
        .filter((key) => !srcKeys.has(key))
        .filter((key) => !ignore.ignoreZombie.includes(key))
        .map((key) => ({ key, at: reg.find((entry) => entry.key === key)?.at }))

    report[kind] = {
      registry: reg.length,
      discovered: srcKeys.size,
      unregistered,
      zombie,
    }

    if (unregistered.length) errors.push(`${kind}：${unregistered.length} 个源码 key 未登记`)
    if (zombie.length) errors.push(`${kind}：${zombie.length} 个注册表条目在源码中不存在`)
  }

  // 注册表自身命名与 legacy 标记
  const registryNaming = registry.filter((entry) => {
    if (entry.legacy) return false
    if (entry.kind === "json") return !KEBAB_CASE.test(entry.key)
    if (entry.kind === "sqlite") return !SQLITE_TABLE.test(entry.key)
    return false
  })
  if (registryNaming.length) errors.push(`注册表：${registryNaming.length} 个条目命名不合规且未标 legacyName`)

  if (jsonMode) {
    console.log(JSON.stringify({
      report,
      registryNaming,
      namingIssues: effectiveNamingIssues,
      unresolved: effectiveUnresolved,
      errors,
    }, null, 2))
  } else {
    console.log("[audit:storage] 存储槽审计")
    for (const kind of ["json", "sqlite", "file", "localStorage"]) {
      const item = report[kind]
      console.log(`  ${kind.padEnd(12)} 注册表 ${String(item.registry).padStart(3)} / 源码发现 ${String(item.discovered).padStart(3)}`)
      for (const entry of item.unregistered) console.log(`    ✗ 未登记 ${entry.key}  (${entry.at || "?"})`)
      for (const entry of item.zombie) console.log(`    ✗ 僵尸条目 ${entry.key}  (${entry.at || "?"})`)
    }
    for (const entry of registryNaming) console.log(`    ✗ 命名不合规 ${entry.id} → ${entry.key}  (${entry.at})`)
    for (const entry of effectiveNamingIssues) console.log(`    ! 源码命名告警 ${entry.key}  (${entry.at})`)
    for (const entry of effectiveUnresolved) console.log(`    ! 动态 key 未解析 ${entry.ident}  (${entry.at})`)

    if (errors.length) {
      console.log("")
      console.log(`[audit:storage] 失败：${errors.join("；")}`)
    } else {
      console.log("")
      console.log("[audit:storage] 通过：注册表与源码一致")
    }
  }

  process.exit(errors.length ? 1 : 0)
}

main()
