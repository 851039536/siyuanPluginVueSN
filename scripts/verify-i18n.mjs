/**
 * i18n 键同步校验脚本
 * 确保 zh_CN 和 en_US 的键完全对齐，检测重复键
 *
 * 用法：
 *   node scripts/verify-i18n.mjs          # 校验原始 JSON
 *   node scripts/verify-i18n.mjs --split  # 校验拆分后的文件
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
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
      result.push({ key: fullKey, value: String(v) })
    }
  }
  return result
}

/**
 * 检测 JSON 对象中重复的顶层键
 */
function detectDuplicateKeys(obj) {
  const seen = new Map()
  const duplicates = []

  for (const [key, value] of Object.entries(obj)) {
    if (seen.has(key)) {
      duplicates.push({
        key,
        firstValue: String(seen.get(key)),
        lastValue: String(value),
      })
    } else {
      seen.set(key, value)
    }
  }
  return duplicates
}

function loadI18n(lang) {
  const file = join(I18N_DIR, `${lang}.json`)
  return JSON.parse(readFileSync(file, 'utf-8'))
}

function main() {
  let errors = 0

  console.log('\n🔍 Verifying i18n key synchronization...\n')

  if (checkSplit) {
    // 检查拆分文件
    for (const lang of ['zh_CN', 'en_US']) {
      const dir = join(I18N_DIR, lang)
      if (!existsSync(dir)) {
        console.error(`❌ Directory not found: ${dir}`)
        errors++
        continue
      }
      const files = readdirSync(dir).filter(f => f.endsWith('.json'))
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
    const zhDupes = detectDuplicateKeys(zhCN)
    const enDupes = detectDuplicateKeys(enUS)
    if (zhDupes.length > 0) {
      console.warn(`⚠️  zh_CN has ${zhDupes.length} duplicate top-level key(s):`)
      for (const d of zhDupes) {
        console.warn(`   "${d.key}" — first: "${d.firstValue}", last: "${d.lastValue}"`)
      }
    }
    if (enDupes.length > 0) {
      console.warn(`⚠️  en_US has ${enDupes.length} duplicate top-level key(s):`)
      for (const d of enDupes) {
        console.warn(`   "${d.key}" — first: "${d.firstValue}", last: "${d.lastValue}"`)
      }
    }

    // 2. 比较叶子键
    console.log('\n--- Key Parity Check ---')
    const zhLeaves = findLeafPaths(zhCN)
    const enLeaves = findLeafPaths(enUS)

    const zhKeySet = new Set(zhLeaves.map(l => l.key))
    const enKeySet = new Set(enLeaves.map(l => l.key))

    const missingInEN = [...zhKeySet].filter(k => !enKeySet.has(k))
    const missingInZH = [...enKeySet].filter(k => !zhKeySet.has(k))

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
  }

  if (errors > 0) {
    console.error(`\n❌ Verification failed with ${errors} error(s)`)
    process.exit(1)
  } else {
    console.log('\n✅ Verification passed\n')
  }
}

main()
