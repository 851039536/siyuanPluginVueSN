<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="everything-search-overlay" @click.self="closeDialog">
        <Transition name="scale">
          <div v-if="visible" class="everything-search-dialog">
            <!-- 头部 -->
            <div class="dialog-header">
              <div class="header-title">
                <span class="title-icon">🔍</span>
                <span>Everything 本地搜索</span>
              </div>
              <button class="close-btn" @click="closeDialog">
                <svg class="close-icon"><use xlink:href="#iconClose"></use></svg>
              </button>
            </div>

            <!-- 搜索栏 -->
            <div class="search-bar">
              <div class="search-input-wrapper">
                <svg class="search-icon"><use xlink:href="#iconSearch"></use></svg>
                <input
                  ref="searchInputRef"
                  v-model="searchQuery"
                  type="text"
                  class="search-input"
                  placeholder="输入关键词搜索本地文件..."
                  @keyup.enter="handleSearch"
                  @keyup.esc="closeDialog"
                />
                <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
                  <svg class="clear-icon"><use xlink:href="#iconClose"></use></svg>
                </button>
              </div>
              <button class="search-btn" @click="handleSearch" :disabled="isSearching || !searchQuery.trim()">
                <span v-if="isSearching" class="loading-spinner"></span>
                <span v-else>{{ options.autoSearch ? '立即搜索' : '搜索' }}</span>
              </button>
            </div>

            <!-- 搜索选项 -->
            <div class="search-options">
              <label class="option-item">
                <input type="checkbox" v-model="options.autoSearch" />
                <span>自动搜索</span>
              </label>
              <label class="option-item">
                <input type="checkbox" v-model="options.matchCase" />
                <span>区分大小写</span>
              </label>
              <label class="option-item">
                <input type="checkbox" v-model="options.matchWholeWord" />
                <span>全词匹配</span>
              </label>
              <label class="option-item">
                <input type="checkbox" v-model="options.matchPath" />
                <span>匹配路径</span>
              </label>
              <label class="option-item">
                <input type="checkbox" v-model="options.regex" />
                <span>正则表达式</span>
              </label>
              <div class="option-item results-count">
                <span>最大结果:</span>
                <select v-model="options.maxResults" class="results-select">
                  <option :value="50">50</option>
                  <option :value="100">100</option>
                  <option :value="200">200</option>
                  <option :value="500">500</option>
                </select>
              </div>
              <div class="option-item debounce-delay" v-if="options.autoSearch">
                <span>延迟:</span>
                <select v-model="options.debounceDelay" class="delay-select">
                  <option :value="200">200ms</option>
                  <option :value="500">500ms</option>
                  <option :value="1000">1s</option>
                </select>
              </div>
            </div>

            <!-- 服务状态提示 -->
            <div v-if="!serviceAvailable" class="service-warning">
              <span class="warning-icon">⚠️</span>
              <span>Everything HTTP服务未启动。请确保Everything已安装并启用HTTP服务器（工具 → 选项 → HTTP服务器）。</span>
              <button class="retry-btn" @click="checkService">重试</button>
            </div>

            <!-- 结果区域 -->
            <div class="results-area">
              <!-- 加载状态 -->
              <div v-if="isSearching" class="loading-state">
                <div class="loading-spinner-large"></div>
                <p>正在搜索...</p>
              </div>

              <!-- 错误状态 -->
              <div v-else-if="errorMessage" class="error-state">
                <span class="error-icon">❌</span>
                <p>{{ errorMessage }}</p>
              </div>

              <!-- 空状态 -->
              <div v-else-if="!hasSearched" class="empty-state">
                <span class="empty-icon">📁</span>
                <p>{{ options.autoSearch ? '输入关键词自动搜索本地文件' : '输入关键词点击搜索按钮搜索本地文件' }}</p>
                <p class="hint">支持通配符: * 匹配任意字符, ? 匹配单个字符</p>
              </div>

              <!-- 无结果 -->
              <div v-else-if="results.length === 0" class="empty-state">
                <span class="empty-icon">🔍</span>
                <p>未找到匹配的文件</p>
              </div>

              <!-- 结果列表 -->
              <div v-else class="results-list">
                <div class="results-header">
                  <span class="results-count-text">找到 {{ results.length }} 个结果</span>
                </div>
                <div class="results-scroll">
                  <div
                    v-for="(item, index) in results"
                    :key="index"
                    class="result-item"
                    @click="handleItemClick(item)"
                    @dblclick="openItem(item)"
                  >
                    <div class="item-icon" :class="getIconClass(item)">
                      {{ getIconEmoji(item) }}
                    </div>
                    <div class="item-info">
                      <div class="item-name" :title="item.name">{{ item.name }}</div>
                      <div class="item-path" :title="getFullPath(item)">{{ item.path }}</div>
                    </div>
                    <div class="item-meta">
                      <span class="item-size" v-if="item.type === 'file'">{{ formatSize(item.size) }}</span>
                      <span class="item-date">{{ item.dateModified }}</span>
                    </div>
                    <div class="item-actions">
                      <button class="action-btn" @click.stop="openItem(item)" title="打开">
                        <svg class="action-icon"><use xlink:href="#iconOpen"></use></svg>
                      </button>
                      <button class="action-btn" @click.stop="showInFolder(item)" title="在资源管理器中显示">
                        <svg class="action-icon"><use xlink:href="#iconFolder"></use></svg>
                      </button>
                      <button class="action-btn" @click.stop="copyPath(item)" title="复制路径">
                        <svg class="action-icon"><use xlink:href="#iconCopy"></use></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部配置 -->
            <div class="dialog-footer">
              <div class="config-section">
                <span class="config-label">服务地址:</span>
                <input
                  v-model="config.host"
                  type="text"
                  class="config-input"
                  placeholder="localhost"
                />
                <span class="config-label">端口:</span>
                <input
                  v-model.number="config.port"
                  type="number"
                  class="config-input port-input"
                  placeholder="80"
                />
              </div>
              <div class="footer-actions">
                <span class="shortcut-hint">Esc 关闭 | Enter 搜索</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { showMessage } from 'siyuan'
import {
  searchFiles,
  checkEverythingService,
  formatFileSize,
  getFileIconType,
  openFile,
  showInExplorer,
  type EverythingSearchResult,
  type EverythingConfig
} from './api'
import { usePlugin } from '@/main'

// Props
interface Props {
  visible: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}>()

// Refs
const searchInputRef = ref<HTMLInputElement | null>(null)

// 配置存储键
const CONFIG_STORAGE_KEY = 'everything-search-config'
const OPTIONS_STORAGE_KEY = 'everything-search-options'

// 获取插件实例
const plugin = usePlugin()

// 状态
const searchQuery = ref('')
const results = ref<EverythingSearchResult[]>([])
const isSearching = ref(false)
const errorMessage = ref('')
const hasSearched = ref(false)
const serviceAvailable = ref(true)
const debounceTimer = ref<number | null>(null)
const autoSearchEnabled = ref(true)

// 配置
const config = reactive<EverythingConfig>({
  host: 'localhost',
  port: 80
})

// 搜索选项
const options = reactive({
  matchCase: false,
  matchWholeWord: false,
  matchPath: false,
  regex: false,
  maxResults: 100,
  autoSearch: true,
  debounceDelay: 500
})

// 从插件存储加载配置
const loadConfigFromPlugin = async () => {
  try {
    const configData = await plugin.loadData(CONFIG_STORAGE_KEY)
    if (configData) {
      config.host = configData.host || 'localhost'
      config.port = configData.port || 80
    }

    const optionsData = await plugin.loadData(OPTIONS_STORAGE_KEY)
    if (optionsData) {
      Object.assign(options, optionsData)
    }
  } catch (error) {
    console.error('从插件存储加载配置失败:', error)
  }
}

// 保存配置到插件存储
const saveConfigToPlugin = async () => {
  try {
    await plugin.saveData(CONFIG_STORAGE_KEY, { host: config.host, port: config.port })
    await plugin.saveData(OPTIONS_STORAGE_KEY, { ...options })
  } catch (error) {
    console.error('保存配置到插件存储失败:', error)
  }
}

// 从localStorage迁移配置
const migrateFromLocalStorage = () => {
  try {
    const savedConfig = localStorage.getItem('everything-search-config')
    if (savedConfig) {
      const data = JSON.parse(savedConfig)
      config.host = data.host || config.host
      config.port = data.port || config.port
      // 清理localStorage
      localStorage.removeItem('everything-search-config')
    }

    const savedOptions = localStorage.getItem('everything-search-options')
    if (savedOptions) {
      Object.assign(options, JSON.parse(savedOptions))
      // 清理localStorage
      localStorage.removeItem('everything-search-options')
    }

    // 如果从localStorage迁移了数据，保存到插件存储
    if (savedConfig || savedOptions) {
      saveConfigToPlugin()
      console.log('Everything搜索配置已从localStorage迁移到插件存储')
    }
  } catch (error) {
    console.error('从localStorage迁移配置失败:', error)
  }
}

// 检查服务
const checkService = async () => {
  serviceAvailable.value = await checkEverythingService(config)
}

// 搜索
const handleSearch = async () => {
  const query = searchQuery.value.trim()
  if (!query) return

  // 取消之前的防抖定时器
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
    debounceTimer.value = null
  }

  isSearching.value = true
  errorMessage.value = ''
  hasSearched.value = true

  try {
    results.value = await searchFiles({
      query,
      matchCase: options.matchCase,
      matchWholeWord: options.matchWholeWord,
      matchPath: options.matchPath,
      regex: options.regex,
      maxResults: options.maxResults
    }, config)
  } catch (error) {
    errorMessage.value = (error as Error).message || '搜索失败'
    results.value = []
  } finally {
    isSearching.value = false
  }
}

// 防抖搜索
const debouncedSearch = () => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }

  if (!options.autoSearch) {
    return
  }

  const query = searchQuery.value.trim()
  if (!query) {
    // 清空结果
    results.value = []
    hasSearched.value = false
    errorMessage.value = ''
    return
  }

  debounceTimer.value = window.setTimeout(() => {
    handleSearch()
  }, options.debounceDelay)
}

// 清除搜索
const clearSearch = () => {
  searchQuery.value = ''
  results.value = []
  hasSearched.value = false
  errorMessage.value = ''
  searchInputRef.value?.focus()
}

// 关闭弹窗
const closeDialog = () => {
  emit('update:visible', false)
  emit('close')
}

// 获取完整路径
const getFullPath = (item: EverythingSearchResult) => {
  return item.path ? `${item.path}\\${item.name}` : item.name
}

// 格式化大小
const formatSize = (size: number) => {
  return formatFileSize(size)
}

// 获取图标类
const getIconClass = (item: EverythingSearchResult) => {
  return `icon-${getFileIconType(item.name, item.type === 'folder')}`
}

// 获取图标emoji
const getIconEmoji = (item: EverythingSearchResult) => {
  if (item.type === 'folder') return '📁'

  const iconType = getFileIconType(item.name, false)
  const emojiMap: Record<string, string> = {
    pdf: '📕',
    word: '📘',
    excel: '📗',
    ppt: '📙',
    text: '📄',
    markdown: '📝',
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    archive: '📦',
    code: '💻',
    executable: '⚙️',
    siyuan: '📔',
    file: '📄'
  }
  return emojiMap[iconType] || '📄'
}

// 点击项目
const handleItemClick = (item: EverythingSearchResult) => {
  // 单击选中（预留）
}

// 打开项目
const openItem = async (item: EverythingSearchResult) => {
  try {
    await openFile(getFullPath(item))
  } catch (error) {
    showMessage('打开失败: ' + (error as Error).message, 3000, 'error')
  }
}

// 在文件夹中显示
const showInFolder = async (item: EverythingSearchResult) => {
  try {
    await showInExplorer(getFullPath(item))
  } catch (error) {
    showMessage('操作失败: ' + (error as Error).message, 3000, 'error')
  }
}

// 复制路径
const copyPath = async (item: EverythingSearchResult) => {
  try {
    await navigator.clipboard.writeText(getFullPath(item))
    showMessage('路径已复制', 2000, 'info')
  } catch (error) {
    showMessage('复制失败', 2000, 'error')
  }
}

// 键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.visible) return

  if (event.key === 'Escape') {
    closeDialog()
  }
}

// 加载保存的配置
const loadConfig = async () => {
  try {
    // 首先尝试从插件存储加载
    await loadConfigFromPlugin()

    // 如果插件存储中没有配置，尝试从localStorage迁移
    const hasConfig = await plugin.loadData(CONFIG_STORAGE_KEY)
    const hasOptions = await plugin.loadData(OPTIONS_STORAGE_KEY)

    if (!hasConfig || !hasOptions) {
      migrateFromLocalStorage()
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    // 如果插件存储失败，尝试从localStorage加载作为后备
    try {
      const saved = localStorage.getItem('everything-search-config')
      if (saved) {
        const data = JSON.parse(saved)
        config.host = data.host || 'localhost'
        config.port = data.port || 80
      }
      const savedOptions = localStorage.getItem('everything-search-options')
      if (savedOptions) {
        Object.assign(options, JSON.parse(savedOptions))
      }
    } catch (fallbackError) {
      console.error('从localStorage加载后备配置失败:', fallbackError)
    }
  }
}

// 保存配置
const saveConfig = async () => {
  try {
    await saveConfigToPlugin()
  } catch (error) {
    console.error('保存配置失败:', error)
    // 如果插件存储失败，尝试保存到localStorage作为后备
    try {
      localStorage.setItem('everything-search-config', JSON.stringify(config))
      localStorage.setItem('everything-search-options', JSON.stringify(options))
    } catch (fallbackError) {
      console.error('保存到localStorage后备失败:', fallbackError)
    }
  }
}

// 监听visible变化
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await nextTick()
    searchInputRef.value?.focus()
    checkService()
  }
})

// 监听搜索查询变化
watch(searchQuery, () => {
  debouncedSearch()
})

// 监听自动搜索选项变化
watch(() => options.autoSearch, (newVal) => {
  autoSearchEnabled.value = newVal
  if (newVal && searchQuery.value.trim()) {
    debouncedSearch()
  }
})

// 监听配置变化
watch([config, options], () => {
  saveConfig().catch(error => {
    console.error('保存配置时出错:', error)
  })
}, { deep: true })

onMounted(async () => {
  document.addEventListener('keydown', handleKeyDown)
  await loadConfig()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
})
</script>

<style scoped>
.everything-search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  z-index: 99999;
}

.everything-search-dialog {
  width: 800px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--b3-theme-background);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 头部 */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.title-icon {
  font-size: 20px;
}

.close-btn {
  padding: 8px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--b3-theme-error);
  color: #fff;
}

.close-icon {
  width: 16px;
  height: 16px;
}

/* 搜索栏 */
.search-bar {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  transition: border-color 0.2s;
}

.search-input-wrapper:focus-within {
  border-color: var(--b3-theme-primary);
}

.search-icon {
  width: 18px;
  height: 18px;
  color: var(--b3-theme-on-surface-light);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-background);
  font-size: 15px;
  outline: none;
}

.search-input::placeholder {
  color: var(--b3-theme-on-surface-light);
}

.clear-btn {
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--b3-theme-on-surface-light);
  transition: all 0.2s;
}

.clear-btn:hover {
  color: var(--b3-theme-on-background);
  background: var(--b3-theme-surface-light);
}

.clear-icon {
  width: 14px;
  height: 14px;
}

.search-btn {
  padding: 8px 20px;
  background: var(--b3-theme-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
}

.search-btn:hover:not(:disabled) {
  background: var(--b3-theme-primary-light);
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 搜索选项 */
.search-options {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 20px;
  background: var(--b3-theme-surface-light);
  border-bottom: 1px solid var(--b3-border-color);
}

.option-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
}

.option-item input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.results-count {
  margin-left: auto;
}

.results-select,
.delay-select {
  padding: 2px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  cursor: pointer;
}

.debounce-delay {
  margin-left: 8px;
}

/* 服务警告 */
.service-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #fef3cd;
  color: #856404;
  font-size: 13px;
}

.warning-icon {
  font-size: 16px;
}

.retry-btn {
  padding: 4px 12px;
  background: #856404;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-left: auto;
}

.retry-btn:hover {
  background: #6d5303;
}

/* 结果区域 */
.results-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-state,
.error-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--b3-theme-on-surface-light);
}

.loading-spinner-large {
  width: 40px;
  height: 40px;
  border: 3px solid var(--b3-border-color);
  border-top-color: var(--b3-theme-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon,
.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.hint {
  font-size: 12px;
  margin-top: 8px;
  opacity: 0.7;
}

/* 结果列表 */
.results-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.results-header {
  padding: 8px 20px;
  background: var(--b3-theme-surface-light);
  border-bottom: 1px solid var(--b3-border-color);
}

.results-count-text {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.results-scroll {
  flex: 1;
  overflow-y: auto;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--b3-border-color);
  cursor: pointer;
  transition: background 0.15s;
}

.result-item:hover {
  background: var(--b3-theme-surface-light);
}

.item-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-path {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.item-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.item-size {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  font-weight: 500;
}

.item-date {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
}

.item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.result-item:hover .item-actions {
  opacity: 1;
}

.action-btn {
  padding: 6px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--b3-theme-primary);
  border-color: var(--b3-theme-primary);
  color: #fff;
}

.action-icon {
  width: 14px;
  height: 14px;
}

/* 底部 */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--b3-theme-surface);
  border-top: 1px solid var(--b3-border-color);
}

.config-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.config-input {
  padding: 4px 8px;
  width: 100px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 12px;
}

.port-input {
  width: 60px;
}

.shortcut-hint {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}
</style>
