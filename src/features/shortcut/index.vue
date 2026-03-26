<template>
  <div class="shortcut-panel">
    <!-- 顶部操作栏 -->
    <PanelHeader
      v-model:search-keyword="searchKeyword"
      :placeholder="i18n.searchPlaceholder || '搜索快捷键...'"
      :add-title="i18n.addCustomShortcut || '添加快捷键'"
      @refresh="refreshShortcuts"
      @export="showExportDialog"
      @import="showImportDialog"
      @add="showAddDialog"
    />

    <!-- 统计信息栏 -->
    <StatsBar
      :total-count="totalCount"
      :favorite-count="favoriteCount"
      :custom-count="customCount"
      :total-label="i18n.total || '总计'"
      :favorite-label="i18n.favorite || '收藏'"
      :custom-label="i18n.custom || '自定义'"
    />

    <!-- 分类选择器 -->
    <CategorySelector
      v-model:active-tab="activeTab"
      v-model:category-search="categorySearch"
      :tabs="tabs"
      :get-category-label="getCategoryLabel"
      :get-tab-count="getTabCount"
      :category-label="i18n.category || '分类:'"
      :search-placeholder="i18n.searchCategory || '搜索分类...'"
      :no-result-hint="i18n.noCategoryFound || '未找到匹配的分类'"
    />

    <!-- 快捷筛选栏 -->
    <FilterBar
      v-model:active-filter="activeFilter"
      v-model:view-mode="viewMode"
      :filters="quickFilters"
    />

    <!-- 快捷键列表 -->
    <ShortcutGrid
      :shortcuts="filteredShortcuts"
      :view-mode="viewMode"
      :is-favorite="isFavorite"
      :is-recent="isRecent"
      :get-category-label="getCategoryLabel"
      :show-tool-badge="showToolBadge"
      :empty-text="i18n.noResults || '未找到快捷键'"
      :favorite-title="i18n.favorite || '收藏'"
      :un-favorite-title="i18n.unFavorite || '取消收藏'"
      :copy-title="i18n.copy || '复制'"
      :edit-title="i18n.edit || '编辑'"
      :delete-title="i18n.delete || '删除'"
      :other-group-label="i18n.other || '其他'"
      @toggle-favorite="toggleFavorite"
      @copy="copyShortcutInfo"
      @edit="editShortcut"
      @delete="deleteShortcut"
    />

    <!-- 添加/编辑快捷键对话框 -->
    <ShortcutDialog
      :visible="showDialog && (dialogType === 'add' || dialogType === 'edit')"
      :is-edit="dialogType === 'edit'"
      :form-data="formData"
      :title-label="i18n.addCustomShortcut || '添加快捷键'"
      :edit-title-label="i18n.editShortcut || '编辑快捷键'"
      :name-label="i18n.shortcutName || '快捷键名称'"
      :name-placeholder="i18n.enterName || '输入快捷键名称'"
      :desc-label="i18n.description || '描述'"
      :desc-placeholder="i18n.enterDescription || '输入功能描述'"
      :keys-label="i18n.shortcutKeys || '快捷键'"
      :keys-placeholder="i18n.keysPlaceholder || '例如: Ctrl+K'"
      :group-label="i18n.group || '分组'"
      :group-placeholder="i18n.enterGroup || '输入分组名称'"
      :cancel-text="i18n.cancel || '取消'"
      :confirm-text="i18n.confirm || '确认'"
      :fill-required-text="i18n.fillRequired || '请填写必填项'"
      @close="closeDialog"
      @confirm="addShortcut"
    />

    <!-- 导出对话框 -->
    <ExportDialog
      :visible="showDialog && dialogType === 'export'"
      :count="filteredShortcuts.length"
      :format="exportFormat"
      :title="i18n.exportShortcuts || '导出快捷键'"
      :format-label="i18n.exportFormat || '导出格式'"
      :json-option="i18n.jsonFormat || 'JSON 格式'"
      :markdown-option="i18n.markdownFormat || 'Markdown 表格'"
      :preview-text="i18n.willExport || '将导出'"
      :preview-unit="i18n.shortcutsUnit || '个快捷键'"
      :cancel-text="i18n.cancel || '取消'"
      :export-text="i18n.export || '导出'"
      @close="closeDialog"
      @export="handleExport"
    />

    <!-- 导入对话框 -->
    <ImportDialog
      :visible="showDialog && dialogType === 'import'"
      :title="i18n.importShortcuts || '导入快捷键'"
      :file-label="i18n.selectJsonFile || '选择 JSON 文件'"
      :hint-text="i18n.selectValidJson || '请选择符合格式的 JSON 文件'"
      :close-text="i18n.close || '关闭'"
      :format-error-text="i18n.formatError || '文件格式错误'"
      :import-success-text="i18n.importSuccess || '成功导入'"
      :import-error-text="i18n.importError || '导入失败，请检查文件格式'"
      @close="closeDialog"
      @import="handleImport"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import PanelHeader from './components/PanelHeader.vue'
import StatsBar from './components/StatsBar.vue'
import CategorySelector from './components/CategorySelector.vue'
import FilterBar from './components/FilterBar.vue'
import ShortcutGrid from './components/ShortcutGrid.vue'
import ShortcutDialog from './components/ShortcutDialog.vue'
import ExportDialog from './components/ExportDialog.vue'
import ImportDialog from './components/ImportDialog.vue'
import { getShortcutManager } from './manager'
import { loadFavorites, saveFavorites, loadRecent, saveRecent } from './types/storage'
import type { ShortcutInfo, ViewMode, DialogType, QuickFilter, ShortcutFormData } from './types'

// 快捷筛选选项 - 提取为常量避免重复创建
const QUICK_FILTERS: QuickFilter[] = [
  { key: 'all', label: '全部' },
  { key: 'favorite', label: '收藏' },
  { key: 'recent', label: '最近使用' }
]

interface Props {
  i18n?: Record<string, any>
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({})
})

// 状态
const searchKeyword = ref('')
const activeTab = ref('all')
const activeFilter = ref('all')
const viewMode = ref<ViewMode>('grid')
const categorySearch = ref('')
const showDialog = ref(false)
const dialogType = ref<DialogType>(null)
const exportFormat = ref<'json' | 'markdown'>('json')
const favorites = ref<Set<string>>(new Set())
const recentUsed = ref<string[]>([])

// 表单数据
const formData = ref<ShortcutFormData>({
  id: '',
  name: '',
  description: '',
  keys: '',
  group: '自定义'
})

// 快捷筛选选项 - 使用常量
const quickFilters = QUICK_FILTERS

// 获取快捷键管理器
const manager = getShortcutManager()

// 统计信息
const totalCount = computed(() => manager.getAllShortcuts().length)
const favoriteCount = computed(() => favorites.value.size)
const customCount = computed(() => manager.getByCategory('custom').length)

// 初始化
onMounted(async () => {
  if (props.plugin) {
    try {
      // 并行加载收藏和最近使用数据
      const [loadedFavorites, loadedRecent] = await Promise.all([
        loadFavorites(props.plugin),
        loadRecent(props.plugin)
      ])
      favorites.value = new Set(loadedFavorites)
      recentUsed.value = loadedRecent
    } catch (error) {
      console.error('初始化数据失败:', error)
      favorites.value = new Set()
      recentUsed.value = []
    }
  }
})

// 获取所有分类
const tabs = computed(() => {
  const allShortcuts = manager.getAllShortcuts()
  const categories = new Set(allShortcuts.map(s => s.category))
  return ['all', ...Array.from(categories).sort()]
})

// 获取分类数量
function getTabCount(category: string): number {
  if (category === 'all') return totalCount.value
  return manager.getByCategory(category).length
}

// 分类标签映射 - 使用 computed 缓存 i18n 映射
const categoryLabels = computed(() => ({
  'all': props.i18n.allShortcuts || '全部',
  'siyuan': props.i18n.siyuanShortcuts || '思源笔记',
  'plugin': props.i18n.pluginShortcuts || '插件快捷键',
  'claude': props.i18n.claudeShortcuts || 'Claude Code',
  'openspec': props.i18n.openspecShortcuts || 'OpenSpec',
  'npm': props.i18n.npmShortcuts || 'NPM',
  'nvm': props.i18n.nvmShortcuts || 'NVM',
  'cmd': props.i18n.cmdShortcuts || 'Windows CMD',
  'vscode': props.i18n.vscodeShortcuts || 'VS Code',
  'visual-studio': props.i18n.visualStudioShortcuts || 'Visual Studio',
  'custom': props.i18n.customShortcuts || '自定义'
}))

function getCategoryLabel(category: string): string {
  return categoryLabels.value[category] || category
}

// 是否显示工具徽章
function showToolBadge(category: string): boolean {
  return ['npm', 'nvm', 'cmd', 'vscode', 'visual-studio'].includes(category)
}

// 过滤快捷键 - 优化性能，减少不必要的调用
const filteredShortcuts = computed(() => {
  // 先获取基础数据
  let shortcuts = searchKeyword.value
    ? manager.search(searchKeyword.value)
    : manager.getAllShortcuts()

  // 按分类过滤（合并搜索和分类条件）
  if (activeTab.value !== 'all') {
    shortcuts = shortcuts.filter(s => s.category === activeTab.value)
  }

  // 按快捷筛选过滤
  if (activeFilter.value === 'favorite') {
    shortcuts = shortcuts.filter(s => favorites.value.has(s.id))
  } else if (activeFilter.value === 'recent') {
    shortcuts = shortcuts.filter(s => recentUsed.value.includes(s.id))
  }

  return shortcuts
})

// 收藏相关
function isFavorite(id: string): boolean {
  return favorites.value.has(id)
}

async function toggleFavorite(id: string) {
  if (favorites.value.has(id)) {
    favorites.value.delete(id)
  } else {
    favorites.value.add(id)
  }

  if (props.plugin) {
    try {
      await saveFavorites(props.plugin, Array.from(favorites.value))
    } catch (error) {
      console.error('保存收藏状态失败:', error)
    }
  }
}

// 最近使用
function isRecent(id: string): boolean {
  return recentUsed.value.includes(id)
}

async function addToRecent(id: string) {
  const index = recentUsed.value.indexOf(id)
  if (index > -1) recentUsed.value.splice(index, 1)
  recentUsed.value.unshift(id)
  if (recentUsed.value.length > 10) recentUsed.value.pop()

  if (props.plugin) {
    try {
      await saveRecent(props.plugin, recentUsed.value)
    } catch (error) {
      console.error('保存最近使用失败:', error)
    }
  }
}

// 复制快捷键信息
function copyShortcutInfo(shortcut: ShortcutInfo) {
  const text = shortcut.copyContent || shortcut.keys
  navigator.clipboard.writeText(text).then(() => {
    addToRecent(shortcut.id)
  }).catch(err => {
    console.error('复制失败:', err)
  })
}

// 对话框操作
function showAddDialog() {
  dialogType.value = 'add'
  formData.value = {
    id: '',
    name: '',
    description: '',
    keys: '',
    group: '自定义'
  }
  showDialog.value = true
}

function editShortcut(shortcut: ShortcutInfo) {
  dialogType.value = 'edit'
  formData.value = {
    id: shortcut.id,
    name: shortcut.name,
    description: shortcut.description,
    keys: shortcut.keys,
    group: shortcut.group || '自定义'
  }
  showDialog.value = true
}

function showExportDialog() {
  dialogType.value = 'export'
  showDialog.value = true
}

function showImportDialog() {
  dialogType.value = 'import'
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  dialogType.value = null
}

// 添加快捷键
async function addShortcut(shortcut: ShortcutInfo) {
  await manager.addShortcut(shortcut)
  closeDialog()
}

// 删除快捷键
async function deleteShortcut(id: string) {
  if (confirm(props.i18n.confirmDelete || '确认删除此快捷键？')) {
    await manager.removeShortcut(id)
    favorites.value.delete(id)
    const index = recentUsed.value.indexOf(id)
    if (index > -1) recentUsed.value.splice(index, 1)

    if (props.plugin) {
      try {
        await saveFavorites(props.plugin, Array.from(favorites.value))
      } catch (error) {
        console.error('更新收藏数据失败:', error)
      }
    }
  }
}

// 刷新快捷键列表（当前数据已在 computed 中自动更新）
function refreshShortcuts() {
  // 快捷键数据通过 computed 自动更新，无需手动刷新
}

// 导出快捷键
function handleExport(format: 'json' | 'markdown') {
  const shortcuts = activeTab.value === 'all'
    ? manager.getAllShortcuts()
    : manager.getByCategory(activeTab.value)

  if (format === 'json') {
    const json = JSON.stringify(shortcuts, null, 2)
    downloadFile(json, 'shortcuts.json', 'application/json')
  } else {
    const markdown = generateMarkdown(shortcuts)
    downloadFile(markdown, 'shortcuts.md', 'text/markdown')
  }
  closeDialog()
}

// 生成 Markdown
function generateMarkdown(shortcuts: ShortcutInfo[]): string {
  let md = '# 快捷键列表\n\n'
  const grouped = groupShortcuts(shortcuts)

  for (const group of grouped) {
    md += `## ${group.name}\n\n`
    md += '| 名称 | 快捷键 | 描述 |\n'
    md += '|------|---------|------|\n'
    for (const s of group.shortcuts) {
      md += `| ${s.name} | \`${s.keys}\` | ${s.description} |\n`
    }
    md += '\n'
  }

  return md
}

// 分组快捷键
function groupShortcuts(shortcuts: ShortcutInfo[]) {
  const groupMap = new Map<string, ShortcutInfo[]>()
  shortcuts.forEach(shortcut => {
    const group = shortcut.group || '其他'
    if (!groupMap.has(group)) groupMap.set(group, [])
    groupMap.get(group)!.push(shortcut)
  })
  return Array.from(groupMap.entries()).map(([name, shortcuts]) => ({
    name,
    shortcuts
  }))
}

// 下载文件
function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// 导入快捷键
async function handleImport(shortcuts: ShortcutInfo[]) {
  await manager.addShortcuts(shortcuts)
  closeDialog()
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
