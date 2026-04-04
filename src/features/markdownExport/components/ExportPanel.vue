<template>
  <div class="markdown-export-panel">
    <div class="panel-header">
      <h3>导出笔记本为 Markdown</h3>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <div class="panel-content">
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button class="btn btn-primary" @click="exportSelected" :disabled="exporting">
          {{ exporting ? '导出中...' : '导出选中的笔记本' }}
        </button>
        <button class="btn btn-secondary" @click="selectAll">全选</button>
        <button class="btn btn-secondary" @click="deselectAll">取消全选</button>
      </div>

      <!-- 笔记本列表 -->
      <div class="notebook-list">
        <div v-if="loading" class="loading">加载中...</div>
        
        <div v-else-if="notebooks.length === 0" class="empty">
          没有找到笔记本
        </div>

        <div v-else class="notebook-items">
          <div
            v-for="notebook in notebooks"
            :key="notebook.id"
            class="notebook-item"
            :class="{ selected: selectedNotebooks.includes(notebook.id) }"
            @click="toggleNotebook(notebook.id)"
          >
            <input
              type="checkbox"
              :checked="selectedNotebooks.includes(notebook.id)"
              @click.stop
              @change="toggleNotebook(notebook.id)"
            />
            <span class="notebook-icon">📓</span>
            <span class="notebook-name">{{ notebook.name }}</span>
            <span class="notebook-count">{{ notebook.docCount || 0 }} 个文档</span>
          </div>
        </div>
      </div>

      <!-- 导出进度 -->
      <div v-if="exportProgress.show" class="export-progress">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: `${exportProgress.percent}%` }"
          ></div>
        </div>
        <div class="progress-text">
          {{ exportProgress.current }} / {{ exportProgress.total }}
        </div>
      </div>

      <!-- 导出日志 -->
      <div v-if="exportLogs.length > 0" class="export-logs">
        <h4>导出日志</h4>
        <div class="log-items">
          <div
            v-for="(log, index) in exportLogs"
            :key="index"
            class="log-item"
            :class="log.type"
          >
            {{ log.message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { lsNotebooks, pushMsg, pushErrMsg } from '@/api'

interface Notebook {
  id: string
  name: string
  docCount?: number
}

interface ExportLog {
  type: 'success' | 'error' | 'info'
  message: string
}

interface Props {
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  plugin: null
})

const emit = defineEmits(['close'])

const loading = ref(true)
const exporting = ref(false)
const notebooks = ref<Notebook[]>([])
const selectedNotebooks = ref<string[]>([])
const exportLogs = ref<ExportLog[]>([])
const exportProgress = ref({
  show: false,
  current: 0,
  total: 0,
  percent: 0
})

// 加载笔记本列表
onMounted(async () => {
  await loadNotebooks()
})

async function loadNotebooks() {
  try {
    loading.value = true
    const data = await lsNotebooks()
    
    if (data && data.notebooks) {
      notebooks.value = data.notebooks.map((nb: any) => ({
        id: nb.id,
        name: nb.name,
        docCount: nb.docCount
      }))
    }
  } catch (error) {
    console.error('加载笔记本列表失败:', error)
    addLog('error', '加载笔记本列表失败')
  } finally {
    loading.value = false
  }
}

function toggleNotebook(notebookId: string) {
  const index = selectedNotebooks.value.indexOf(notebookId)
  if (index > -1) {
    selectedNotebooks.value.splice(index, 1)
  } else {
    selectedNotebooks.value.push(notebookId)
  }
}

function selectAll() {
  selectedNotebooks.value = notebooks.value.map(nb => nb.id)
}

function deselectAll() {
  selectedNotebooks.value = []
}

async function exportSelected() {
  if (selectedNotebooks.value.length === 0) {
    await pushErrMsg('请至少选择一个笔记本')
    return
  }

  exporting.value = true
  exportProgress.value = {
    show: true,
    current: 0,
    total: selectedNotebooks.value.length,
    percent: 0
  }

  const errors: string[] = []

  for (let i = 0; i < selectedNotebooks.value.length; i++) {
    const notebookId = selectedNotebooks.value[i]
    const notebook = notebooks.value.find(nb => nb.id === notebookId)
    
    if (notebook) {
      try {
        await exportNotebookMd(notebookId, notebook.name)
        addLog('success', `✅ 已导出: ${notebook.name}`)
      } catch (error) {
        const errorMsg = `❌ 导出失败: ${notebook.name}`
        addLog('error', errorMsg)
        errors.push(notebook.name)
        console.error(`导出笔记本 ${notebook.name} 失败:`, error)
      }
    }

    exportProgress.value.current = i + 1
    exportProgress.value.percent = Math.round(((i + 1) / selectedNotebooks.value.length) * 100)
  }

  exporting.value = false
  exportProgress.value.show = false

  if (errors.length === 0) {
    await pushMsg(`成功导出 ${selectedNotebooks.value.length} 个笔记本`)
  } else {
    await pushErrMsg(`${errors.length} 个笔记本导出失败: ${errors.join(', ')}`)
  }
}

async function exportNotebookMd(notebookId: string, notebookName: string) {
  try {
    addLog('info', `开始导出: ${notebookName}`)
    
    // 第一步: 调用导出API获取ZIP文件路径
    const response = await fetch('/api/export/exportNotebookMd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notebook: notebookId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // 第二步: 解析JSON响应
    const result = await response.json()
    
    if (result.code !== 0) {
      throw new Error(result.msg || '导出失败')
    }

    // 第三步: 从响应中获取ZIP文件路径
    const zipPath = result.data?.zip
    if (!zipPath) {
      throw new Error('未获取到ZIP文件路径')
    }

    addLog('info', `正在下载: ${zipPath}`)

    // 第四步: 下载ZIP文件
    const zipResponse = await fetch(zipPath)
    if (!zipResponse.ok) {
      throw new Error(`下载ZIP文件失败: ${zipResponse.status}`)
    }

    const blob = await zipResponse.blob()
    
    // 第五步: 创建下载链接
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${notebookName}.zip`
    document.body.appendChild(a)
    a.click()
    
    // 清理
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }, 100)

  } catch (error) {
    console.error('导出失败详情:', error)
    throw error
  }
}

function addLog(type: ExportLog['type'], message: string) {
  exportLogs.value.push({ type, message })
  // 限制日志数量
  if (exportLogs.value.length > 50) {
    exportLogs.value.shift()
  }
}
</script>

<style lang="scss" scoped>
.markdown-export-panel {
  position: relative;
  width: 600px;
  max-height: 80vh;
  background: var(--b3-theme-background);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-border-color);

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s;

    &:hover {
      background: var(--b3-theme-surface-light);
    }
  }
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: var(--b3-theme-primary);
  color: white;

  &:hover:not(:disabled) {
    background: var(--b3-theme-primary-light);
  }
}

.btn-secondary {
  background: var(--b3-theme-surface-light);
  color: var(--b3-theme-on-surface);

  &:hover:not(:disabled) {
    background: var(--b3-theme-surface);
  }
}

.notebook-list {
  margin-bottom: 20px;
}

.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}

.notebook-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notebook-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface-light);
  }

  &.selected {
    background: var(--b3-theme-primary-lightest);
    border-color: var(--b3-theme-primary);
  }

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .notebook-icon {
    font-size: 20px;
  }

  .notebook-name {
    flex: 1;
    font-size: 14px;
    color: var(--b3-theme-on-background);
  }

  .notebook-count {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
  }
}

.export-progress {
  margin-bottom: 20px;

  .progress-bar {
    height: 8px;
    background: var(--b3-theme-surface-light);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-fill {
    height: 100%;
    background: var(--b3-theme-primary);
    transition: width 0.3s;
  }

  .progress-text {
    text-align: center;
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }
}

.export-logs {
  margin-top: 20px;

  h4 {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--b3-theme-on-background);
  }

  .log-items {
    max-height: 200px;
    overflow-y: auto;
    background: var(--b3-theme-surface);
    border-radius: 6px;
    padding: 12px;
  }

  .log-item {
    font-size: 12px;
    padding: 4px 0;
    font-family: monospace;

    &.success {
      color: #4caf50;
    }

    &.error {
      color: #f44336;
    }

    &.info {
      color: var(--b3-theme-on-surface);
    }
  }
}
</style>
