<template>
  <div class="file-list-section">
    <div class="section-header">
      <span class="section-title">{{ i18n.fileList || '文件列表' }}</span>
      <div class="header-actions">
        <button
          v-if="currentPath !== '/'"
          class="btn-icon-small"
          :title="i18n.goBack || '返回上级'"
          @click="onGoBack"
        >
          <Icon icon="mdi:arrow-up" />
        </button>
        <button
          class="btn-icon-small"
          :title="i18n.refresh || '刷新'"
          :disabled="loading"
          @click="onRefresh"
        >
          <Icon
            icon="mdi:refresh"
            :class="{ 'spin-icon': loading }"
          />
        </button>
      </div>
    </div>

    <div class="current-path">
      <span class="path-label">{{ i18n.currentPath || '当前路径' }}:</span>
      <span class="path-value">{{ currentPath || '/' }}</span>
    </div>

    <div
      v-if="files.length > 0"
      class="file-list"
    >
      <div
        v-for="file in files"
        :key="file.path"
        class="file-item"
        :class="{ 'is-directory': file.isDirectory }"
        @click="onFileClick(file)"
        @dblclick="onFileDoubleClick(file)"
      >
        <div class="file-icon">
          {{ getFileIcon(file) }}
        </div>
        <div class="file-info">
          <div class="file-name">
            {{ file.name }}
          </div>
          <div class="file-meta">
            <span
              v-if="!file.isDirectory"
              class="file-size"
            >{{ formatFileSize(file.size) }}</span>
            <span
              v-if="file.lastModified"
              class="file-date"
            >{{ formatTime(file.lastModified) }}</span>
          </div>
        </div>
        <div
          v-if="selectedFile?.path === file.path"
          class="file-actions"
        >
          <button
            v-if="file.isDirectory"
            class="btn-icon-small btn-primary"
            :title="i18n.openFolder || '打开文件夹'"
            @click.stop="onOpenFolder(file)"
          >
            <Icon icon="mdi:folder-open" />
          </button>
          <button
            v-else
            class="btn-icon-small btn-primary"
            :title="i18n.download || '下载'"
            @click.stop="onDownload(file)"
          >
            <Icon icon="mdi:download" />
          </button>
        </div>
        <div
          class="file-type-badge"
          :class="{ directory: file.isDirectory }"
        >
          {{ file.isDirectory ? (i18n.folder || '文件夹') : (i18n.file || '文件') }}
        </div>
      </div>
    </div>

    <div
      v-else-if="!loading"
      class="empty-files"
    >
      <div class="empty-icon">
        📂
      </div>
      <div class="empty-text">
        {{ i18n.noFiles || '暂无文件' }}
      </div>
    </div>

    <div
      v-else
      class="loading-files"
    >
      <Icon
        icon="mdi:loading"
        class="spin-icon"
      />
      <span>{{ i18n.loadingFiles || '正在加载文件列表...' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WebDAVFile } from "../types"
import { Icon } from "@iconify/vue"
import { ref } from "vue"
import {
  formatFileSize,
  formatTime,
  getFileIcon,
} from "../utils"

interface Props {
  files: WebDAVFile[]
  currentPath: string
  loading: boolean
  i18n: Record<string, any>
}

const props = defineProps<Props>()

const emit = defineEmits<Emits>()

interface Emits {
  (e: "refresh"): void
  (e: "navigate", path: string): void
  (e: "download", file: WebDAVFile): void
}

const selectedFile = ref<WebDAVFile | null>(null)

const onRefresh = () => {
  emit("refresh")
}

const onFileClick = (file: WebDAVFile) => {
  if (selectedFile.value?.path === file.path) {
    selectedFile.value = null
  } else {
    selectedFile.value = file
  }
}

const onFileDoubleClick = (file: WebDAVFile) => {
  if (file.isDirectory) {
    emit("navigate", file.path)
    selectedFile.value = null
  } else {
    emit("download", file)
  }
}

const onGoBack = () => {
  const path = props.currentPath
  if (path === "/" || !path) return

  const parentPath = path.split("/").slice(0, -1).join("/") || "/"
  emit("navigate", parentPath)
}

const onOpenFolder = (file: WebDAVFile) => {
  emit("navigate", file.path)
  selectedFile.value = null
}

const onDownload = (file: WebDAVFile) => {
  emit("download", file)
}
</script>

<style scoped lang="scss">
@use "sass:color";
@use "@/variables" as *;

// 按钮样式
.btn-icon-small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover:not(:disabled) {
    background: var(--background-hover, #f3f4f6);
    color: var(--text-color, #374151);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.btn-primary {
    color: #3b82f6;

    &:hover:not(:disabled) {
      background: rgba(59, 130, 246, 0.1);
      color: #2563eb;
    }
  }

  .spin-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
}

.file-list-section {
  width: 100%;
  margin-bottom: 24px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--background-secondary, #f9fafb);
    border-bottom: 1px solid var(--border-color, #e5e7eb);

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .header-actions {
      display: flex;
      gap: 4px;
    }
  }

  .current-path {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--background-tertiary, #f3f4f6);
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    font-size: 12px;

    .path-label {
      color: var(--text-muted, #9ca3af);
    }

    .path-value {
      color: var(--text-color, #374151);
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      word-break: break-all;
    }
  }

  .file-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    cursor: pointer;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: var(--background-hover, #f3f4f6);
    }

    &.is-directory {
      .file-name {
        color: #3b82f6;
        font-weight: 500;
      }
    }

    &.selected {
      background: rgba(59, 130, 246, 0.1);
      border-left: 3px solid #3b82f6;
    }

    .file-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .file-info {
      flex: 1;
      min-width: 0;

      .file-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-color, #374151);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .file-meta {
        display: flex;
        gap: 12px;
        margin-top: 2px;
        font-size: 12px;
        color: var(--text-muted, #9ca3af);
      }
    }

    .file-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .file-type-badge {
      padding: 2px 8px;
      font-size: 11px;
      border-radius: 4px;
      background: var(--background-secondary, #f3f4f6);
      color: var(--text-secondary, #6b7280);
      flex-shrink: 0;

      &.directory {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
      }
    }
  }

  .empty-files {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    color: var(--text-muted, #9ca3af);

    .empty-icon {
      font-size: 40px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .empty-text {
      font-size: 14px;
    }
  }

  .loading-files {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 16px;
    color: var(--text-secondary, #6b7280);
    font-size: 14px;
  }
}

:global(.dark) {
  .file-list-section {
    border-color: var(--border-color, #374151);

    .section-header {
      background: var(--background-secondary, #111827);

      .section-title {
        color: var(--text-secondary, #9ca3af);
      }
    }

    .current-path {
      background: var(--background-tertiary, #1f2937);
      border-color: var(--border-color, #374151);

      .path-label {
        color: var(--text-muted, #6b7280);
      }

      .path-value {
        color: var(--text-color, #f9fafb);
      }
    }

    .file-item {
      border-color: var(--border-color, #374151);

      &:hover {
        background: var(--background-hover, #374151);
      }

      &.is-directory {
        .file-name {
          color: #60a5fa;
        }
      }

      &.selected {
        background: rgba(59, 130, 246, 0.2);
        border-left-color: #60a5fa;
      }

      .file-info {
        .file-name {
          color: var(--text-color, #f9fafb);
        }

        .file-meta {
          color: var(--text-muted, #6b7280);
        }
      }

      .file-type-badge {
        background: var(--background-secondary, #111827);
        color: var(--text-secondary, #9ca3af);

        &.directory {
          background: rgba(59, 130, 246, 0.2);
        }
      }
    }

    .empty-files {
      color: var(--text-muted, #6b7280);
    }

    .loading-files {
      color: var(--text-secondary, #9ca3af);
    }
  }
}
</style>
