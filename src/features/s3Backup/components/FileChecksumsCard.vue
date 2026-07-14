<!-- 文件校验卡片 — 已存储校验值列表 + 拖放文件即时校验 -->
<template>
  <div class="checksums-container">
    <!-- 已存储校验值 -->
    <section class="card-section">
      <div class="section-header">
        <h4>{{ i18n.storedChecksums || "已存储校验值" }}</h4>
        <div class="section-header-actions">
          <Button
            v-if="storedItems.length > 0"
            variant="ghost"
            size="xsmall"
            :disabled="isVerifyingAll"
            @click="verifyAll"
          >
            {{ i18n.verifyAll || "验证全部" }}
          </Button>
          <Button
            v-if="storedItems.length > 0"
            variant="ghost"
            size="xsmall"
            @click="$emit('clear')"
          >
            {{ i18n.clearAll || "清空" }}
          </Button>
        </div>
      </div>
      <div v-if="storedItems.length > 0" class="checksum-list">
        <div
          v-for="item in storedItems"
          :key="item.fileName"
          class="checksum-item"
          :class="{ 'verify-mismatch': verifyResults[item.fileName] === false, 'verify-match': verifyResults[item.fileName] === true }"
        >
          <div class="checksum-main">
            <span class="checksum-name">{{ item.fileName }}</span>
            <span class="checksum-path-icon" :title="item.filePath" :aria-label="item.filePath">&#9432;</span>
            <span class="checksum-meta">
              <span class="checksum-size">{{ formatFileSize(item.fileSize) }}</span>
              <span class="log-sep">·</span>
              <span class="checksum-time">{{ formatTime(item.time) }}</span>
            </span>
          </div>
          <div class="checksum-hash">
            <code class="checksum-hash-value">{{ item.checksum.slice(0, 16) }}...</code>
          </div>
          <div class="checksum-actions">
            <span v-if="verifyResults[item.fileName] === undefined" class="verify-badge">
              <Button
                variant="ghost"
                size="xsmall"
                :disabled="verifyingItems[item.fileName]"
                @click="verifyOne(item)"
              >
                {{ i18n.verify || "验证" }}
              </Button>
            </span>
            <span
              v-else-if="verifyResults[item.fileName] === true"
              class="verify-badge verify-ok"
            >
              {{ i18n.match || "匹配" }}
            </span>
            <span v-else class="verify-badge verify-fail">
              {{ i18n.mismatch || "不匹配" }}
            </span>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <p>{{ i18n.noChecksums || "暂无校验值" }}</p>
      </div>
    </section>

    <!-- 拖放文件校验 -->
    <section class="card-section">
      <div class="section-header">
        <h4>{{ i18n.dropVerify || "拖放文件校验" }}</h4>
        <Button
          v-if="droppedResults.length > 0"
          variant="ghost"
          size="xsmall"
          @click="droppedResults = []"
        >
          {{ i18n.clearResults || "清空结果" }}
        </Button>
      </div>
      <div
        class="drop-zone"
        :class="{ 'drop-active': isDragging }"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
        @dragenter.prevent="onDragEnter"
      >
        <div class="drop-zone-content">
          <span class="drop-zone-icon">📂</span>
          <span>{{ i18n.dropHint || "拖放文件到此区域进行校验" }}</span>
        </div>
      </div>
      <div v-if="droppedResults.length > 0" class="drop-results">
        <div
          v-for="result in droppedResults"
          :key="result.name + result.path"
          class="drop-result-item"
        >
          <div class="drop-result-info">
            <span class="drop-result-name">{{ result.name }}</span>
            <span class="checksum-meta">
              <span class="checksum-size">{{ formatFileSize(result.size) }}</span>
            </span>
          </div>
          <div class="drop-result-hash">
            <code class="checksum-hash-value">{{ result.hash }}</code>
          </div>
          <div class="drop-result-copy">
            <Button variant="ghost" size="xsmall" @click="copyHash(result.hash)">
              {{ i18n.copy || "复制" }}
            </Button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { formatFileSize, formatTime } from "@/utils/format"
import { copyToClipboard } from "@/utils/domUtils"
import { getNodeModules } from "@/utils/nodeModules"
import { showMessage } from "siyuan"
import Button from "@/components/Button.vue"
import { BackupManager } from "../modules/BackupManager"
import type { FileChecksum } from "../types"

const props = defineProps<{
  storedItems: FileChecksum[]
  workspaceRoot: string
  i18n: Record<string, string>
}>()

defineEmits<{
  (e: "clear"): void
}>()

// ========== 存储校验值验证状态 ==========

const verifyResults = ref<Record<string, boolean | undefined>>({})
const verifyingItems = ref<Record<string, boolean>>({})
const isVerifyingAll = ref(false)

function getManager(): BackupManager | null {
  if (!props.workspaceRoot) { return null }
  return new BackupManager(props.workspaceRoot)
}

async function verifyOne(item: FileChecksum): Promise<void> {
  const manager = getManager()
  if (!manager) { return }
  verifyingItems.value = { ...verifyingItems.value, [item.fileName]: true }
  try {
    const hash = await manager.computeFileHash(item.filePath)
    verifyResults.value = { ...verifyResults.value, [item.fileName]: hash === item.checksum }
  } catch (err: any) {
    verifyResults.value = { ...verifyResults.value, [item.fileName]: false }
    showMessage(`${item.fileName}: ${err.message}`, 3000, "error")
  } finally {
    verifyingItems.value = { ...verifyingItems.value, [item.fileName]: false }
  }
}

async function verifyAll(): Promise<void> {
  isVerifyingAll.value = true
  for (const item of props.storedItems) {
    await verifyOne(item)
  }
  isVerifyingAll.value = false
}

// ========== 拖放校验 ==========

interface DropResult {
  name: string
  path: string
  size: number
  hash: string
}

const droppedResults = ref<DropResult[]>([])
const isDragging = ref(false)

function onDragEnter(e: DragEvent): void {
  e.dataTransfer!.dropEffect = "copy"
}

function onDragOver(e: DragEvent): void {
  isDragging.value = true
  e.dataTransfer!.dropEffect = "copy"
}

function onDragLeave(): void {
  isDragging.value = false
}

async function onDrop(e: DragEvent): Promise<void> {
  isDragging.value = false
  const fileList = e.dataTransfer?.files
  if (!fileList || fileList.length === 0) { return }

  const manager = getManager()
  if (!manager) {
    showMessage("无法访问文件系统，请使用桌面版思源笔记", 3000, "error")
    return
  }

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    const filePath = await resolveDropPath(file)
    if (!filePath) { continue }

    let fileSize = file.size
    let fileName = file.name

    // 文件选择器兜底后 file.size 可能不准确，按实际文件大小更新
    if (filePath !== (file as any).path) {
      try {
        const node = getNodeModules()
        if (node) {
          const stats = await node.fs.promises.stat(filePath)
          fileSize = stats.size
          const pathModule = node.path
          fileName = pathModule.basename(filePath)
        }
      } catch { /* use original */ }
    }

    try {
      const hash = await manager.computeFileHash(filePath)
      droppedResults.value.push({
        name: fileName,
        path: filePath,
        size: fileSize,
        hash,
      })
    } catch (err: any) {
      showMessage(`${fileName}: ${err.message}`, 3000, "error")
    }
  }
}

/**
 * 解析拖放文件的真实路径
 * Electron 环境下 file.path 可能不可用（contextIsolation 阻断），
 * 或路径不存在（文件已移动），此时弹出文件选择对话框让用户重新定位
 */
async function resolveDropPath(file: File): Promise<string | null> {
  const rawPath = (file as any).path as string | undefined

  // 检查原始路径是否存在
  if (rawPath) {
    try {
      const node = getNodeModules()
      if (node) {
        await node.fs.promises.access(rawPath)
        return rawPath
      }
    } catch { /* fall through to picker */ }
  }

  return pickFile(rawPath ? `原始路径失效，请重新选择: ${rawPath}` : `拖放失败，请手动选择: ${file.name}`)
}

/** 使用 Electron 原生对话框选择单个文件 */
async function pickFile(title: string): Promise<string | null> {
  if (typeof window.require !== "function") { return null }
  try {
    let remote: any
    try {
      remote = window.require("@electron/remote")
    } catch {
      const electron = window.require("electron")
      remote = electron.remote || electron
    }
    if (remote?.dialog?.showOpenDialog) {
      const result = await remote.dialog.showOpenDialog({
        properties: ["openFile"],
        title,
      })
      if (!result.canceled && result.filePaths[0]) {
        return result.filePaths[0]
      }
    }
  } catch { /* fallback */ }
  return null
}

function copyHash(hash: string): void {
  copyToClipboard(hash)
  showMessage("SHA-256 已复制", 1500, "info")
}
</script>

<style scoped lang="scss">
@use "../styles/FileChecksumsCard.scss";
@use "../styles/index.scss";
</style>
