<template>
  <div class="markdown-export-panel">
    <div class="panel-header">
      <h3>导出笔记本为 Markdown</h3>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <div class="panel-content">
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <div class="button-group">
          <button class="btn btn-primary" @click="exportSelected" :disabled="exporting">
            {{ exporting ? '导出中...' : '导出选中的笔记本' }}
          </button>
          <button class="btn btn-warning" @click="exportAllNotebooks" :disabled="exporting">
            {{ exporting ? '导出中...' : '📁 一键导出所有笔记本' }}
          </button>
          <button class="btn btn-success" @click="exportAll" :disabled="exporting">
            {{ exporting ? '导出中...' : '📦 一键导出工作空间' }}
          </button>
        </div>
        <div class="button-group">
          <button class="btn btn-secondary" @click="selectAll">全选</button>
          <button class="btn btn-secondary" @click="deselectAll">取消全选</button>
        </div>
      </div>

      <!-- 提示信息 -->
      <div class="export-tips">
        <div class="tip-item">
          <span class="tip-icon">💡</span>
          <span class="tip-text">"导出选中的笔记本": 导出勾选的笔记本,每个生成一个 ZIP</span>
        </div>
        <div class="tip-item">
          <span class="tip-icon">💡</span>
          <span class="tip-text">"一键导出所有笔记本": 自动导出所有笔记本并打包成一个 ZIP 文件</span>
        </div>
        <div class="tip-item">
          <span class="tip-icon">💡</span>
          <span class="tip-text">"一键导出工作空间": 将整个工作空间打包成一个 ZIP 文件</span>
        </div>
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
// @ts-ignore
import JSZip from 'jszip'

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

async function exportAllNotebooks() {
  exporting.value = true
  addLog('info', '开始批量导出所有笔记本并打包...')
  
  exportProgress.value = {
    show: true,
    current: 0,
    total: notebooks.value.length,
    percent: 0
  }

  const zip = new JSZip()
  const errors: string[] = []

  // 遍历所有笔记本
  for (let i = 0; i < notebooks.value.length; i++) {
    const notebook = notebooks.value[i]
    
    try {
      addLog('info', `正在导出: ${notebook.name}`)
      
      // 1. 获取笔记本ZIP
      const response = await fetch('/api/export/exportNotebookMd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebook: notebook.id })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.code !== 0) {
        throw new Error(result.msg || '导出失败')
      }

      // 2. 下载ZIP文件
      const zipPath = result.data?.zip
      if (!zipPath) {
        throw new Error('未获取到ZIP文件路径')
      }

      const zipResponse = await fetch(zipPath)
      if (!zipResponse.ok) {
        throw new Error(`下载ZIP文件失败: ${zipResponse.status}`)
      }

      // 3. 获取ZIP文件的二进制数据
      const zipBlob = await zipResponse.blob()
      
      // 4. 添加到总ZIP中
      zip.file(`${notebook.name}.zip`, zipBlob)
      
      addLog('success', `✅ 已添加: ${notebook.name}`)

    } catch (error) {
      const errorMsg = `❌ 导出失败: ${notebook.name}`
      addLog('error', errorMsg)
      errors.push(notebook.name)
      console.error(`导出笔记本 ${notebook.name} 失败:`, error)
    }

    exportProgress.value.current = i + 1
    exportProgress.value.percent = Math.round(((i + 1) / notebooks.value.length) * 100)
  }

  // 生成最终的ZIP文件
  try {
    addLog('info', '正在打包所有笔记本...')
    
    const finalZipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    }, (metadata) => {
      // 显示打包进度
      const percent = Math.round(metadata.percent)
      if (percent % 10 === 0) { // 每10%更新一次
        addLog('info', `打包进度: ${percent}%`)
      }
    })

    // 下载最终的ZIP文件
    const timestamp = new Date().toISOString().slice(0, 10)
    const url = window.URL.createObjectURL(finalZipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `all-notebooks-${timestamp}.zip`
    document.body.appendChild(a)
    a.click()
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }, 1000)

    addLog('success', `✅ 已打包所有笔记本到一个 ZIP 文件`)
    await pushMsg(`成功导出并打包 ${notebooks.value.length - errors.length} 个笔记本`)

  } catch (error) {
    const errorMsg = '❌ 打包失败'
    addLog('error', errorMsg)
    await pushErrMsg(errorMsg)
    console.error('打包失败:', error)
  }

  exporting.value = false
  exportProgress.value.show = false

  if (errors.length > 0) {
    await pushErrMsg(`${errors.length} 个笔记本导出失败: ${errors.join(', ')}`)
  }
}

async function exportAll() {
  exporting.value = true
  addLog('info', '开始导出整个工作空间...')
  
  try {
    // 调用工作空间导出API
    const response = await fetch('/api/export/exportData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // 解析JSON响应
    const result = await response.json()
    
    if (result.code !== 0) {
      throw new Error(result.msg || '导出失败')
    }

    // 获取ZIP文件路径
    const zipPath = result.data?.zip
    if (!zipPath) {
      throw new Error('未获取到ZIP文件路径')
    }

    addLog('info', `正在下载: ${zipPath}`)

    // 下载ZIP文件
    const zipResponse = await fetch(zipPath)
    if (!zipResponse.ok) {
      throw new Error(`下载ZIP文件失败: ${zipResponse.status}`)
    }

    const blob = await zipResponse.blob()
    
    // 创建下载链接
    const timestamp = new Date().toISOString().slice(0, 10)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `siyuan-workspace-${timestamp}.zip`
    document.body.appendChild(a)
    a.click()
    
    // 清理
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }, 100)

    addLog('success', `✅ 已导出整个工作空间`)
    await pushMsg(`成功导出整个工作空间`)

  } catch (error) {
    const errorMsg = `❌ 导出工作空间失败`
    addLog('error', errorMsg)
    await pushErrMsg(errorMsg)
    console.error('导出工作空间失败:', error)
  } finally {
    exporting.value = false
  }
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
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.button-group {
  display: flex;
  gap: 12px;
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

.btn-warning {
  background: #ff9800;
  color: white;

  &:hover:not(:disabled) {
    background: #f57c00;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.btn-success {
  background: #4caf50;
  color: white;

  &:hover:not(:disabled) {
    background: #45a049;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.btn-secondary {
  background: var(--b3-theme-surface-light);
  color: var(--b3-theme-on-surface);

  &:hover:not(:disabled) {
    background: var(--b3-theme-surface);
  }
}

.export-tips {
  margin-bottom: 20px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  border-left: 3px solid var(--b3-theme-primary);
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);

  &:last-child {
    margin-bottom: 0;
  }
}

.tip-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.tip-text {
  flex: 1;
  line-height: 1.5;
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
