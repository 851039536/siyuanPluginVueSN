/**
 * i18n 键同步校验脚本
 * 确保 zh_CN 和 en_US 的键完全对齐，检测重复键
 *
 * 用法：
 *   node scripts/verify-i18n.mjs          # 校验原始 JSON
 *   node scripts/verify-i18n.mjs --split  # 校验拆分后的文件
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs'
import {
  dirname,
  join,
} from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const I18N_DIR = join(__dirname, '..', 'src', 'i18n')
const args = process.argv.slice(2)
const checkSplit = args.includes('--split')

/**
 * 递归提取所有叶子路径（深度优先，叶值为 string）
 * 返回 { key: string, value: string }[]
 */
function findLeafPaths(obj, prefix = '') {
  /** @type {{ key: string, value: string }[]} */
  const result = []
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      result.push(...findLeafPaths(v, fullKey))
    } else {
      result.push({
        key: fullKey,
        value: String(v),
      })
    }
  }
  return result
}

/**
 * 检测 JSON 文件原文中的重复顶层键（JS 对象解析后重复键会被覆盖，需从原始文本检测）
 */
function detectDuplicateKeys(filePath) {
  const text = readFileSync(filePath, 'utf-8')
  const seen = new Map()
  const duplicates = []
  // 匹配 JSON 顶层键（紧跟在行首 2 空格缩进的双引号键名）
  const keyRegex = /^ {2}"([^"]+)":/gm
  // 用 matchAll 迭代，避免 while 中的赋值表达式（no-cond-assign）
  for (const match of text.matchAll(keyRegex)) {
    const key = match[1]
    if (seen.has(key)) {
      duplicates.push({
        key,
        firstLine: seen.get(key),
        duplicateLine: text.substring(0, match.index).split('\n').length,
      })
    } else {
      seen.set(key, text.substring(0, match.index).split('\n').length)
    }
  }
  return duplicates
}

function loadI18n(lang) {
  const file = join(I18N_DIR, `${lang}.json`)
  return JSON.parse(readFileSync(file, 'utf-8'))
}

/**
 * 按点号路径取值（与 featureRegistry.resolveI18nText 同语义）
 * @param {Record<string, unknown>} obj
 * @param {string} path
 * @returns {unknown}
 */
function resolveByPath(obj, path) {
  return path
    .split('.')
    .reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj)
}

/**
 * 校验 FEATURE_CONFIG 中声明的 i18n 键真实存在（titleI18nKey / descI18nKey / labelI18nKey）。
 *
 * 为什么需要：这些键解析失败时会被 `defaultTitle` / `defaultDesc` / `defaultLabel` 静默兜底
 * （见 featureRegistry.ts 的 `?? meta.defaultTitle`），界面上看不出异常，只表现为
 * 「i18n 键形同虚设」—— 英文环境拿到的仍是中文兜底值。历史上 skillLearning.title
 * （扁平分片导致 plugin.i18n.skillLearning 不存在）与 floatingToolbar.title
 * （分片缺该键）都属于此类，靠人工比对才发现，故固化为契约校验。
 *
 * @returns {{ kind: string, key: string, featureId: string }[]} 未解析的键
 */
function checkFeatureConfigI18nKeys(zhCN) {
  const configPath = join(__dirname, '..', 'src', 'features', 'config.ts')
  if (!existsSync(configPath)) {
    console.warn('⚠️  src/features/config.ts not found, skipping FEATURE_CONFIG key check')
    return []
  }
  const source = readFileSync(configPath, 'utf-8')

  // 逐条匹配 i18n 键声明，并回溯最近的 `id: "xxx"` 作为归属功能（便于定位）
  const unresolved = []
  const keyRegex = /(titleI18nKey|descI18nKey|labelI18nKey):\s*"([^"]+)"/g
  const idRegex = /id:\s*"([^"]+)"/g
  for (const match of source.matchAll(keyRegex)) {
    const [, kind, key] = match
    let featureId = '?'
    idRegex.lastIndex = 0
    for (const idMatch of source.matchAll(idRegex)) {
      if (idMatch.index > match.index) {
        break
      }
      featureId = idMatch[1]
    }
    const value = resolveByPath(zhCN, key)
    if (typeof value !== 'string' || !value) {
      unresolved.push({ kind, key, featureId })
    }
  }
  return unresolved
}

function main() {
  let errors = 0

  console.log('\n🔍 Verifying i18n key synchronization...\n')

  // 跨分片顶层同名键检测：merge-i18n.mjs 按字母序 Object.assign 覆盖，
  // 同名键在多个分片中出现且值不同时，后合并的分片会静默改写先合并的文案（跨功能回归）。
  // 值相同仅告警（历史遗留冗余），值不同视为错误。
  // 基线：以下冲突存在于 s3Backup 之外的既有分片中，属历史遗留，需另行修复；
  // 登记于此可让「新增」冲突直接失败，避免基线外的回归被掩盖。
  const KNOWN_CROSS_SHARD_CONFLICTS = new Set([
    'zh_CN:confirm',
    'zh_CN:preview',
    'en_US:preview',
    'zh_CN:confirmDelete',
    'en_US:confirmDelete',
    'zh_CN:searchPlaceholder',
    'en_US:searchPlaceholder',
  ])

  for (const lang of ['zh_CN', 'en_US']) {
    const dir = join(I18N_DIR, lang)
    if (!existsSync(dir)) {
      continue
    }
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    /** @type {Map<string, { file: string, value: string }[]>} */
    const owners = new Map()
    for (const file of files) {
      let content
      try {
        content = JSON.parse(readFileSync(join(dir, file), 'utf-8'))
      } catch {
        continue
      }
      for (const [key, value] of Object.entries(content)) {
        if (!owners.has(key)) {
          owners.set(key, [])
        }
        owners.get(key).push({ file, value: JSON.stringify(value) })
      }
    }
    const conflicts = []
    const baselined = []
    for (const [key, list] of owners) {
      if (list.length < 2) {
        continue
      }
      const values = new Set(list.map((i) => i.value))
      if (values.size <= 1) {
        continue
      }
      const entry = { key, list }
      if (KNOWN_CROSS_SHARD_CONFLICTS.has(`${lang}:${key}`)) {
        baselined.push(entry)
      } else {
        conflicts.push(entry)
      }
    }
    if (baselined.length > 0) {
      console.warn(`\n⚠️  ${lang}: ${baselined.length} baselined cross-shard conflict(s) (pre-existing, fix separately): ${baselined.map((c) => c.key).join(', ')}`)
    }
    if (conflicts.length > 0) {
      console.error(`\n❌ ${lang}: ${conflicts.length} NEW cross-shard top-level key conflict(s) (later shard wins, silently overriding):`)
      for (const { key, list } of conflicts.sort((a, b) => a.key.localeCompare(b.key))) {
        console.error(`   "${key}" — ${list.map((i) => `${i.file}=${i.value}`).join('  |  ')}`)
      }
      errors++
    } else {
      console.log(`\n✅ ${lang}: no new cross-shard top-level key conflicts`)
    }
  }

  if (checkSplit) {
    // 检查拆分文件
    for (const lang of ['zh_CN', 'en_US']) {
      const dir = join(I18N_DIR, lang)
      if (!existsSync(dir)) {
        console.error(`❌ Directory not found: ${dir}`)
        errors++
        continue
      }
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
      console.log(`  ${lang}: ${files.length} files`)
      for (const file of files) {
        const enFile = join(I18N_DIR, 'en_US', file)
        if (!existsSync(enFile)) {
          console.error(`  ❌ Missing en_US/${file}`)
          errors++
        }
      }
    }
  } else {
    // 检查合并后的 JSON
    const zhCN = loadI18n('zh_CN')
    const enUS = loadI18n('en_US')

    // 1. 检测重复键
    console.log('--- Duplicate Keys ---')
    const zhFile = join(I18N_DIR, 'zh_CN.json')
    const enFile = join(I18N_DIR, 'en_US.json')
    const zhDupes = detectDuplicateKeys(zhFile)
    const enDupes = detectDuplicateKeys(enFile)
    if (zhDupes.length > 0) {
      console.warn(`⚠️  zh_CN has ${zhDupes.length} duplicate top-level key(s):`)
      for (const d of zhDupes) {
        console.warn(`   "${d.key}" — first at line ${d.firstLine}, duplicate at line ${d.duplicateLine}`)
      }
    }
    if (enDupes.length > 0) {
      console.warn(`⚠️  en_US has ${enDupes.length} duplicate top-level key(s):`)
      for (const d of enDupes) {
        console.warn(`   "${d.key}" — first at line ${d.firstLine}, duplicate at line ${d.duplicateLine}`)
      }
    }

    // 2. 比较叶子键
    console.log('\n--- Key Parity Check ---')
    const zhLeaves = findLeafPaths(zhCN)
    const enLeaves = findLeafPaths(enUS)

    const zhKeySet = new Set(zhLeaves.map((l) => l.key))
    const enKeySet = new Set(enLeaves.map((l) => l.key))

    const missingInEN = [...zhKeySet].filter((k) => !enKeySet.has(k))
    const missingInZH = [...enKeySet].filter((k) => !zhKeySet.has(k))

    if (missingInEN.length > 0) {
      console.error(`❌ ${missingInEN.length} key(s) in zh_CN but missing in en_US:`)
      for (const k of missingInEN) {
        console.error(`   - ${k}`)
      }
      errors++
    }

    if (missingInZH.length > 0) {
      console.error(`❌ ${missingInZH.length} key(s) in en_US but missing in zh_CN:`)
      for (const k of missingInZH) {
        console.error(`   - ${k}`)
      }
      errors++
    }

    if (missingInEN.length === 0 && missingInZH.length === 0) {
      console.log(`✅ All ${zhLeaves.length} leaf keys are synchronized between zh_CN and en_US`)
    }

    // 3. FEATURE_CONFIG 声明的 i18n 键必须真实可解析
    console.log('\n--- FEATURE_CONFIG i18n Key Contract ---')
    const unresolvedKeys = checkFeatureConfigI18nKeys(zhCN)
    if (unresolvedKeys.length > 0) {
      console.error(`❌ ${unresolvedKeys.length} FEATURE_CONFIG i18n key(s) do not resolve to a string:`)
      for (const { kind, key, featureId } of unresolvedKeys) {
        console.error(`   - ${featureId} → ${kind}: "${key}"`)
      }
      console.error('   这些键会被 defaultTitle/defaultDesc/defaultLabel 静默兜底，')
      console.error('   英文环境下将显示中文兜底值。请检查分片是否为嵌套结构、键是否存在。')
      errors++
    } else {
      console.log('✅ All FEATURE_CONFIG i18n keys resolve to a string')
    }
  }

  if (errors > 0) {
    console.error(`\n❌ Verification failed with ${errors} error(s)`)
    process.exit(1)
  } else {
    console.log('\n✅ Verification passed\n')
  }
}

main()
