<!-- 拖放文件即时校验区 — 拖入文件计算 SHA-256，可与已存储校验值比对 -->
<template>
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
          <span class="drop-result-name">{{ result.fileName }}</span>
          <span class="checksum-meta">
            <span class="checksum-size">{{ formatFileSize(result.fileSize) }}</span>
          </span>
        </div>
        <!-- SHA-256 哈希值 -->
        <div class="drop-result-hash">
          <code class="checksum-hash-value">{{ result.checksum }}</code>
        </div>
        <!-- 比对选择 + 结果徽章 -->
        <div class="drop-result-compare">
          <Select
            v-if="storedItems.length > 0"
            class="compare-select"
            :model-value="compareSelects[index] ?? ''"
            :options="compareOptions"
            size="xsmall"
            @update:model-value="onCompareChange(index, $event)"
          />
          <!-- 徽章："匹配" -->
          <Tag v-if="compareResults[index] === true" class="compare-badge" variant="success" size="xsmall">
            &#10003; {{ i18n.match }}
          </Tag>
          <!-- 徽章："不匹配" -->
          <Tag v-else-if="compareResults[index] === false" class="compare-badge" variant="danger" size="xsmall">
            &#10007; {{ i18n.mismatch }}
          </Tag>
        </div>
        <!-- 复制哈希 -->
        <div class="drop-result-copy">
          <!-- 按钮："复制" -->
          <Button variant="ghost" size="xsmall" @click="copyHash(result.checksum)">
            {{ i18n.copy }}
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { Icon } from "@iconify/vue"
import { showMessage } from "siyuan"
import { formatFileSize } from "@/utils/format"
import { copyToClipboard } from "@/utils/domUtils"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import Button from "@/components/Button.vue"
import Select from "@/components/Select.vue"
import Tag from "@/components/Tag.vue"
import type { FileChecksum } from "../../types"

const props = defineProps<{
  storedItems: FileChecksum[]
  /** 计算文件 SHA-256（由父容器注入，工作区未就绪时返回 null） */
  computeHash: (filePath: string) => Promise<string | null>
  /** 工作区是否已就绪（拖放校验依赖本地文件访问） */
  hasWorkspace: boolean
  i18n: Record<string, string>
}>()

/** 拖放即时校验结果（字段与 FileChecksum 对齐，仅省略不持久化的 time） */
type DropResult = Omit<FileChecksum, "time">

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

/** 比对目标下拉选项（首项为空值 = 未选择，与原生 select 的占位项语义一致） */
const compareOptions = computed(() => [
  { value: "", label: props.i18n.compareWith },
  ...props.storedItems.map((item) => ({ value: item.fileName, label: item.fileName })),
])

/** 比对目标变更：先写回选中值再比对，不依赖 v-model 的写回时序 */
function onCompareChange(index: number, rawValue: string | number | boolean | null): void {
  const targetName = rawValue === null ? "" : String(rawValue)
  compareSelects.value[index] = targetName
  if (!targetName) {
    compareResults.value[index] = undefined
    return
  }
  const target = props.storedItems.find((c) => c.fileName === targetName)
  const dropped = droppedResults.value[index]
  if (target && dropped) {
    compareResults.value[index] = dropped.checksum === target.checksum
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
  if (!props.hasWorkspace) {
    // 提示："请先选择工作区路径"
    showMessage(props.i18n.noWorkspace, 3000, "error")
    return
  }

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    const resolved = await resolveDropPath(file)
    if (!resolved) { continue }

    const { filePath, fileName, fileSize } = resolved

    try {
      const hash = await props.computeHash(filePath)
      if (hash === null) { continue }
      droppedResults.value.push({
        fileName,
        filePath,
        fileSize,
        checksum: hash,
      })
    } catch (err: unknown) {
      showMessage(`${fileName}: ${getErrorMessage(err)}`, 3000, "error")
    }
  }
}

/** 解析拖放文件的真实路径（优先级：webUtils.getPathForFile → file.path；返回值缺 checksum，由调用方哈希后补齐） */
async function resolveDropPath(file: File): Promise<Omit<DropResult, "checksum"> | null> {
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
@use "../../styles/DropVerifySection.scss";
@use "../../styles/index.scss";
</style>
