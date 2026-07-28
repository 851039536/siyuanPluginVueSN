<!-- Markdown 导出设置：批量导出笔记本/工作空间为 Markdown ZIP -->
<template>
  <div class="markdown-export-settings">
    <div class="settings-section">
      <!-- 标题："Markdown 导出" -->
      <h4 class="section-title">
        {{ t.title }}
      </h4>
      <!-- 描述："一键导出所有笔记本为 Markdown 格式" -->
      <p class="section-desc">
        {{ t.desc }}
      </p>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <div class="button-group">
          <!-- 按钮："导出选中的笔记本" / 导出中显示"导出中..." -->
          <Button
            variant="primary"
            icon="download"
            :disabled="exporting"
            :loading="exporting"
            @click="exportSelected"
          >
            {{ exporting ? t.exporting : t.exportSelected }}
          </Button>
          <!-- 按钮："一键导出所有笔记本" -->
          <Button
            variant="primary"
            icon="download"
            :disabled="exporting"
            :loading="exporting"
            @click="exportAllNotebooks"
          >
            {{ exporting ? t.exporting : t.exportAllNotebooks }}
          </Button>
          <!-- 按钮："一键导出工作空间" -->
          <Button
            variant="success"
            icon="download"
            :disabled="exporting"
            :loading="exporting"
            @click="exportAll"
          >
            {{ exporting ? t.exporting : t.exportWorkspace }}
          </Button>
        </div>
        <div class="button-group">
          <!-- 按钮："全选" -->
          <Button
            variant="secondary"
            @click="selectAll"
          >
            {{ t.selectAll }}
          </Button>
          <!-- 按钮："取消全选" -->
          <Button
            variant="secondary"
            @click="deselectAll"
          >
            {{ t.deselectAll }}
          </Button>
        </div>
      </div>

      <!-- 提示信息 -->
      <div class="export-tips">
        <!-- 提示："导出选中的笔记本"说明 -->
        <div class="tip-item">
          <IconWrapper
            name="info"
            class="tip-icon"
          />
          <span class="tip-text">{{ t.tipSelected }}</span>
        </div>
        <!-- 提示："一键导出所有笔记本"说明 -->
        <div class="tip-item">
          <IconWrapper
            name="info"
            class="tip-icon"
          />
          <span class="tip-text">{{ t.tipAllNotebooks }}</span>
        </div>
        <!-- 提示："一键导出工作空间"说明 -->
        <div class="tip-item">
          <IconWrapper
            name="info"
            class="tip-icon"
          />
          <span class="tip-text">{{ t.tipWorkspace }}</span>
        </div>
      </div>

      <!-- 笔记本列表 -->
      <div class="notebook-list">
        <!-- 加载状态："加载中..." -->
        <div
          v-if="loading"
          class="loading"
        >
          {{ t.loading }}
        </div>

        <!-- 空状态："没有找到笔记本" -->
        <div
          v-else-if="notebooks.length === 0"
          class="empty"
        >
          {{ t.empty }}
        </div>

        <div
          v-else
          class="notebook-items"
        >
          <label
            v-for="notebook in notebooks"
            :key="notebook.id"
            class="notebook-item"
            :class="{ selected: selectedNotebooks.has(notebook.id) }"
          >
            <input
              type="checkbox"
              :checked="selectedNotebooks.has(notebook.id)"
              @change="toggleNotebook(notebook.id)"
            />
            <IconWrapper
              name="notebook"
              class="notebook-icon"
            />
            <span class="notebook-name">{{ notebook.name }}</span>
            <!-- 文档计数："N 个文档" -->
            <span class="notebook-count">{{ t.docCount.replace("{n}", String(notebook.docCount || 0)) }}</span>
          </label>
        </div>
      </div>

      <!-- 导出进度 -->
      <div
        v-if="exportProgress.show"
        class="export-progress"
      >
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
      <div
        v-if="exportLogs.length > 0"
        class="export-logs"
      >
        <!-- 日志标题："导出日志" -->
        <h4>{{ t.logTitle }}</h4>
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
import { computed, onMounted } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useMarkdownExport } from "../composables/useMarkdownExport"

interface Props {
  i18n?: any
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
})

// markdownExport 键组文案
const t = computed(() => props.i18n.markdownExport)

const {
  loading,
  exporting,
  notebooks,
  selectedNotebooks,
  exportLogs,
  exportProgress,
  loadNotebooks,
  toggleNotebook,
  selectAll,
  deselectAll,
  exportSelected,
  exportAllNotebooks,
  exportAll,
} = useMarkdownExport(props.i18n)

onMounted(async () => {
  await loadNotebooks()
})
</script>

<style lang="scss" scoped>
@use "../styles/MarkdownExportSettings.scss";
@use "../styles/index.scss";
</style>
