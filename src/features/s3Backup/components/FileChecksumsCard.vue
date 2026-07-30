<!-- 文件校验卡片 — 已存储校验值列表 + 拖放文件即时校验 -->
<template>
  <div class="checksums-container">

    <!-- 拖放文件校验 -->
    <section class="card-section">
      <!-- 区块标题 + 清空按钮 -->
      <div class="section-header">
        <!-- 标题："拖放文件校验" -->
        <h4>{{ i18n.dropVerify }}</h4>
        <!-- 按钮："清空结果" -->
        <Button v-if="droppedResults.length > 0" variant="ghost" size="xsmall" @click="clearDropResults">
          {{ i18n.clearResults }}
        </Button>
      </div>
      <!-- 拖放区域 -->
      <div
        class="drop-zone"
        :class="{ 'drop-active': isDragging }"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
        @dragenter.prevent="onDragEnter"
      >
        <div class="drop-zone-content">
          <Icon icon="mdi:folder-open-outline" class="drop-zone-icon" />
          <span>{{ i18n.dropHint }}</span>
        </div>
      </div>
      <!-- 拖放校验结果列表 -->
      <div v-if="droppedResults.length > 0" class="drop-results">
        <div
          v-for="(result, index) in droppedResults"
          :key="index"
          class="drop-result-item"
          :class="{ 'drop-compare-match': compareResults[index] === true, 'drop-compare-mismatch': compareResults[index] === false }"
        >
          <!-- 文件名 + 大小 -->
          <div class="drop-result-info">
            <span class="drop-result-name">{{ result.name }}</span>
            <span class="checksum-meta">
              <span class="checksum-size">{{ formatFileSize(result.size) }}</span>
            </span>
          </div>
          <!-- SHA-256 哈希值 -->
          <div class="drop-result-hash">
            <code class="checksum-hash-value">{{ result.hash }}</code>
          </div>
          <!-- 比对选择 + 结果徽章 -->
          <div class="drop-result-compare">
            <select
              v-if="storedItems.length > 0"
              v-model="compareSelects[index]"
              class="compare-select"
              @change="onCompareChange(index)"
            >
              <!-- 选项："比对..." -->
              <option value="">{{ i18n.compareWith }}</option>
              <option v-for="item in storedItems" :key="item.fileName" :value="item.fileName">
                {{ item.fileName }}
              </option>
            </select>
            <!-- 徽章："匹配" -->
            <span v-if="compareResults[index] === true" class="compare-badge compare-ok">
              &#10003; {{ i18n.match }}
            </span>
            <!-- 徽章："不匹配" -->
            <span v-else-if="compareResults[index] === false" class="compare-badge compare-fail">
              &#10007; {{ i18n.mismatch }}
            </span>
          </div>
          <!-- 复制哈希 -->
          <div class="drop-result-copy">
            <!-- 按钮："复制" -->
            <Button variant="ghost" size="xsmall" @click="copyHash(result.hash)">
              {{ i18n.copy }}
            </Button>
          </div>
        </div>
      </div>
    </section>

    <!-- 已存储校验值 -->
    <section class="card-section">
      <!-- 区块标题 + 操作按钮 -->
      <div class="section-header">
        <!-- 标题："已存储校验值" -->
        <h4>{{ i18n.storedChecksums }}</h4>
        <div class="section-header-actions">
          <!-- 按钮："验证全部" -->
          <Button
            v-if="storedItems.length > 0"
            variant="ghost"
            size="xsmall"
            :disabled="isVerifyingAll"
            @click="verifyAll"
          >
            {{ i18n.verifyAll }}
          </Button>
          <!-- 按钮："清空" -->
          <Button
            v-if="storedItems.length > 0"
            variant="ghost"
            size="xsmall"
            @click="confirmClearAll"
          >
            {{ i18n.clearAll }}
          </Button>
        </div>
      </div>
      <!-- 校验值列表 -->
      <div v-if="storedItems.length > 0" class="checksum-list">
        <div
          v-for="item in storedItems"
          :key="item.fileName"
          class="checksum-item"
          :class="{ 'verify-mismatch': verifyResults[item.fileName] === false, 'verify-match': verifyResults[item.fileName] === true }"
        >
          <div class="checksum-main">
            <!-- 文件名 -->
            <span class="checksum-name">{{ item.fileName }}</span>
            <!-- 文件路径提示图标 -->
            <span class="checksum-path-icon" :title="item.filePath" :aria-label="item.filePath">
              <Icon icon="mdi:information-outline" />
            </span>
            <!-- 文件大小 + 时间 -->
            <span class="checksum-meta">
              <span class="checksum-size">{{ formatFileSize(item.fileSize) }}</span>
              <span class="checksum-sep">·</span>
              <span class="checksum-time">{{ formatTime(item.time) }}</span>
              <!-- 相对时间（如"5分钟前"） -->
              <span class="checksum-relative">{{ formatRelativeTime(item.time) }}</span>
            </span>
            <!-- 操作按钮区 -->
            <div class="checksum-actions">
              <!-- 按钮："验证"（始终显示，支持单条重验） -->
              <Button
                variant="ghost"
                size="xsmall"
                :disabled="verifyingItems[item.fileName] || isVerifyingAll"
                @click="verifyOne(item)"
              >
                {{ i18n.verify }}
              </Button>
              <!-- 徽章："匹配" -->
              <span
                v-if="verifyResults[item.fileName] === true"
                class="verify-badge verify-ok"
              >
                {{ i18n.match }}
              </span>
              <!-- 徽章："不匹配" -->
              <span v-else-if="verifyResults[item.fileName] === false" class="verify-badge verify-fail">
                {{ i18n.mismatch }}
              </span>
              <!-- 按钮："删除" -->
              <Button
                variant="ghost"
                size="xsmall"
                @click="confirmRemoveOne(item.fileName)"
              >
                {{ i18n.removeChecksum }}
              </Button>
            </div>
          </div>
          <!-- 校验值哈希（截取前 16 位） -->
          <div class="checksum-hash">
            <code class="checksum-hash-value">{{ item.checksum.slice(0, 16) }}...</code>
          </div>
        </div>
      </div>
      <!-- 空状态 -->
      <div v-else class="empty-state">
        <!-- 提示："暂无校验值" -->
        <p>{{ i18n.noChecksums }}</p>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import { Icon } from "@iconify/vue"
import { formatFileSize, formatRelativeTime, formatTime } from "@/utils/format"
import { copyToClipboard } from "@/utils/domUtils"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import { showMessage } from "siyuan"
import Button from "@/components/Button.vue"
import { BackupManager } from "../modules/BackupManager"
import type { FileChecksum } from "../types"

const props = defineProps<{
  storedItems: FileChecksum[]
  workspaceRoot: string
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  (e: "clear"): void
  (e: "removeOne", fileName: string): void
}>()

// ========== 存储校验值验证状态 ==========

const verifyResults = ref<Record<string, boolean | undefined>>({})
const verifyingItems = ref<Record<string, boolean>>({})
const isVerifyingAll = ref(false)

/** storedItems 变化时剔除已不存在的校验记录 */
watch(() => props.storedItems, (items) => {
  const names = new Set(items.map((i) => i.fileName))
  for (const key of Object.keys(verifyResults.value)) {
    if (!names.has(key)) { delete verifyResults.value[key] }
  }
  for (const key of Object.keys(verifyingItems.value)) {
    if (!names.has(key)) { delete verifyingItems.value[key] }
  }
})

/** 惰性缓存的 BackupManager 单实例（workspaceRoot 变化时重建，避免每次校验重复创建） */
let cachedManager: BackupManager | null = null
let cachedRoot = ""

function getManager(): BackupManager | null {
  if (!props.workspaceRoot) { return null }
  if (!cachedManager || cachedRoot !== props.workspaceRoot) {
    try {
      cachedManager = new BackupManager(props.workspaceRoot)
      cachedRoot = props.workspaceRoot
    } catch (err: unknown) {
      showMessage(getErrorMessage(err), 3000, "error")
      return null
    }
  }
  return cachedManager
}

async function verifyOne(item: FileChecksum): Promise<void> {
  const manager = getManager()
  if (!manager) { return }
  verifyingItems.value[item.fileName] = true
  try {
    const hash = await manager.computeFileHash(item.filePath)
    verifyResults.value[item.fileName] = hash === item.checksum
  } catch (err: unknown) {
    verifyResults.value[item.fileName] = false
    showMessage(`${item.fileName}: ${getErrorMessage(err)}`, 3000, "error")
  } finally {
    verifyingItems.value[item.fileName] = false
  }
}

async function verifyAll(): Promise<void> {
  isVerifyingAll.value = true
  for (const item of props.storedItems) {
    await verifyOne(item)
  }
  isVerifyingAll.value = false
}

function confirmRemoveOne(fileName: string): void {
  const confirmed = confirm(props.i18n.confirmRemoveChecksum)
  if (!confirmed) { return }
  emit("removeOne", fileName)
}

function confirmClearAll(): void {
  const confirmed = confirm(props.i18n.confirmClearAll)
  if (!confirmed) { return }
  emit("clear")
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
const compareSelects = ref<Record<number, string>>({})
const compareResults = ref<Record<number, boolean | undefined>>({})

/** 清空拖放结果及所有比对状态（防止旧比对状态污染新拖放结果） */
function clearDropResults(): void {
  droppedResults.value = []
  compareSelects.value = {}
  compareResults.value = {}
}

function onCompareChange(index: number): void {
  const targetName = compareSelects.value[index]
  if (!targetName) {
    compareResults.value[index] = undefined
    return
  }
  const target = props.storedItems.find((c) => c.fileName === targetName)
  const dropped = droppedResults.value[index]
  if (target && dropped) {
    compareResults.value[index] = dropped.hash === target.checksum
  }
}

function onDragEnter(e: DragEvent): void {
  isDragging.value = true
  e.dataTransfer!.dropEffect = "copy"
}

function onDragOver(e: DragEvent): void {
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
    if (!props.workspaceRoot) {
      showMessage(props.i18n.noWorkspace, 3000, "error")
    }
    return
  }

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    const resolved = await resolveDropPath(file)
    if (!resolved) { continue }

    const { filePath, fileName, fileSize } = resolved

    try {
      const hash = await manager.computeFileHash(filePath)
      droppedResults.value.push({
        name: fileName,
        path: filePath,
        size: fileSize,
        hash,
      })
    } catch (err: unknown) {
      showMessage(`${fileName}: ${getErrorMessage(err)}`, 3000, "error")
    }
  }
}

interface ResolvedDropPath {
  filePath: string
  fileName: string
  fileSize: number
}

/** 解析拖放文件的真实路径（优先级：webUtils.getPathForFile → file.path） */
async function resolveDropPath(file: File): Promise<ResolvedDropPath | null> {
  let filePath: string | null = null
  const node = getNodeModules()

  // 1. Electron webUtils API（最可靠，不受 contextIsolation 影响）
  try {
    if (typeof window.require === "function") {
      const electron = window.require("electron")
      const webPath = electron?.webUtils?.getPathForFile?.(file)
      if (webPath && node) {
        await node.fs.promises.access(webPath)
        filePath = webPath
      }
    }
  } catch { /* webUtils 不可用 */ }

  // 2. file.path 属性（兼容旧版 / contextIsolation 关闭的环境）
  if (!filePath) {
    const rawPath = (file as File & { path?: string }).path
    if (rawPath) {
      try {
        if (node) { await node.fs.promises.access(rawPath); filePath = rawPath }
      } catch { /* fall through */ }
    }
  }

  if (!filePath) { return null }

  // 获取实际文件名和大小
  try {
    if (node) {
      const stats = await node.fs.promises.stat(filePath)
      return {
        filePath,
        fileName: node.path.basename(filePath),
        fileSize: stats.size,
      }
    }
  } catch { /* use fallback values */ }

  return {
    filePath,
    fileName: file.name,
    fileSize: file.size,
  }
}

function copyHash(hash: string): void {
  copyToClipboard(hash)
  // 提示："SHA-256 已复制"
  showMessage(props.i18n.hashCopied, 1500, "info")
}
</script>

<style scoped lang="scss">
@use "../styles/FileChecksumsCard.scss";
@use "../styles/index.scss";
</style>
