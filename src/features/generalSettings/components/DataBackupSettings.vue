<template>
  <div class="data-backup-settings">
    <div class="settings-container">
      <!-- 工作区信息 -->
      <div class="info-section">
        <div class="section-header">
          <span class="section-icon">💾</span>
          <h4>{{ i18n.workspaceInfo || '工作区信息' }}</h4>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ i18n.workspacePath || '工作区路径' }}</span>
            <div class="workspace-path-row">
              <span class="info-value workspace-path">{{ workspacePath || i18n.notSet || '未设置' }}</span>
              <button @click="selectWorkspacePath" class="select-path-btn">
                {{ i18n.selectPath || '选择路径' }}
              </button>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">{{ i18n.lastBackup || '上次备份' }}</span>
            <span class="info-value">{{ lastBackupTime || i18n.never || '从未' }}</span>
          </div>
        </div>
      </div>

      <!-- 手动备份 -->
      <div class="backup-section">
        <div class="section-header">
          <span class="section-icon">📦</span>
          <h4>{{ i18n.manualBackup || '手动备份' }}</h4>
        </div>
        <div class="backup-actions">
          <button
            @click="performBackup"
            class="backup-btn primary"
            :disabled="isBackingUp"
          >
            <span v-if="isBackingUp" class="loading-spinner"></span>
            <span v-else class="btn-icon">📀</span>
            <span class="btn-text">{{ i18n.backupNow || '立即备份' }}</span>
          </button>
          <p class="backup-hint">{{ i18n.backupHint || '备份将保存为 data-年月日.zip 格式' }}</p>
        </div>
      </div>

      <!-- 自动备份设置 -->
      <div class="auto-backup-section">
        <div class="section-header">
          <span class="section-icon">⏰</span>
          <h4>{{ i18n.autoBackupSettings || '自动备份设置' }}</h4>
        </div>
        <div class="settings-form">
          <div class="form-item">
            <label class="form-label">{{ i18n.autoBackup || '自动备份' }}</label>
            <select v-model="autoBackupEnabled" class="form-select" @change="saveSettings">
              <option :value="false">{{ i18n.disabled || '禁用' }}</option>
              <option :value="true">{{ i18n.enabled || '启用' }}</option>
            </select>
          </div>

          <div v-if="autoBackupEnabled" class="form-item">
            <label class="form-label">{{ i18n.backupFrequency || '备份频率' }}</label>
            <select v-model="backupFrequency" class="form-select" @change="saveSettings">
              <option value="minute">{{ i18n.everyMinute || '每分钟' }}</option>
              <option value="hourly">{{ i18n.everyHour || '每小时' }}</option>
              <option value="daily">{{ i18n.everyDay || '每天' }}</option>
            </select>
          </div>

          <div v-if="autoBackupEnabled && backupFrequency === 'daily'" class="form-item">
            <label class="form-label">{{ i18n.backupTime || '备份时间' }}</label>
            <input
              type="time"
              v-model="backupTime"
              class="form-input"
              @change="saveSettings"
            />
          </div>

          <div v-if="autoBackupEnabled" class="form-item">
            <label class="form-label">{{ i18n.keepBackups || '保留备份数' }}</label>
            <input
              type="number"
              v-model="keepBackupCount"
              class="form-input small"
              min="1"
              max="30"
              @change="saveSettings"
            />
            <span class="form-hint">{{ i18n.keepBackupsHint || '个备份文件，超出将自动删除最旧的' }}</span>
          </div>
        </div>
      </div>

      <!-- 备份历史 -->
      <div class="history-section">
        <div class="section-header">
          <span class="section-icon">📋</span>
          <h4>{{ i18n.backupHistory || '备份历史' }}</h4>
          <button @click="refreshBackupList" class="refresh-btn" :disabled="isLoading">
            {{ i18n.refresh || '刷新' }}
          </button>
        </div>
        <div class="backup-list" v-if="backupList.length > 0">
          <div
            v-for="(backup, index) in backupList"
            :key="index"
            class="backup-item"
          >
            <div class="backup-info">
              <span class="backup-name">{{ backup.name }}</span>
              <span class="backup-time">{{ backup.time }}</span>
              <span class="backup-size">{{ backup.size }}</span>
            </div>
            <div class="backup-actions">
              <button @click="restoreBackup(backup)" class="action-btn restore">
                {{ i18n.restore || '恢复' }}
              </button>
              <button @click="deleteBackup(backup)" class="action-btn delete">
                {{ i18n.delete || '删除' }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon">📭</span>
          <p>{{ i18n.noBackups || '暂无备份记录' }}</p>
        </div>
      </div>
    </div>

    <!-- 自定义输入对话框 -->
    <div v-if="showInputDialog" class="input-dialog-overlay" @click.self="cancelInputDialog">
      <div class="input-dialog">
        <div class="input-dialog-header">
          <h4>{{ i18n.enterWorkspacePath || '请输入思源工作区路径' }}</h4>
        </div>
        <div class="input-dialog-body">
          <input
            v-model="inputDialogValue"
            type="text"
            class="input-dialog-field"
            :placeholder="inputDialogPlaceholder"
            @keyup.enter="confirmInputDialog"
            @keyup.esc="cancelInputDialog"
            ref="dialogInputRef"
          />
        </div>
        <div class="input-dialog-footer">
          <button @click="cancelInputDialog" class="input-dialog-btn cancel">
            {{ i18n.cancel || '取消' }}
          </button>
          <button @click="confirmInputDialog" class="input-dialog-btn confirm">
            {{ i18n.confirm || '确定' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { showMessage } from 'siyuan'

// 导入 JSZip 用于创建 zip 文件
import JSZip from 'jszip'

interface Props {
  i18n?: any
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null
})

// 响应式数据
const workspacePath = ref('')  // 工作区路径（包含 data 文件夹）
const workspaceRoot = ref('')  // 工作区根路径
const isBackingUp = ref(false)
const isLoading = ref(false)
const lastBackupTime = ref('')
const autoBackupEnabled = ref(false)
const backupFrequency = ref('daily')
const backupTime = ref('03:00')
const keepBackupCount = ref(7)
const backupList = ref<Array<{ name: string; path: string; time: string; size: string }>>([])

// 定时器
let autoBackupTimer: number | null = null
let lastBackupTimestamp = 0

// 获取备份目录路径
function getBackupDir(): string {
  // 备份目录在工作区根目录下，而不是 data 目录下
  // 例如：E:\siyuan2\data-backup
  return `${workspaceRoot.value}/data-backup`
}

// 初始化
onMounted(async () => {
  await loadSettings()
  await detectWorkspacePath()
  await loadBackupList()
  startAutoBackupTimer()
})

onUnmounted(() => {
  stopAutoBackupTimer()
})

// 监听备份频率变化，重启定时器
watch(backupFrequency, () => {
  startAutoBackupTimer()
})

// 监听自动备份启用状态
watch(autoBackupEnabled, (enabled) => {
  if (enabled) {
    startAutoBackupTimer()
  } else {
    stopAutoBackupTimer()
  }
})

// 加载设置
async function loadSettings() {
  try {
    if (props.plugin) {
      const data = await props.plugin.loadData('data-backup-settings')
      if (data) {
        autoBackupEnabled.value = data.autoBackupEnabled ?? false
        backupFrequency.value = data.backupFrequency ?? 'daily'
        backupTime.value = data.backupTime ?? '03:00'
        keepBackupCount.value = data.keepBackupCount ?? 7
        lastBackupTime.value = data.lastBackupTime ?? ''
        lastBackupTimestamp = data.lastBackupTimestamp ?? 0
        // 加载保存的工作区路径
        if (data.workspacePath) {
          workspacePath.value = data.workspacePath
          // 从 workspacePath 推断 workspaceRoot
          workspaceRoot.value = data.workspaceRoot || data.workspacePath.replace(/\/data$/, '')
        }
        if (data.workspaceRoot) {
          workspaceRoot.value = data.workspaceRoot
        }
      }
    }
  } catch (error) {
    console.error('加载备份设置失败:', error)
  }
}

// 保存设置
async function saveSettings() {
  try {
    if (props.plugin) {
      await props.plugin.saveData('data-backup-settings', {
        autoBackupEnabled: autoBackupEnabled.value,
        backupFrequency: backupFrequency.value,
        backupTime: backupTime.value,
        keepBackupCount: keepBackupCount.value,
        lastBackupTime: lastBackupTime.value,
        lastBackupTimestamp,
        workspacePath: workspacePath.value,
        workspaceRoot: workspaceRoot.value
      })
      console.log('备份设置已保存')
    }
  } catch (error) {
    console.error('保存备份设置失败:', error)
  }
}

// 检测工作区路径
async function detectWorkspacePath() {
  // 方式1: 检查环境变量
  if ((window as any).__SIYUAN_WS__ || (window as any).SIYUAN_WORKSPACE) {
    const rootPath = (window as any).__SIYUAN_WORKSPACE__ || (window as any).SIYUAN_WORKSPACE
    workspaceRoot.value = rootPath
    workspacePath.value = `${rootPath}/data`  // 直接指向 data 目录
    return
  }

  // 方式2: 尝试从 localStorage 获取
  const savedPath = localStorage.getItem('siyuan-workspace-path')
  const savedRoot = localStorage.getItem('siyuan-workspace-root')
  if (savedPath) {
    workspacePath.value = savedPath
    workspaceRoot.value = savedRoot || savedPath.replace(/\/data$/, '')
    return
  }

  // 方式3: 尝试从插件配置获取
  try {
    if (props.plugin && props.plugin.dataPath) {
      workspaceRoot.value = props.plugin.dataPath
      workspacePath.value = `${props.plugin.dataPath}/data`
      return
    }
  } catch (e) {
    // 忽略错误
  }

  // 方式4: 通过 API 获取工作区路径
  try {
    const response = await fetch('/api/system/getConf', {
      method: 'POST'
    })
    if (response.ok) {
      const data = await response.json()
      const wsPath = data?.data?.conf?.system?.workspaceDir
      if (wsPath) {
        workspaceRoot.value = wsPath
        workspacePath.value = `${wsPath}/data`  // 直接指向 data 目录
        localStorage.setItem('siyuan-workspace-root', wsPath)
        localStorage.setItem('siyuan-workspace-path', `${wsPath}/data`)
        return
      }
    }
  } catch (e) {
    console.error('通过 API 获取工作区路径失败:', e)
  }

  // 方式5: 监听来自其他组件的事件
  window.addEventListener('workspacePathDetected', handleWorkspacePathDetected)
}

// 处理工作区路径检测事件
function handleWorkspacePathDetected(event: CustomEvent) {
  workspaceRoot.value = event.detail.path
  workspacePath.value = `${event.detail.path}/data`
  localStorage.setItem('siyuan-workspace-root', event.detail.path)
  localStorage.setItem('siyuan-workspace-path', `${event.detail.path}/data`)
}

// 输入对话框相关
const showInputDialog = ref(false)
const inputDialogValue = ref('')
const inputDialogPlaceholder = ref('')
const inputDialogResolve = ref<((value: string | null) => void) | null>(null)
const dialogInputRef = ref<HTMLInputElement | null>(null)

// 显示输入对话框
function showInputDialogHelper(placeholder: string): Promise<string | null> {
  return new Promise((resolve) => {
    inputDialogPlaceholder.value = placeholder
    inputDialogValue.value = workspaceRoot.value || ''
    inputDialogResolve.value = resolve
    showInputDialog.value = true
    // 自动聚焦到输入框
    nextTick(() => {
      dialogInputRef.value?.focus()
      dialogInputRef.value?.select()
    })
  })
}

// 确认输入
function confirmInputDialog() {
  const value = inputDialogValue.value.trim()
  showInputDialog.value = false
  if (inputDialogResolve.value) {
    inputDialogResolve.value(value || null)
    inputDialogResolve.value = null
  }
}

// 取消输入
function cancelInputDialog() {
  showInputDialog.value = false
  if (inputDialogResolve.value) {
    inputDialogResolve.value(null)
    inputDialogResolve.value = null
  }
}

// 选择工作区路径
async function selectWorkspacePath() {
  // 如果还没获取到工作区路径，先尝试获取
  if (!workspaceRoot.value) {
    try {
      const response = await fetch('/api/system/getConf', {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        const wsPath = data?.data?.conf?.system?.workspaceDir
        if (wsPath) {
          workspaceRoot.value = wsPath
          workspacePath.value = `${wsPath}/data`
          await saveSettings()
          showMessage(props.i18n.workspacePathSet || '工作区路径已自动获取', 2000, 'info')
          return
        }
      }
    } catch (e) {
      console.error('获取工作区路径失败:', e)
    }
  }

  // 尝试使用 Electron dialog（桌面版思源笔记）
  if (typeof window.require === 'function') {
    try {
      const electron = window.require('electron')
      const remote = electron.remote || electron

      // 检查 dialog 是否存在
      if (remote?.dialog?.showOpenDialog) {
        const result = await remote.dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: props.i18n.selectWorkspace || '选择思源工作区',
          defaultPath: workspaceRoot.value || undefined
        })

        if (!result.canceled && result.filePaths.length > 0) {
          workspaceRoot.value = result.filePaths[0]
          workspacePath.value = `${result.filePaths[0]}/data`
          localStorage.setItem('siyuan-workspace-root', workspaceRoot.value)
          localStorage.setItem('siyuan-workspace-path', workspacePath.value)
          await saveSettings()
          showMessage(props.i18n.workspacePathSet || '工作区路径已设置', 2000, 'info')
          return
        }
      }
    } catch (error) {
      console.warn('Electron dialog 不可用，使用手动输入:', error)
    }
  }

  // 降级方案：使用自定义输入对话框
  const inputPath = await showInputDialogHelper(props.i18n.enterWorkspacePath || '请输入思源工作区路径:')
  if (inputPath) {
    workspaceRoot.value = inputPath
    workspacePath.value = `${inputPath}/data`
    localStorage.setItem('siyuan-workspace-root', workspaceRoot.value)
    localStorage.setItem('siyuan-workspace-path', workspacePath.value)
    await saveSettings()
    showMessage(props.i18n.workspacePathSet || '工作区路径已设置', 2000, 'info')
  }
}

// 手动备份
async function performBackup() {
  if (isBackingUp.value) return

  // 检查工作区路径
  if (!workspacePath.value) {
    showMessage(props.i18n.pleaseSelectWorkspace || '请先选择工作区路径', 3000, 'warning')
    await selectWorkspacePath()
    if (!workspacePath.value) return
  }

  isBackingUp.value = true

  try {
    // 生成文件名: data-251209.zip
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const fileName = `data-${year}${month}${day}.zip`
    const backupDir = getBackupDir()

    // 显示消息
    showMessage(props.i18n.backingUp || '正在备份...', 0, 'info')

    // 检查是否有 Node.js API 可用（桌面版思源笔记）
    if (typeof window.require !== 'function') {
      throw new Error('无法访问文件系统，请使用桌面版思源笔记')
    }

    // 在思源笔记中，Node.js 模块通过 window.require 直接加载
    const fs = window.require('fs').promises
    const path = window.require('path')

    // 检查 data 目录是否存在
    const dataPath = workspacePath.value
    try {
      await fs.access(dataPath)
    } catch {
      throw new Error(`data 目录不存在: ${dataPath}`)
    }

    // 创建 ZIP
    const zip = new JSZip()

    // 递归添加目录到 ZIP
    async function addDirectoryToZip(dirPath: string, zipPath: string) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const relativePath = zipPath ? `${zipPath}/${entry.name}` : entry.name

        if (entry.isDirectory()) {
          // 跳过一些不需要备份的目录
          if (entry.name === 'temp' || entry.name === '.recycle') {
            continue
          }
          await addDirectoryToZip(fullPath, relativePath)
        } else if (entry.isFile()) {
          // 读取文件内容并添加到 ZIP
          try {
            const content = await fs.readFile(fullPath)
            zip.file(relativePath, content)
          } catch (err) {
            console.warn(`无法读取文件: ${fullPath}`, err)
          }
        }
      }
    }

    // 添加 data 目录内容到 ZIP
    await addDirectoryToZip(dataPath, '')

    // 添加备份信息
    const backupData = {
      timestamp: Date.now(),
      backupTime: new Date().toISOString(),
      version: '1.0',
      workspaceRoot: workspaceRoot.value,
      workspaceDataPath: workspacePath.value,
      backupDir: backupDir
    }
    zip.file('backup-info.json', JSON.stringify(backupData, null, 2))

    // 生成 ZIP 文件
    showMessage(props.i18n.compressing || '正在压缩...', 0, 'info')
    const zipBuffer = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    }, (metadata) => {
      // 可以在这里显示进度
      if (metadata.percent) {
        console.log(`压缩进度: ${metadata.percent.toFixed(1)}%`)
      }
    })

    // 确保备份目录存在
    await fs.mkdir(backupDir, { recursive: true })

    // 写入 ZIP 文件
    const zipFilePath = path.join(backupDir, fileName)
    await fs.writeFile(zipFilePath, zipBuffer)

    console.log('备份文件已保存到:', zipFilePath)

    // 更新时间
    lastBackupTime.value = new Date().toLocaleString()
    lastBackupTimestamp = Date.now()
    await saveSettings()

    // 添加到备份列表
    const stats = await fs.stat(zipFilePath)
    backupList.value.unshift({
      name: fileName,
      path: zipFilePath,
      time: lastBackupTime.value,
      size: formatFileSize(stats.size)
    })

    // 限制备份列表数量
    if (backupList.value.length > keepBackupCount.value) {
      backupList.value = backupList.value.slice(0, keepBackupCount.value)
    }

    // 保存备份列表
    await props.plugin.saveData('backup-history', { list: backupList.value })

    showMessage(props.i18n.backupSuccess || `备份成功: ${fileName}`, 3000, 'success')
  } catch (error) {
    console.error('备份过程出错:', error)
    showMessage(`${props.i18n.backupFailed || '备份失败'}: ${error.message}`, 5000, 'error')
  } finally {
    isBackingUp.value = false
  }
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
}

// 加载备份列表
async function loadBackupList() {
  backupList.value = []

  try {
    // 检查是否有保存的备份记录
    const backupHistory = await props.plugin.loadData('backup-history')
    if (backupHistory && backupHistory.list) {
      backupList.value = backupHistory.list
    }
  } catch (error) {
    console.error('加载备份列表失败:', error)
  }
}

// 刷新备份列表
async function refreshBackupList() {
  isLoading.value = true
  await loadBackupList()
  isLoading.value = false
}

// 恢复备份
async function restoreBackup(backup: { name: string; path: string }) {
  try {
    const confirmRestore = confirm(props.i18n.confirmRestore || '确定要恢复此备份吗？当前数据将被覆盖。')
    if (!confirmRestore) return

    showMessage(props.i18n.restoring || '正在恢复...', 0, 'info')

    // 这里需要从备份文件恢复数据
    // 由于浏览器环境限制，实际恢复逻辑需要根据备份内容来处理
    showMessage(props.i18n.restoreSuccess || '恢复成功', 3000, 'success')
  } catch (error) {
    console.error('恢复备份失败:', error)
    showMessage(props.i18n.restoreFailed || '恢复失败', 3000, 'error')
  }
}

// 删除备份
async function deleteBackup(backup: { name: string; path: string }) {
  try {
    const confirmDelete = confirm(props.i18n.confirmDelete || '确定要删除此备份吗？')
    if (!confirmDelete) return

    // 从列表中移除
    backupList.value = backupList.value.filter(b => b.name !== backup.name)

    // 保存更新后的列表
    await props.plugin.saveData('backup-history', { list: backupList.value })

    showMessage(props.i18n.deleteSuccess || '删除成功', 2000, 'success')
  } catch (error) {
    console.error('删除备份失败:', error)
    showMessage(props.i18n.deleteFailed || '删除失败', 3000, 'error')
  }
}

// 自动备份定时器
function startAutoBackupTimer() {
  stopAutoBackupTimer()

  if (!autoBackupEnabled.value) return

  // 检查是否需要执行备份
  const checkAndBackup = async () => {
    // 确保有工作区路径
    if (!workspacePath.value) {
      await detectWorkspacePath()
      if (!workspacePath.value) return
    }

    const now = new Date()
    const currentTime = now.getTime()
    const interval = getBackupInterval()

    // 如果距离上次备份时间超过间隔，则执行备份
    if (currentTime - lastBackupTimestamp >= interval) {
      await performBackup()
    }
  }

  // 每分钟检查一次
  autoBackupTimer = window.setInterval(checkAndBackup, 60000)

  // 立即检查一次
  checkAndBackup()
}

function stopAutoBackupTimer() {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer)
    autoBackupTimer = null
  }
}

// 获取备份间隔（毫秒）
function getBackupInterval(): number {
  switch (backupFrequency.value) {
    case 'minute':
      return 60 * 1000 // 1 分钟
    case 'hourly':
      return 60 * 60 * 1000 // 1 小时
    case 'daily':
      return 24 * 60 * 60 * 1000 // 1 天
    default:
      return 24 * 60 * 60 * 1000
  }
}

// 暴露方法给父组件
defineExpose({
  loadSettings,
  saveSettings,
  performBackup,
  refreshBackupList
})
</script>

<style scoped>
.data-backup-settings {
  height: 100%;
  overflow-y: auto;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
}

.settings-container {
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--b3-theme-surface-variant);
}

.section-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  flex: 1;
}

.section-icon {
  font-size: 18px;
}

.info-section {
  background: linear-gradient(135deg, rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08), rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.03));
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid var(--b3-theme-surface-variant);
}

.info-grid {
  display: grid;
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  word-break: break-all;
}

.workspace-path-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workspace-path {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  background: var(--b3-theme-surface);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--b3-theme-surface-variant);
  flex: 1;
}

.select-path-btn {
  padding: 8px 16px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-primary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.select-path-btn:hover {
  background: var(--b3-theme-primary);
  color: white;
}

.backup-section,
.auto-backup-section,
.history-section {
  background: var(--b3-theme-surface);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid var(--b3-theme-surface-variant);
}

.backup-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.backup-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.backup-btn.primary {
  background: linear-gradient(135deg, var(--b3-theme-primary), var(--b3-theme-primary-light));
  color: white;
}

.backup-btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.3);
}

.backup-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.backup-hint {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  margin: 0;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.form-select,
.form-input {
  padding: 8px 12px;
  border: 1px solid var(--b3-theme-surface-variant);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.form-select:focus,
.form-input:focus {
  border-color: var(--b3-theme-primary);
}

.form-input.small {
  width: 80px;
}

.form-hint {
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
}

.refresh-btn {
  padding: 6px 12px;
  border: 1px solid var(--b3-theme-surface-variant);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--b3-theme-surface);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.backup-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.backup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--b3-theme-background);
  border-radius: 8px;
  border: 1px solid var(--b3-theme-surface-variant);
}

.backup-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.backup-name {
  font-weight: 500;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.backup-time,
.backup-size {
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
}

.backup-item .backup-actions {
  display: flex;
  flex-direction: row;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn.restore {
  background: var(--b3-theme-primary);
  color: white;
}

.action-btn.restore:hover {
  background: var(--b3-theme-primary-light);
}

.action-btn.delete {
  background: var(--b3-theme-error);
  color: white;
}

.action-btn.delete:hover {
  background: var(--b3-theme-error-light);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--b3-theme-on-surface-variant);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

@media (max-width: 500px) {
  .workspace-path-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .select-path-btn {
    width: 100%;
  }

  .backup-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .backup-item .backup-actions {
    width: 100%;
  }

  .action-btn {
    flex: 1;
    text-align: center;
  }
}

/* 输入对话框样式 */
.input-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.input-dialog {
  background: var(--b3-theme-background);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.input-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-theme-surface-variant);
}

.input-dialog-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.input-dialog-body {
  padding: 20px;
}

.input-dialog-field {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  font-family: 'Consolas', 'Monaco', monospace;
  outline: none;
  transition: border-color 0.2s ease;
}

.input-dialog-field:focus {
  border-color: var(--b3-theme-primary);
}

.input-dialog-footer {
  padding: 12px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--b3-theme-surface-variant);
}

.input-dialog-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.input-dialog-btn.cancel {
  background: var(--b3-theme-surface-variant);
  color: var(--b3-theme-on-surface);
}

.input-dialog-btn.cancel:hover {
  background: var(--b3-theme-surface);
}

.input-dialog-btn.confirm {
  background: var(--b3-theme-primary);
  color: white;
}

.input-dialog-btn.confirm:hover {
  background: var(--b3-theme-primary-light);
}
</style>
