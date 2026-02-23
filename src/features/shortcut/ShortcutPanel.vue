<template>
  <div class="shortcut-panel">
    <!-- 顶部操作栏 -->
    <div class="shortcut-header">
      <Input
        v-model="searchKeyword"
        :placeholder="i18n.searchPlaceholder || '搜索快捷键...'"
        prefix-icon="search"
        size="medium"
      />
      <div class="header-actions">
        <Button variant="ghost" size="small" icon="refresh" :title="'刷新'" @click="refreshShortcuts" />
        <Button variant="ghost" size="small" icon="download" :title="'导出'" @click="showExportDialog" />
        <Button variant="ghost" size="small" :icon="'file' as any" :title="'导入'" @click="showImportDialog" />
        <Button variant="primary" size="small" icon="add" :title="i18n.addCustomShortcut || '添加快捷键'" @click="showAddDialog" />
      </div>
    </div>

    <!-- 统计信息栏 -->
    <div class="shortcut-stats">
      <div class="stat-item">
        <span class="stat-label">总计</span>
        <span class="stat-value">{{ totalCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">收藏</span>
        <span class="stat-value">{{ favoriteCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">自定义</span>
        <span class="stat-value">{{ customCount }}</span>
      </div>
    </div>

    <!-- 分类选择器 -->
    <div class="shortcut-category-selector">
      <div class="selector-header">
        <label>分类:</label>
        <div class="selector-control">
          <Input
            v-model="categorySearch"
            :placeholder="'搜索分类...'"
            prefix-icon="search"
            size="small"
          />
          <Select
            v-model="activeTab"
            :options="selectOptions"
            size="small"
          />
        </div>
        <div v-if="categorySearch && filteredTabs.length === 0" class="search-result-hint">
          未找到匹配的分类
        </div>
      </div>
    </div>

    <!-- 快捷筛选栏 -->
    <div class="shortcut-filters">
      <div class="filter-group">
        <Button
          v-for="filter in quickFilters"
          :key="filter.key"
          :variant="activeFilter === filter.key ? 'primary' : 'ghost'"
          size="small"
          @click="activeFilter = filter.key"
        >
          {{ filter.label }}
        </Button>
      </div>
      <div class="view-toggle">
        <Button
          :variant="viewMode === 'grid' ? 'primary' : 'ghost'"
          size="small"
          @click="viewMode = 'grid'"
          title="网格视图"
        >
          <span class="grid-icon">
            <span class="square"></span>
            <span class="square"></span>
          </span>
        </Button>
        <Button
          :variant="viewMode === 'three-col' ? 'primary' : 'ghost'"
          size="small"
          @click="viewMode = 'three-col'"
          title="三列视图"
        >
          <span class="three-col-icon">
            <span class="square"></span>
            <span class="square"></span>
            <span class="square"></span>
          </span>
        </Button>
        <Button
          :variant="viewMode === 'list' ? 'primary' : 'ghost'"
          size="small"
          @click="viewMode = 'list'"
          title="列表视图"
        >
          <span class="list-icon">
            <span class="line"></span>
          </span>
        </Button>
      </div>
    </div>

    <!-- 快捷键列表 -->
    <div class="shortcut-content">
      <div v-if="filteredShortcuts.length === 0" class="shortcut-empty">
        <svg class="empty-icon"><use xlink:href="#iconSearch"></use></svg>
        <p>{{ i18n.noResults || '未找到快捷键' }}</p>
      </div>

      <div v-for="group in groupedShortcuts" :key="group.name" class="shortcut-group">
        <div class="group-header">
          <span class="group-name">{{ group.name }}</span>
          <span class="group-count">{{ group.shortcuts.length }}</span>
        </div>
        <div class="shortcut-grid" :class="{ 'list-view': viewMode === 'list', 'three-col-view': viewMode === 'three-col' }">
          <Card
            v-for="shortcut in group.shortcuts"
            :key="shortcut.id"
            variant="bordered"
            size="small"
            :class="{
              'is-favorite': isFavorite(shortcut.id),
              'is-recent': isRecent(shortcut.id)
            }"
          >
            <div class="card-header">
              <div class="shortcut-name">
                <span class="name-text">{{ shortcut.name }}</span>
                <span v-if="shortcut.platform" class="platform-badge">{{ shortcut.platform }}</span>
                <span v-if="['npm', 'nvm', 'cmd', 'vscode', 'visual-studio'].includes(shortcut.category)" class="tool-badge">{{ getCategoryLabel(shortcut.category) }}</span>
              </div>
              <div class="shortcut-actions">
                <Button
                  variant="ghost"
                  size="small"
                  :icon="isFavorite(shortcut.id) ? 'star' : 'starOutline'"
                  :class="{ active: isFavorite(shortcut.id) }"
                  :title="isFavorite(shortcut.id) ? '取消收藏' : '收藏'"
                  @click="toggleFavorite(shortcut.id)"
                />
                <Button
                  variant="ghost"
                  size="small"
                  icon="contentCopy"
                  :title="i18n.copy || '复制'"
                  @click="copyShortcutInfo(shortcut)"
                />
                <Button
                  v-if="shortcut.category === 'custom'"
                  variant="ghost"
                  size="small"
                  icon="edit"
                  :title="'编辑'"
                  @click="editShortcut(shortcut)"
                />
                <Button
                  v-if="shortcut.category === 'custom'"
                  variant="ghost"
                  size="small"
                  icon="delete"
                  :title="i18n.delete || '删除'"
                  @click="deleteShortcut(shortcut.id)"
                />
              </div>
            </div>
            <div class="shortcut-keys" @click="copyShortcutInfo(shortcut)" :title="i18n.copy || '复制'">
              <span v-for="key in shortcut.keys.split('+')" :key="key" class="key-badge">
                {{ key.trim() }}
              </span>
            </div>
            <div class="shortcut-desc">{{ shortcut.description }}</div>
          </Card>
        </div>
      </div>
    </div>

    <!-- 添加/编辑快捷键对话框 -->
    <div v-if="showDialog && (dialogType === 'add' || dialogType === 'edit')" class="shortcut-dialog-overlay" @click="closeDialog">
      <div class="shortcut-dialog" @click.stop>
        <div class="dialog-header">
          <div class="dialog-title">{{ dialogType === 'add' ? (i18n.addCustomShortcut || '添加快捷键') : '编辑快捷键' }}</div>
          <Button variant="ghost" size="small" icon="close" @click="closeDialog" />
        </div>
        <div class="dialog-body">
          <Input
            v-model="formData.name"
            :label="i18n.shortcutName || '快捷键名称'"
            :placeholder="i18n.enterName || '输入快捷键名称'"
          />
          <Input
            v-model="formData.description"
            :label="i18n.description || '描述'"
            :placeholder="i18n.enterDescription || '输入功能描述'"
          />
          <Input
            v-model="formData.keys"
            :label="i18n.shortcutKeys || '快捷键'"
            :placeholder="i18n.keysPlaceholder || '例如: Ctrl+K'"
          />
          <Input
            v-model="formData.group"
            :label="i18n.group || '分组'"
            :placeholder="i18n.enterGroup || '输入分组名称'"
          />
        </div>
        <div class="dialog-footer">
          <Button variant="secondary" @click="closeDialog">{{ i18n.cancel || '取消' }}</Button>
          <Button variant="primary" @click="addShortcut">{{ i18n.confirm || '确认' }}</Button>
        </div>
      </div>
    </div>

    <!-- 导出对话框 -->
    <div v-if="showDialog && dialogType === 'export'" class="shortcut-dialog-overlay" @click="closeDialog">
      <div class="shortcut-dialog" @click.stop>
        <div class="dialog-header">
          <div class="dialog-title">导出快捷键</div>
          <Button variant="ghost" size="small" icon="close" @click="closeDialog" />
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>导出格式</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" v-model="exportFormat" value="json" />
                <span>JSON 格式</span>
              </label>
              <label class="radio-label">
                <input type="radio" v-model="exportFormat" value="markdown" />
                <span>Markdown 表格</span>
              </label>
            </div>
          </div>
          <div class="export-preview">
            <p>将导出 {{ filteredShortcuts.length }} 个快捷键</p>
          </div>
        </div>
        <div class="dialog-footer">
          <Button variant="secondary" @click="closeDialog">取消</Button>
          <Button variant="primary" @click="exportShortcuts">导出</Button>
        </div>
      </div>
    </div>

    <!-- 导入对话框 -->
    <div v-if="showDialog && dialogType === 'import'" class="shortcut-dialog-overlay" @click="closeDialog">
      <div class="shortcut-dialog" @click.stop>
        <div class="dialog-header">
          <div class="dialog-title">导入快捷键</div>
          <Button variant="ghost" size="small" icon="close" @click="closeDialog" />
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>选择 JSON 文件</label>
            <input type="file" accept=".json" @change="handleFileImport" />
          </div>
          <div class="import-hint">
            <p>请选择符合格式的 JSON 文件</p>
          </div>
        </div>
        <div class="dialog-footer">
          <Button variant="secondary" @click="closeDialog">关闭</Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from '@/components/Button.vue'
import Input from '@/components/Input.vue'
import Select from '@/components/Select.vue'
import Card from '@/components/Card.vue'
import { getShortcutManager } from './manager'
import { loadFavorites, saveFavorites } from './storage'
import type { ShortcutGroup, ShortcutInfo } from './types'
import type { SelectOption } from '@/components/Select.vue'

interface Props {
  i18n?: Record<string, any>
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({})
})

// 搜索关键词
const searchKeyword = ref('')

// 加载收藏数据
onMounted(async () => {
  if (props.plugin) {
    try {
      const loadedFavorites = await loadFavorites(props.plugin)
      favorites.value = new Set(loadedFavorites)
    } catch (error) {
      console.error('初始化收藏数据失败:', error)
      // 失败时使用空集合，不影响其他功能
      favorites.value = new Set()
    }
  }
})

// 活跃分类
const activeTab = ref('all')

// 快捷筛选
const activeFilter = ref('all')
const quickFilters = [
  { key: 'all', label: '全部' },
  { key: 'favorite', label: '收藏' },
  { key: 'recent', label: '最近使用' }
]

// 视图模式
const viewMode = ref<'grid' | 'list' | 'three-col'>('grid')

// 分类搜索
const categorySearch = ref('')

// 对话框显示状态
const showDialog = ref(false)
const dialogType = ref<'add' | 'edit' | 'export' | 'import'>('add')

// 表单数据
const formData = ref({
  id: '',
  name: '',
  description: '',
  keys: '',
  group: '自定义'
})

// 导出格式
const exportFormat = ref<'json' | 'markdown'>('json')

// 收藏列表
const favorites = ref<Set<string>>(new Set())

// 最近使用列表
const recentUsed = ref<string[]>([])

// 获取快捷键管理器
const manager = getShortcutManager()

// 统计信息
const totalCount = computed(() => manager.getAllShortcuts().length)
const favoriteCount = computed(() => favorites.value.size)
const customCount = computed(() => manager.getByCategory('custom').length)

// 获取所有分类
const tabs = computed(() => {
  const allShortcuts = manager.getAllShortcuts()
  const categories = new Set(allShortcuts.map(s => s.category))
  return ['all', ...Array.from(categories).sort()]
})

// Select 组件的选项
const selectOptions = computed((): SelectOption[] => {
  return filteredTabs.value.map(tab => ({
    value: tab,
    label: `${getCategoryLabel(tab)} (${getTabCount(tab)})`
  }))
})

// 获取分类数量
function getTabCount(category: string): number {
  if (category === 'all') return totalCount.value
  return manager.getByCategory(category).length
}

// 过滤分类选项
const filteredTabs = computed(() => {
  const allTabs = tabs.value
  if (!categorySearch.value) {
    // 清空搜索时，确保 activeTab 有效
    if (!allTabs.includes(activeTab.value) && allTabs.length > 0) {
      activeTab.value = allTabs[0]
    }
    return allTabs
  }

  const filtered = allTabs.filter(tab => {
    const label = getCategoryLabel(tab).toLowerCase()
    return label.includes(categorySearch.value.toLowerCase())
  })

  // 如果当前选中的分类不在搜索结果中，且有搜索结果，则自动选择第一个
  if (filtered.length > 0 && !filtered.includes(activeTab.value)) {
    activeTab.value = filtered[0]
  }

  return filtered
})

// 分类标签映射
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
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
  }
  return labels[category] || category
}

// 按分类和搜索过滤的快捷键
const filteredShortcuts = computed(() => {
  let shortcuts = manager.getAllShortcuts()

  // 按分类过滤
  if (activeTab.value !== 'all') {
    shortcuts = shortcuts.filter(s => s.category === activeTab.value)
  }

  // 按搜索关键词过滤
  if (searchKeyword.value) {
    shortcuts = manager.search(searchKeyword.value)
      .filter(s => activeTab.value === 'all' || s.category === activeTab.value)
  }

  // 按快捷筛选过滤
  if (activeFilter.value === 'favorite') {
    shortcuts = shortcuts.filter(s => favorites.value.has(s.id))
  } else if (activeFilter.value === 'recent') {
    shortcuts = shortcuts.filter(s => recentUsed.value.includes(s.id))
  }

  return shortcuts
})

// 按分组组织快捷键
const groupedShortcuts = computed((): ShortcutGroup[] => {
  const groupMap = new Map<string, typeof filteredShortcuts.value>()

  filteredShortcuts.value.forEach(shortcut => {
    const group = shortcut.group || (props.i18n.other || '其他')
    if (!groupMap.has(group)) {
      groupMap.set(group, [])
    }
    groupMap.get(group)!.push(shortcut)
  })

  return Array.from(groupMap.entries()).map(([name, shortcuts]) => ({
    name,
    shortcuts
  }))
})

// 显示添加对话框
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

// 显示编辑对话框
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

// 显示导出对话框
function showExportDialog() {
  dialogType.value = 'export'
  showDialog.value = true
}

// 显示导入对话框
function showImportDialog() {
  dialogType.value = 'import'
  showDialog.value = true
}

// 关闭对话框
function closeDialog() {
  showDialog.value = false
}

// 添加或编辑快捷键
async function addShortcut() {
  if (!formData.value.name || !formData.value.keys) {
    alert(props.i18n.fillRequired || '请填写必填项')
    return
  }

  const shortcut: ShortcutInfo = {
    id: formData.value.id || `custom_${Date.now()}`,
    name: formData.value.name,
    description: formData.value.description,
    keys: formData.value.keys,
    category: 'custom',
    group: formData.value.group || '自定义'
  }

  await manager.addShortcut(shortcut)
  closeDialog()
}

// 删除快捷键
async function deleteShortcut(id: string) {
  if (confirm(props.i18n.confirmDelete || '确认删除此快捷键？')) {
    await manager.removeShortcut(id)
    // 从收藏中移除
    favorites.value.delete(id)
    // 从最近使用中移除
    const index = recentUsed.value.indexOf(id)
    if (index > -1) recentUsed.value.splice(index, 1)

    // 更新收藏数据到持久化存储
    if (props.plugin) {
      try {
        await saveFavorites(props.plugin, Array.from(favorites.value))
      } catch (error) {
        console.error('更新收藏数据失败:', error)
      }
    }
  }
}

// 刷新快捷键列表
function refreshShortcuts() {
  // 重新加载快捷键数据
}

// 收藏相关
function isFavorite(id: string): boolean {
  return favorites.value.has(id)
}

async function toggleFavorite(id: string) {
  // 切换收藏状态
  if (favorites.value.has(id)) {
    favorites.value.delete(id)
  } else {
    favorites.value.add(id)
  }

  // 保存到持久化存储
  if (props.plugin) {
    try {
      await saveFavorites(props.plugin, Array.from(favorites.value))
    } catch (error) {
      console.error('保存收藏状态失败:', error)
      // 不影响界面更新，只记录错误
    }
  }
}

// 最近使用
function isRecent(id: string): boolean {
  return recentUsed.value.includes(id)
}

function addToRecent(id: string) {
  const index = recentUsed.value.indexOf(id)
  if (index > -1) recentUsed.value.splice(index, 1)
  recentUsed.value.unshift(id)
  if (recentUsed.value.length > 10) recentUsed.value.pop()
}


// 复制快捷键信息
function copyShortcutInfo(shortcut: ShortcutInfo) {
  // 优先复制 copyContent，如果没有则复制 keys（向后兼容）
  const text = shortcut.copyContent || shortcut.keys
  navigator.clipboard.writeText(text).then(() => {
    // 添加到最近使用
    addToRecent(shortcut.id)
    // 显示复制成功提示
    showCopyTip()
  }).catch(err => {
    console.error('复制失败:', err)
  })
}

// 导出快捷键
function exportShortcuts() {
  const shortcuts = activeTab.value === 'all'
    ? manager.getAllShortcuts()
    : manager.getByCategory(activeTab.value)

  if (exportFormat.value === 'json') {
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

// 分组快捷键
function groupShortcuts(shortcuts: ShortcutInfo[]): ShortcutGroup[] {
  const groupMap = new Map<string, ShortcutInfo[]>()
  shortcuts.forEach(shortcut => {
    const group = shortcut.group || ('其他')
    if (!groupMap.has(group)) groupMap.set(group, [])
    groupMap.get(group)!.push(shortcut)
  })
  return Array.from(groupMap.entries()).map(([name, shortcuts]) => ({
    name,
    shortcuts
  }))
}

// 处理文件导入
async function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text) as ShortcutInfo[]

    if (!Array.isArray(data)) {
      alert('文件格式错误')
      return
    }

    await manager.addShortcuts(data)
    alert(`成功导入 ${data.length} 个快捷键`)
    closeDialog()
  } catch (error) {
    console.error('导入失败:', error)
    alert('导入失败，请检查文件格式')
  }
}

// 显示复制成功提示
let copyTipTimer: any
const showCopyTip = () => {
  clearTimeout(copyTipTimer)
  // 这里可以集成思源笔记的 showMessage 或其他提示方案
  // 为了保持组件独立，这里仅通过 console 记录
}
</script>

<style scoped>
.shortcut-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  overflow: hidden;
}

.shortcut-header {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}

.header-actions {
  display: flex;
  gap: 6px;
}

.shortcut-stats {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  background: linear-gradient(135deg, var(--b3-theme-primary-lightest) 0%, var(--b3-theme-surface) 100%);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 12px;
  background: var(--b3-theme-background);
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface-variant);
  font-weight: 500;
  text-transform: uppercase;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--b3-theme-primary);
}

.shortcut-category-selector {
  padding: 8px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}

.selector-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.selector-header label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  white-space: nowrap;
}

.selector-control {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-result-hint {
  flex-basis: 100%;
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
  font-style: italic;
  margin-top: -4px;
  margin-left: 4px;
}

.shortcut-filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.filter-group {
  display: flex;
  gap: 6px;
}

.view-toggle {
  display: flex;
  gap: 3px;
  background: var(--b3-theme-background);
  border-radius: 6px;
  padding: 2px;
}

.grid-icon,
.three-col-icon,
.list-icon {
  display: flex;
  align-items: center;
  gap: 2px;
}

.square {
  width: 4px;
  height: 4px;
  background-color: currentColor;
  border-radius: 1px;
  display: inline-block;
}

.line {
  width: 8px;
  height: 4px;
  background-color: currentColor;
  border-radius: 1px;
  display: inline-block;
}

.shortcut-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.shortcut-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--b3-theme-on-surface-variant);
  font-size: 12px;
  gap: 12px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  opacity: 0.3;
}

.shortcut-group {
  padding: 0;
  margin-bottom: 16px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--b3-theme-primary);
  text-transform: uppercase;
  letter-spacing: 1px;
  background: var(--b3-theme-surface);
  position: sticky;
  top: 0;
  z-index: 10;
  border-left: 4px solid var(--b3-theme-primary);
}

.group-name {
  flex: 1;
}

.group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--b3-theme-primary);
  color: white;
  border-radius: 10px;
  font-size: 10px;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 12px;
}

.shortcut-grid.list-view {
  grid-template-columns: 1fr;
}

.shortcut-grid.three-col-view {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 1200px) {
  .shortcut-grid.three-col-view {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 800px) {
  .shortcut-grid.three-col-view {
    grid-template-columns: 1fr;
  }
}

.is-favorite {
  background: linear-gradient(135deg, var(--b3-theme-surface) 0%, var(--b3-theme-primary-lightest) 100%);
}

.is-recent {
  border-left: 3px solid var(--b3-theme-primary);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.shortcut-name {
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  line-height: 1.3;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.name-text {
  flex: 1;
}

.platform-badge {
  display: inline-block;
  padding: 2px 6px;
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface-variant);
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
}

.tool-badge {
  display: inline-block;
  padding: 2px 6px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
}

.shortcut-desc {
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.shortcut-keys {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  cursor: pointer;
  transition: opacity 0.2s;
}

.shortcut-keys:hover {
  opacity: 0.8;
}

.shortcut-keys:active {
  opacity: 0.6;
}

.key-badge {
  display: inline-block;
  padding: 4px 8px;
  background: linear-gradient(135deg, var(--b3-theme-primary) 0%, var(--b3-theme-primary-light) 100%);
  color: white;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}

.shortcut-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 1;
  transition: opacity 0.2s;
}

.shortcut-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.shortcut-dialog {
  background: var(--b3-theme-background);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 450px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: dialogSlideIn 0.3s ease-out;
}

@keyframes dialogSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.dialog-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.dialog-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 12px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 4px;
}

.form-group input[type="file"] {
  width: 100%;
  padding: 8px;
  border: 1px dashed var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.form-group input[type="file"]:hover {
  border-color: var(--b3-theme-primary);
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-label:hover {
  background: var(--b3-theme-surface);
  border-color: var(--b3-theme-primary);
}

.radio-label input[type="radio"] {
  margin: 0;
  cursor: pointer;
}

.export-preview,
.import-hint {
  padding: 12px;
  background: var(--b3-theme-surface);
  border-radius: 4px;
  border-left: 3px solid var(--b3-theme-primary);
}

.export-preview p,
.import-hint p {
  margin: 0;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
}

.dialog-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}

.shortcut-content::-webkit-scrollbar,
.dialog-body::-webkit-scrollbar {
  width: 5px;
}

.shortcut-content::-webkit-scrollbar-track,
.dialog-body::-webkit-scrollbar-track {
  background: transparent;
}

.shortcut-content::-webkit-scrollbar-thumb,
.dialog-body::-webkit-scrollbar-thumb {
  background: var(--b3-theme-surface-lighter);
  border-radius: 2px;
}

.shortcut-content::-webkit-scrollbar-thumb:hover {
  background: var(--b3-theme-on-surface-variant);
}
</style>
