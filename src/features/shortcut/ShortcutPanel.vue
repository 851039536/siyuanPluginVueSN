<template>
  <div class="shortcut-panel">
    <!-- 顶部操作栏 -->
    <div class="shortcut-header">
      <input
        v-model="searchKeyword"
        type="text"
        class="shortcut-search-input"
        :placeholder="i18n.searchPlaceholder || '搜索快捷键...'"
      />
      <div class="header-actions">
        <button class="icon-btn" :title="'刷新'" @click="refreshShortcuts">
          <svg class="shortcut-icon"><use xlink:href="#iconRefresh"></use></svg>
        </button>
        <button class="icon-btn" :title="'导出'" @click="showExportDialog">
          <svg class="shortcut-icon"><use xlink:href="#iconDownload"></use></svg>
        </button>
        <button class="icon-btn" :title="'导入'" @click="showImportDialog">
          <svg class="shortcut-icon"><use xlink:href="#iconUpload"></use></svg>
        </button>
        <button class="shortcut-add-btn" :title="i18n.addCustomShortcut || '添加快捷键'" @click="showAddDialog">
          <svg class="shortcut-icon"><use xlink:href="#iconAdd"></use></svg>
        </button>
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
      <div class="stat-item" v-if="conflictCount > 0">
        <span class="stat-label conflict">冲突</span>
        <span class="stat-value conflict">{{ conflictCount }}</span>
      </div>
    </div>

    <!-- 分类标签 -->
    <div class="shortcut-category-tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        class="category-tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        <span class="tab-label">{{ getCategoryLabel(tab) }}</span>
        <span class="tab-count">{{ getTabCount(tab) }}</span>
      </button>
    </div>

    <!-- 快捷筛选栏 -->
    <div class="shortcut-filters">
      <div class="filter-group">
        <button
          v-for="filter in quickFilters"
          :key="filter.key"
          class="filter-btn"
          :class="{ active: activeFilter === filter.key }"
          @click="activeFilter = filter.key"
        >
          {{ filter.label }}
        </button>
      </div>
      <div class="view-toggle">
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'grid' }"
          @click="viewMode = 'grid'"
          title="网格视图"
        >
          <svg class="shortcut-icon"><use xlink:href="#iconMenu"></use></svg>
        </button>
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'list' }"
          @click="viewMode = 'list'"
          title="列表视图"
        >
          <svg class="shortcut-icon"><use xlink:href="#iconList"></use></svg>
        </button>
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
        <div class="shortcut-grid" :class="{ 'list-view': viewMode === 'list' }">
          <div
            v-for="shortcut in group.shortcuts"
            :key="shortcut.id"
            class="shortcut-card"
            :class="{
              'is-favorite': isFavorite(shortcut.id),
              'is-recent': isRecent(shortcut.id),
              'has-conflict': hasConflict(shortcut.keys)
            }"
          >
            <div class="card-header">
              <div class="shortcut-name">
                <span class="name-text">{{ shortcut.name }}</span>
                <span v-if="shortcut.platform" class="platform-badge">{{ shortcut.platform }}</span>
              </div>
              <div class="shortcut-actions">
                <button
                  class="action-btn favorite-btn"
                  :class="{ active: isFavorite(shortcut.id) }"
                  :title="isFavorite(shortcut.id) ? '取消收藏' : '收藏'"
                  @click="toggleFavorite(shortcut.id)"
                >
                  <svg class="shortcut-icon"><use :xlink:href="isFavorite(shortcut.id) ? '#iconStar' : '#iconStarOutline'"></use></svg>
                </button>
                <button
                  class="action-btn copy-btn"
                  :title="i18n.copy || '复制'"
                  @click="copyShortcutInfo(shortcut)"
                >
                  <svg class="shortcut-icon"><use xlink:href="#iconCopy"></use></svg>
                </button>
                <button
                  v-if="shortcut.category === 'custom'"
                  class="action-btn edit-btn"
                  :title="'编辑'"
                  @click="editShortcut(shortcut)"
                >
                  <svg class="shortcut-icon"><use xlink:href="#iconEdit"></use></svg>
                </button>
                <button
                  v-if="shortcut.category === 'custom'"
                  class="action-btn delete-btn"
                  :title="i18n.delete || '删除'"
                  @click="deleteShortcut(shortcut.id)"
                >
                  <svg class="shortcut-icon"><use xlink:href="#iconTrash"></use></svg>
                </button>
              </div>
            </div>
            <div class="shortcut-keys" @click="copyShortcutInfo(shortcut)" :title="i18n.copy || '复制'">
              <span v-for="key in shortcut.keys.split('+')" :key="key" class="key-badge">
                {{ key.trim() }}
              </span>
              <span v-if="hasConflict(shortcut.keys)" class="conflict-badge" title="快捷键冲突">⚠️</span>
            </div>
            <div class="shortcut-desc">{{ shortcut.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑快捷键对话框 -->
    <div v-if="showDialog && (dialogType === 'add' || dialogType === 'edit')" class="shortcut-dialog-overlay" @click="closeDialog">
      <div class="shortcut-dialog" @click.stop>
        <div class="dialog-header">
          <div class="dialog-title">{{ dialogType === 'add' ? (i18n.addCustomShortcut || '添加快捷键') : '编辑快捷键' }}</div>
          <button class="close-btn" @click="closeDialog">
            <svg class="shortcut-icon"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>{{ i18n.shortcutName || '快捷键名称' }}</label>
            <input v-model="formData.name" type="text" :placeholder="i18n.enterName || '输入快捷键名称'" />
          </div>
          <div class="form-group">
            <label>{{ i18n.description || '描述' }}</label>
            <input v-model="formData.description" type="text" :placeholder="i18n.enterDescription || '输入功能描述'" />
          </div>
          <div class="form-group">
            <label>{{ i18n.shortcutKeys || '快捷键' }}</label>
            <input v-model="formData.keys" type="text" :placeholder="i18n.keysPlaceholder || '例如: Ctrl+K'" />
          </div>
          <div class="form-group">
            <label>{{ i18n.group || '分组' }}</label>
            <input v-model="formData.group" type="text" :placeholder="i18n.enterGroup || '输入分组名称'" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" @click="closeDialog">{{ i18n.cancel || '取消' }}</button>
          <button class="btn-confirm" @click="addShortcut">{{ i18n.confirm || '确认' }}</button>
        </div>
      </div>
    </div>

    <!-- 导出对话框 -->
    <div v-if="showDialog && dialogType === 'export'" class="shortcut-dialog-overlay" @click="closeDialog">
      <div class="shortcut-dialog" @click.stop>
        <div class="dialog-header">
          <div class="dialog-title">导出快捷键</div>
          <button class="close-btn" @click="closeDialog">
            <svg class="shortcut-icon"><use xlink:href="#iconClose"></use></svg>
          </button>
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
          <button class="btn-cancel" @click="closeDialog">取消</button>
          <button class="btn-confirm" @click="exportShortcuts">导出</button>
        </div>
      </div>
    </div>

    <!-- 导入对话框 -->
    <div v-if="showDialog && dialogType === 'import'" class="shortcut-dialog-overlay" @click="closeDialog">
      <div class="shortcut-dialog" @click.stop>
        <div class="dialog-header">
          <div class="dialog-title">导入快捷键</div>
          <button class="close-btn" @click="closeDialog">
            <svg class="shortcut-icon"><use xlink:href="#iconClose"></use></svg>
          </button>
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
          <button class="btn-cancel" @click="closeDialog">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getShortcutManager } from './manager'
import type { ShortcutGroup, ShortcutInfo } from './types'

interface Props {
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({})
})

// 搜索关键词
const searchKeyword = ref('')

// 活跃分类
const activeTab = ref('all')

// 快捷筛选
const activeFilter = ref('all')
const quickFilters = [
  { key: 'all', label: '全部' },
  { key: 'favorite', label: '收藏' },
  { key: 'recent', label: '最近使用' },
  { key: 'conflict', label: '冲突' }
]

// 视图模式
const viewMode = ref<'grid' | 'list'>('grid')

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
const conflictCount = computed(() => {
  const shortcuts = manager.getAllShortcuts()
  const keyMap = new Map<string, number>()
  shortcuts.forEach(s => {
    const count = keyMap.get(s.keys) || 0
    keyMap.set(s.keys, count + 1)
  })
  return Array.from(keyMap.values()).filter(count => count > 1).length
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

// 分类标签映射
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'all': props.i18n.allShortcuts || '全部',
    'siyuan': props.i18n.siyuanShortcuts || '思源笔记',
    'plugin': props.i18n.pluginShortcuts || '插件快捷键',
    'claude': props.i18n.claudeShortcuts || 'Claude Code',
    'openspec': props.i18n.openspecShortcuts || 'OpenSpec',
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
  } else if (activeFilter.value === 'conflict') {
    const conflictKeys = new Set<string>()
    const keyMap = new Map<string, number>()
    manager.getAllShortcuts().forEach(s => {
      const count = keyMap.get(s.keys) || 0
      keyMap.set(s.keys, count + 1)
      if (count >= 1) conflictKeys.add(s.keys)
    })
    shortcuts = shortcuts.filter(s => conflictKeys.has(s.keys))
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
    favorites.value.delete(id)
    const index = recentUsed.value.indexOf(id)
    if (index > -1) recentUsed.value.splice(index, 1)
  }
}

// 刷新快捷键列表
function refreshShortcuts() {
  // 重新加载快捷键数据
  console.log('刷新快捷键列表')
}

// 收藏相关
function isFavorite(id: string): boolean {
  return favorites.value.has(id)
}

function toggleFavorite(id: string) {
  if (favorites.value.has(id)) {
    favorites.value.delete(id)
  } else {
    favorites.value.add(id)
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

// 冲突检测
function hasConflict(keys: string): boolean {
  const shortcuts = manager.getAllShortcuts()
  return shortcuts.filter(s => s.keys === keys).length > 1
}

// 复制快捷键信息
function copyShortcutInfo(shortcut: ShortcutInfo) {
  const text = shortcut.keys
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
  console.log('快捷键信息已复制')
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

.icon-btn {
  padding: 8px 10px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: var(--b3-theme-surface);
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-primary);
  transform: translateY(-1px);
}

/* 统计信息栏 */
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

.stat-label.conflict {
  color: #ff6b6b;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--b3-theme-primary);
}

.stat-value.conflict {
  color: #ff6b6b;
}

.shortcut-search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}

.shortcut-search-input:focus {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.shortcut-search-input::placeholder {
  color: var(--b3-theme-on-surface-variant);
}

.shortcut-add-btn {
  padding: 8px 12px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 6px;
  background: var(--b3-theme-primary);
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shortcut-add-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.shortcut-icon {
  width: 14px;
  height: 14px;
}

.shortcut-category-tabs {
  display: flex;
  gap: 0;
  padding: 0;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  overflow-x: auto;
  background: var(--b3-theme-surface);
}

.category-tab {
  flex: 0 0 auto;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--b3-theme-on-surface-variant);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.category-tab:hover {
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface-lighter);
}

.category-tab.active {
  color: var(--b3-theme-primary);
  border-bottom-color: var(--b3-theme-primary);
  font-weight: 600;
}

.tab-label {
  display: inline-block;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--b3-theme-primary-lighter);
  color: var(--b3-theme-primary);
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;
}

.category-tab.active .tab-count {
  background: var(--b3-theme-primary);
  color: white;
}

/* 筛选栏 */
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

.filter-btn {
  padding: 5px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 15px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: var(--b3-theme-surface);
  border-color: var(--b3-theme-primary);
}

.filter-btn.active {
  background: var(--b3-theme-primary);
  color: white;
  border-color: var(--b3-theme-primary);
}

.view-toggle {
  display: flex;
  gap: 4px;
  background: var(--b3-theme-background);
  border-radius: 6px;
  padding: 2px;
}

.toggle-btn {
  padding: 5px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface-variant);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-btn:hover {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
}

.toggle-btn.active {
  background: var(--b3-theme-primary);
  color: white;
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

.shortcut-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.shortcut-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--b3-theme-primary), var(--b3-theme-primary-light));
  opacity: 0;
  transition: opacity 0.2s;
}

.shortcut-card:hover::before {
  opacity: 1;
}

.shortcut-card:hover {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.shortcut-card.is-favorite {
  background: linear-gradient(135deg, var(--b3-theme-surface) 0%, var(--b3-theme-primary-lightest) 100%);
}

.shortcut-card.is-recent {
  border-left: 3px solid var(--b3-theme-primary);
}

.shortcut-card.has-conflict {
  border-color: #ff6b6b;
  background: linear-gradient(135deg, var(--b3-theme-surface) 0%, rgba(255, 107, 107, 0.05) 100%);
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
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}

.conflict-badge {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
}

.shortcut-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.shortcut-card:hover .shortcut-actions {
  opacity: 1;
}

.action-btn {
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--b3-theme-on-surface-variant);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0;
}

.action-btn:hover {
  background: var(--b3-theme-background);
  color: var(--b3-theme-primary);
  transform: scale(1.1);
}

.favorite-btn.active {
  color: #ffd700;
}

.favorite-btn.active:hover {
  color: #ffed4e;
}

.copy-btn:active {
  background: var(--b3-theme-primary);
  color: white;
}

.edit-btn:hover {
  background: var(--b3-theme-primary-lighter);
  color: var(--b3-theme-primary);
}

.delete-btn:hover {
  background: #ff6b6b;
  color: white;
}

/* 对话框样式 */
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

.close-btn {
  background: transparent;
  border: none;
  color: var(--b3-theme-on-surface-variant);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close-btn:hover {
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

.form-group input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 3px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: var(--b3-theme-primary);
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

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: transparent;
  color: var(--b3-theme-on-surface);
}

.btn-cancel:hover {
  background: var(--b3-theme-background);
  border-color: var(--b3-theme-on-surface);
}

.btn-confirm {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-background);
  border-color: var(--b3-theme-primary);
}

.btn-confirm:hover {
  opacity: 0.9;
}

/* 滚动条样式 */
.shortcut-content::-webkit-scrollbar {
  width: 5px;
}

.shortcut-content::-webkit-scrollbar-track {
  background: transparent;
}

.shortcut-content::-webkit-scrollbar-thumb {
  background: var(--b3-theme-surface-lighter);
  border-radius: 2px;
}

.shortcut-content::-webkit-scrollbar-thumb:hover {
  background: var(--b3-theme-on-surface-variant);
}

.dialog-body::-webkit-scrollbar {
  width: 5px;
}

.dialog-body::-webkit-scrollbar-track {
  background: transparent;
}

.dialog-body::-webkit-scrollbar-thumb {
  background: var(--b3-theme-surface-lighter);
  border-radius: 2px;
}
</style>
