#!/usr/bin/env node
/**
 * 图标验证脚本
 * 验证配置中的图标是否存在于 MDI 图标集中
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// 图标数据集的路径
const ICONS_DATA_PATH = require.resolve('@iconify/json/json/mdi.json')

async function validateIcons() {
  console.log('🔍 验证图标配置...\n')

  try {
    // 读取图标数据
    const iconsData = JSON.parse(
      await fs.readFile(ICONS_DATA_PATH, 'utf-8')
    )

    const availableIcons = new Set(Object.keys(iconsData.icons))

    // 读取项目图标配置
    const configPath = path.resolve(process.cwd(), 'src/config/icons.ts')
    const configContent = await fs.readFile(configPath, 'utf-8')

    // 提取所有图标名称
    const iconMatches = configContent.matchAll(/icon:\s*['"`]([^'"`]+)['"`]/g)

    const invalidIcons = []
    const validIcons = []

    for (const match of iconMatches) {
      const iconName = match[1]
      // 移除 mdi: 前缀，因为数据集中的图标名称不带前缀
      const iconKey = iconName.replace(/^mdi:/, '')
      if (availableIcons.has(iconKey)) {
        validIcons.push(iconName)
      } else {
        invalidIcons.push(iconName)
      }
    }

    // 显示结果
    if (invalidIcons.length > 0) {
      console.log('❌ 发现无效图标:\n')
      invalidIcons.forEach(icon => {
        console.log(`  - ${icon}`)
      })
      console.log(`\n⚠️  共 ${invalidIcons.length} 个无效图标`)
      console.log('\n建议:')
      console.log('1. 访问 https://icon-sets.iconify.design/mdi/ 查看可用图标')
      console.log('2. 替换为有效的图标名称\n')
      process.exit(1)
    } else {
      console.log('✅ 所有图标都有效!')
      console.log(`\n共验证 ${validIcons.length} 个图标`)
      console.log('\n常用图标列表:')
      validIcons.slice(0, 10).forEach(icon => {
        console.log(`  - ${icon}`)
      })
      if (validIcons.length > 10) {
        console.log(`  ... 还有 ${validIcons.length - 10} 个图标`)
      }
    }
  } catch (error) {
    console.error('❌ 验证失败:', error.message)
    process.exit(1)
  }
}

validateIcons()
