<template>
  <div class="markdown-export-settings">
    <div class="settings-section">
      <h4 class="section-title">Markdown 导出</h4>
      <p class="section-desc">一键导出所有笔记本为 Markdown 格式</p>
      
      <div class="export-actions">
        <button class="btn btn-primary" @click="showExportPanel" :disabled="exporting">
          <span class="btn-icon">📥</span>
          {{ exporting ? '导出中...' : '打开导出面板' }}
        </button>
      </div>

      <div class="export-info">
        <div class="info-item">
          <span class="info-label">笔记本总数:</span>
          <span class="info-value">{{ notebookCount }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">文档总数:</span>
          <span class="info-value">{{ totalDocCount }}</span>
        </div>
      </div>

      <div class="export-tips">
        <h5>使用说明:</h5>
        <ul>
          <li>点击"打开导出面板"按钮选择要导出的笔记本</li>
          <li>支持批量导出多个笔记本</li>
          <li>每个笔记本会打包成独立的 ZIP 文件</li>
          <li>ZIP 文件包含 Markdown 文档和相关资源(图片等)</li>
        </ul>
      </div>
    </div>

    <!-- 导出面板弹窗 -->
    <ExportPanel v-if="showPanel" :plugin="plugin" @close="closeExportPanel" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { lsNotebooks } from '@/api'
import ExportPanel from '@/features/markdownExport/components/ExportPanel.vue'

interface Props {
  i18n?: any
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null
})

const emitting = defineEmits(['change'])

const exporting = ref(false)
const showPanel = ref(false)
const notebookCount = ref(0)
const totalDocCount = ref(0)

onMounted(async () => {
  await loadNotebookStats()
})

async function loadNotebookStats() {
  try {
    const data = await lsNotebooks()
    if (data && data.notebooks) {
      notebookCount.value = data.notebooks.length
      totalDocCount.value = data.notebooks.reduce((sum: number, nb: any) => {
        return sum + (nb.docCount || 0)
      }, 0)
    }
  } catch (error) {
    console.error('加载笔记本统计信息失败:', error)
  }
}

function showExportPanel() {
  showPanel.value = true
}

function closeExportPanel() {
  showPanel.value = false
  // 刷新统计信息
  loadNotebookStats()
}
</script>

<style scoped lang="scss">
.markdown-export-settings {
  padding: 20px;
}

.settings-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0 0 8px;
}

.section-desc {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  margin: 0 0 20px;
}

.export-actions {
  margin-bottom: 24px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
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
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.btn-icon {
  font-size: 16px;
}

.export-info {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--b3-theme-surface-light);
  border-radius: 6px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.info-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}

.export-tips {
  padding: 16px;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  border-left: 3px solid var(--b3-theme-primary);

  h5 {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    margin: 0 0 12px;
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      font-size: 13px;
      color: var(--b3-theme-on-surface);
      line-height: 1.8;

      &::marker {
        color: var(--b3-theme-primary);
      }
    }
  }
}
</style>
