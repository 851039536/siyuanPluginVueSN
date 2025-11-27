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
      <button class="shortcut-add-btn" :title="i18n.addCustomShortcut || '添加快捷键'" @click="showAddDialog">
        <svg class="shortcut-icon"><use xlink:href="#iconAdd"></use></svg>
      </button>
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
        {{ getCategoryLabel(tab) }}
      </button>
    </div>

    <!-- 快捷键列表 -->
    <div class="shortcut-content">
      <div v-if="filteredShortcuts.length === 0" class="shortcut-empty">
        <p>{{ i18n.noResults || '未找到快捷键' }}</p>
      </div>

      <div v-for="group in groupedShortcuts" :key="group.name" class="shortcut-group">
        <div class="group-header">{{ group.name }}</div>
        <div
          v-for="shortcut in group.shortcuts"
          :key="shortcut.id"
          class="shortcut-row"
        >
          <div class="shortcut-info">
            <div class="shortcut-name">{{ shortcut.name }}</div>
            <div class="shortcut-desc">{{ shortcut.description }}</div>
          </div>
          <div class="shortcut-keys">
            <span v-for="key in shortcut.keys.split('+')" :key="key" class="key-badge">
              {{ key.trim() }}
            </span>
          </div>
          <div class="shortcut-actions">
            <button
              class="action-btn copy-btn"
              :title="i18n.copy || '复制'"
              @click="copyShortcutInfo(shortcut)"
            >
              <svg class="shortcut-icon"><use xlink:href="#iconCopy"></use></svg>
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
      </div>
    </div>

    <!-- 添加快捷键对话框 -->
    <div v-if="showDialog" class="shortcut-dialog-overlay" @click="closeDialog">
      <div class="shortcut-dialog" @click.stop>
        <div class="dialog-header">
          <div class="dialog-title">{{ i18n.addCustomShortcut || '添加快捷键' }}</div>
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

// 对话框显示状态
const showDialog = ref(false)

// 表单数据
const formData = ref({
  name: '',
  description: '',
  keys: '',
  group: '自定义'
})

// 获取快捷键管理器
const manager = getShortcutManager()

// 获取所有分类
const tabs = computed(() => {
  const allShortcuts = manager.getAllShortcuts()
  const categories = new Set(allShortcuts.map(s => s.category))
  return ['all', ...Array.from(categories).sort()]
})

// 分类标签映射
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'all': props.i18n.allShortcuts || '全部',
    'siyuan': props.i18n.siyuanShortcuts || '思源笔记',
    'plugin': props.i18n.pluginShortcuts || '插件快捷键',
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
  formData.value = {
    name: '',
    description: '',
    keys: '',
    group: '自定义'
  }
  showDialog.value = true
}

// 关闭对话框
function closeDialog() {
  showDialog.value = false
}

// 添加快捷键
async function addShortcut() {
  if (!formData.value.name || !formData.value.keys) {
    alert(props.i18n.fillRequired || '请填写必填项')
    return
  }

  const shortcut: ShortcutInfo = {
    id: `custom_${Date.now()}`,
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
  }
}

// 复制快捷键信息
function copyShortcutInfo(shortcut: ShortcutInfo) {
  const text = `${shortcut.name}: ${shortcut.keys}`
  navigator.clipboard.writeText(text).then(() => {
    // 显示复制成功提示
    showCopyTip()
  }).catch(err => {
    console.error('复制失败:', err)
  })
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
  font-size: 12px;
  overflow: hidden;
}

.shortcut-header {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}

.shortcut-search-input {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 3px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 11px;
  outline: none;
  transition: border-color 0.2s;
}

.shortcut-search-input:focus {
  border-color: var(--b3-theme-primary);
}

.shortcut-search-input::placeholder {
  color: var(--b3-theme-on-surface-variant);
}

.shortcut-add-btn {
  padding: 5px 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 3px;
  background: transparent;
  color: var(--b3-theme-primary);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shortcut-add-btn:hover {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-background);
  border-color: var(--b3-theme-primary);
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
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--b3-theme-on-surface-variant);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.category-tab:hover {
  color: var(--b3-theme-on-surface);
}

.category-tab.active {
  color: var(--b3-theme-primary);
  border-bottom-color: var(--b3-theme-primary);
}

.shortcut-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.shortcut-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: var(--b3-theme-on-surface-variant);
  font-size: 12px;
}

.shortcut-group {
  padding: 0;
}

.group-header {
  padding: 5px 10px 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--b3-theme-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
  position: sticky;
  top: 0;
}

.shortcut-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  transition: background 0.2s;
}

.shortcut-row:hover {
  background: var(--b3-theme-surface);
}

.shortcut-info {
  flex: 1;
  min-width: 0;
}

.shortcut-name {
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  font-size: 11px;
  margin-bottom: 1px;
}

.shortcut-desc {
  font-size: 10px;
  color: var(--b3-theme-on-surface-variant);
  line-height: 1.3;
}

.shortcut-keys {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.key-badge {
  display: inline-block;
  padding: 1px 4px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-background);
  border-radius: 2px;
  font-size: 9px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-weight: 600;
  white-space: nowrap;
}

.shortcut-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  padding: 4px 6px;
  background: transparent;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 3px;
  color: var(--b3-theme-on-surface-variant);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0;
}

.action-btn:hover {
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-primary);
  border-color: var(--b3-theme-primary);
}

.copy-btn {
  color: var(--b3-theme-on-surface-variant);
}

.copy-btn:active {
  background: var(--b3-theme-primary);
  color: white;
  border-color: var(--b3-theme-primary);
}

.delete-btn {
  color: #ff6b6b;
}

.delete-btn:hover {
  background: #ff6b6b;
  color: white;
  border-color: #ff6b6b;
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
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
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

.form-group input::placeholder {
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
