/**
 * i18n 合并脚本
 * 将 src/i18n/{zh_CN,en_US}/*.json 分片合并为 src/i18n/{zh_CN,en_US}.json
 * 供思源笔记框架读取
 *
 * 合并规则：
 *   1. common.json 先合并（作为基础）
 *   2. 其他模块文件按字母顺序合并（后合并的 key 覆盖先合并的同名 key）
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const I18N_DIR = join(__dirname, '..', 'src', 'i18n')

function mergeI18n(lang) {
  const dir = join(I18N_DIR, lang)

  if (!readdirSync(dir)) {
    console.error(`❌ Directory not found: ${dir}`)
    process.exit(1)
  }

  const files = readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => {
      // common.json 永远排第一
      if (a === 'common.json') return -1
      if (b === 'common.json') return 1
      return a.localeCompare(b)
    })

  const result = {}
  let totalKeys = 0

  for (const file of files) {
    try {
      const content = JSON.parse(
        readFileSync(join(dir, file), 'utf-8')
      )
      const keys = Object.keys(content)
      totalKeys += keys.length
      Object.assign(result, content)
      console.log(`  ${file} → ${keys.length} keys`)
    } catch (err) {
      console.error(`❌ Failed to parse ${dir}/${file}:`, err.message)
      process.exit(1)
    }
  }

  const outFile = join(I18N_DIR, `${lang}.json`)
  writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n', 'utf-8')
  console.log(`✅ ${lang}: ${Object.keys(result).length} top-level keys (${totalKeys} total including nested)\n`)

  return { topLevelKeys: Object.keys(result).length, totalKeys }
}

function main() {
  console.log('\n📦 Merging i18n files...\n')
  const zh = mergeI18n('zh_CN')
  const en = mergeI18n('en_US')

  if (zh.topLevelKeys !== en.topLevelKeys) {
    console.warn(`⚠️  Top-level key count mismatch: zh_CN=${zh.topLevelKeys}, en_US=${en.topLevelKeys}`)
  }
}

main()
