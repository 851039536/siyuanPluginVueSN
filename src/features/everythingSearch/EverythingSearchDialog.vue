<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="everything-search-overlay" @click.self="closeDialog">
        <Transition name="scale">
          <div v-if="visible" class="everything-search-dialog">
            <!-- 头部 -->
            <DialogHeader @close="closeDialog" />

            <!-- 搜索栏 -->
            <SearchBar
              v-model="searchQuery"
              :is-searching="searchState.status === 'loading'"
              :auto-search="options.autoSearch"
              @search="handleSearch"
              @clear="handleClear"
              @escape="closeDialog"
              ref="searchBarRef"
            />

            <!-- 搜索选项 -->
            <SearchOptionsPanel
              :options="options"
              :available-drives="availableDrives"
              @update:options="handleOptionUpdate"
              @drive-change="handleDriveChange"
              @refresh-drives="refreshDrives"
            />

            <!-- 服务状态提示 -->
            <ServiceWarning v-if="!serviceAvailable" @retry="checkService" />

            <!-- 结果区域 -->
            <SearchResults
              :state="searchState"
              :auto-search="options.autoSearch"
              @item-click="handleItemClick"
              @item-dbl-click="handleItemDblClick"
              @item-open="handleItemOpen"
              @item-show-in-folder="handleItemShowInFolder"
              @item-copy-path="handleItemCopyPath"
            />

            <!-- 底部配置 -->
            <DialogFooter
              :config="config"
              @update:config="handleConfigUpdate"
            />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { showMessage } from 'siyuan'
import {
  searchFiles,
  checkEverythingService,
  openFile,
  showInExplorer,
  type EverythingSearchResult,
  type EverythingConfig
} from './api'
import { usePlugin } from '@/main'
import type { SearchOptions as SearchOptionsType, SearchState } from './types'

// 子组件
import DialogHeader from './components/DialogHeader.vue'
import SearchBar from './components/SearchBar.vue'
import SearchOptionsPanel from './components/SearchOptions.vue'
import SearchResults from './components/SearchResults.vue'
import ServiceWarning from './components/ServiceWarning.vue'
import DialogFooter from './components/DialogFooter.vue'

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
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null)

// 配置存储键
const CONFIG_STORAGE_KEY = 'everything-search-config'
const OPTIONS_STORAGE_KEY = 'everything-search-options'

// 获取插件实例
const plugin = usePlugin()

// 状态
const searchQuery = ref('')
const serviceAvailable = ref(true)
const availableDrives = ref<string[]>([])
const debounceTimer = ref<number | null>(null)
const saveConfigTimer = ref<number | null>(null)

// 配置
const config = reactive<EverythingConfig>({
  host: 'localhost',
  port: 80
})

// 搜索选项
const options = reactive<SearchOptionsType>({
  matchCase: false,
  matchWholeWord: false,
  matchPath: false,
  regex: false,
  maxResults: 100,
  autoSearch: true,
  debounceDelay: 500,
  sort: 'date_modified',
  ascending: false,
  selectedDrive: ''
})

// 搜索状态
const searchState = reactive<SearchState>({
  status: 'idle',
  results: [],
  errorMessage: '',
  hasSearched: false
})

/** 从插件存储加载配置 */
const loadConfigFromPlugin = async () => {
  try {
    const configData = await plugin.loadData(CONFIG_STORAGE_KEY)
    if (configData) {
      Object.assign(config, {
        host: configData.host || 'localhost',
        port: configData.port || 80
      })
    }

    const optionsData = await plugin.loadData(OPTIONS_STORAGE_KEY)
    if (optionsData) {
      Object.assign(options, optionsData)
      if (typeof options.selectedDrive === 'undefined') {
        options.selectedDrive = ''
      }
    }
  } catch (error) {
    console.error('从插件存储加载配置失败:', error)
  }
}

/** 保存配置到插件存储（带防抖） */
const saveConfigToPlugin = async () => {
  // 清除之前的定时器
  if (saveConfigTimer.value) {
    clearTimeout(saveConfigTimer.value)
  }

  // 延迟保存，避免频繁写入
  saveConfigTimer.value = window.setTimeout(async () => {
    try {
      // 只保存有效值，空值使用默认值
      const configToSave = {
        host: config.host || 'localhost',
        port: config.port || 80
      }
      await plugin.saveData(CONFIG_STORAGE_KEY, configToSave)
      await plugin.saveData(OPTIONS_STORAGE_KEY, { ...options })
    } catch (error) {
      console.error('保存配置到插件存储失败:', error)
    }
  }, 500)
}

/** 检查服务 */
const checkService = async () => {
  serviceAvailable.value = await checkEverythingService(config)
}

/** 检测系统盘符 */
const detectDrives = async () => {
  try {
    const commonDrives = ['C:', 'D:', 'E:', 'F:', 'G:', 'H:', 'I:', 'J:', 'K:', 'L:', 'M:', 'N:', 'O:', 'P:', 'Q:', 'R:', 'S:', 'T:', 'U:', 'V:', 'W:', 'X:', 'Y:', 'Z:']
    availableDrives.value = commonDrives
  } catch (error) {
    console.error('检测盘符失败:', error)
    availableDrives.value = ['C:', 'D:', 'E:', 'F:', 'G:', 'H:', 'I:', 'J:']
  }
}

/** 刷新盘符列表 */
const refreshDrives = () => {
  detectDrives()
}

/** 处理盘符变化 */
const handleDriveChange = (drive: string) => {
  if (options.autoSearch && searchQuery.value.trim()) {
    debouncedSearch()
  }
}

/** 搜索 */
const handleSearch = async () => {
  const query = searchQuery.value.trim()
  if (!query) return

  // 取消之前的防抖定时器
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
    debounceTimer.value = null
  }

  // 构建最终查询
  let finalQuery = query
  if (options.selectedDrive) {
    finalQuery = `${options.selectedDrive}\\ ${query}`
  }

  searchState.status = 'loading'
  searchState.errorMessage = ''
  searchState.hasSearched = true

  try {
    const results = await searchFiles({
      query: finalQuery,
      matchCase: options.matchCase,
      matchWholeWord: options.matchWholeWord,
      matchPath: options.matchPath,
      regex: options.regex,
      maxResults: options.maxResults,
      sort: options.sort,
      ascending: options.ascending
    }, config)

    searchState.results = results
    searchState.status = results.length === 0 ? 'empty' : 'success'
  } catch (error) {
    searchState.errorMessage = (error as Error).message || '搜索失败'
    searchState.status = 'error'
    searchState.results = []
  }
}

/** 防抖搜索 */
const debouncedSearch = () => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }

  if (!options.autoSearch) {
    return
  }

  const query = searchQuery.value.trim()
  if (!query) {
    searchState.results = []
    searchState.status = 'idle'
    searchState.hasSearched = false
    searchState.errorMessage = ''
    return
  }

  debounceTimer.value = window.setTimeout(() => {
    handleSearch()
  }, options.debounceDelay)
}

/** 清除搜索 */
const handleClear = () => {
  searchQuery.value = ''
  searchState.results = []
  searchState.status = 'idle'
  searchState.hasSearched = false
  searchState.errorMessage = ''
  searchBarRef.value?.focus()
}

/** 关闭弹窗 */
const closeDialog = () => {
  emit('update:visible', false)
  emit('close')
}

/** 处理选项更新 */
const handleOptionUpdate = (key: keyof SearchOptionsType, value: SearchOptionsType[keyof SearchOptionsType]) => {
  ;(options as any)[key] = value
}

/** 处理配置更新 */
const handleConfigUpdate = (key: keyof EverythingConfig, value: EverythingConfig[keyof EverythingConfig]) => {
  Object.assign(config, { [key]: value })
}

/** 获取完整路径 */
const getFullPath = (item: EverythingSearchResult) => {
  return item.path ? `${item.path}\\${item.name}` : item.name
}

/** 点击项目 */
const handleItemClick = (item: EverythingSearchResult) => {
  // 单击选中（预留）
}

/** 打开项目 */
const handleItemDblClick = async (item: EverythingSearchResult) => {
  await handleItemOpen(item)
}

/** 打开项目 */
const handleItemOpen = async (item: EverythingSearchResult) => {
  try {
    await openFile(getFullPath(item))
  } catch (error) {
    showMessage('打开失败: ' + (error as Error).message, 3000, 'error')
  }
}

/** 在文件夹中显示 */
const handleItemShowInFolder = async (item: EverythingSearchResult) => {
  try {
    await showInExplorer(getFullPath(item))
  } catch (error) {
    showMessage('操作失败: ' + (error as Error).message, 3000, 'error')
  }
}

/** 复制路径 */
const handleItemCopyPath = async (item: EverythingSearchResult) => {
  try {
    await navigator.clipboard.writeText(getFullPath(item))
    showMessage('路径已复制', 2000, 'info')
  } catch (error) {
    showMessage('复制失败', 2000, 'error')
  }
}

/** 键盘事件 */
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.visible) return
  if (event.key === 'Escape') {
    closeDialog()
  }
}

/** 监听 visible 变化 */
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await nextTick()
    await loadConfig()
    searchBarRef.value?.focus()
    checkService()
  }
})

/** 监听搜索查询变化 */
watch(searchQuery, () => {
  debouncedSearch()
})

/** 监听配置变化 */
watch([config, options], () => {
  saveConfigToPlugin().catch(error => {
    console.error('保存配置时出错:', error)
  })
}, { deep: true })

onMounted(async () => {
  document.addEventListener('keydown', handleKeyDown)
  await loadConfig()
  await detectDrives()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
  if (saveConfigTimer.value) {
    clearTimeout(saveConfigTimer.value)
  }
})

/** 加载配置 */
const loadConfig = async () => {
  try {
    await loadConfigFromPlugin()
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}
</script>

<style scoped lang="scss">
@use '@/variables' as *;

.everything-search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(20, 20, 19, 0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  z-index: 99999;
  backdrop-filter: blur(4px);
}

.everything-search-dialog {
  width: 800px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--b3-theme-background);
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(20, 20, 19, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--b3-border-color);
}

/* 动画 */
.fade-enter-active,
.fade-leave-active,
.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}
</style>
