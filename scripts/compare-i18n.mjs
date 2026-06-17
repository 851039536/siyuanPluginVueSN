/**
 * 比较合并后的 zh_CN.json 与 git 原始版本的差异
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const i18nDir = join(__dirname, '..', 'src', 'i18n')

for (const lang of ['zh_CN', 'en_US']) {
  console.log(`\n=== ${lang} ===`)

  // 从 git 获取原始版本
  const original = JSON.parse(
    execSync(`git show HEAD:src/i18n/${lang}.json`, { encoding: 'utf-8' })
  )
  const merged = JSON.parse(
    readFileSync(join(i18nDir, `${lang}.json`), 'utf-8')
  )

  const origKeys = Object.keys(original)
  const mergedKeys = Object.keys(merged)

  console.log(`Original: ${origKeys.length} keys`)
  console.log(`Merged:   ${mergedKeys.length} keys`)

  const onlyInMerged = mergedKeys.filter(k => !origKeys.includes(k))
  const onlyInOriginal = origKeys.filter(k => !mergedKeys.includes(k))

  if (onlyInMerged.length) {
    console.log(`❌ ${onlyInMerged.length} keys only in merged:`, onlyInMerged.slice(0, 10))
  }
  if (onlyInOriginal.length) {
    console.log(`❌ ${onlyInOriginal.length} keys only in original:`, onlyInOriginal.slice(0, 10))
  }

  if (onlyInMerged.length === 0 && onlyInOriginal.length === 0) {
    const diffs = []
    for (const key of origKeys) {
      const ov = JSON.stringify(original[key])
      const mv = JSON.stringify(merged[key])
      if (ov !== mv) {
        diffs.push(key)
      }
    }
    if (diffs.length === 0) {
      console.log('✅ Merged is identical to original!')
    } else {
      console.log(`⚠️  ${diffs.length} keys have different values:`, diffs.slice(0, 10))
    }
  }
}
