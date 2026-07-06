<template>
  <div
    v-if="visible"
    class="image-viewer-overlay"
    @click="onClose"
  >
    <div
      class="image-viewer"
      @click.stop
    >
      <div class="viewer-header">
        <div class="header-left">
          <h2>{{ i18n.title }}</h2>
          <span
            v-if="images.length > 0"
            class="image-count"
          >
            <template v-if="minFileSize > 0">
              {{ filteredImages.length }} / {{ images.length }}
            </template>
            <template v-else>
              {{ images.length }}
            </template>
            {{ i18n.foundImages?.replace('{count}', '') }}
          </span>
        </div>
        <div class="header-right">
          <button
            class="icon-btn"
            :title="i18n.cancel"
            @click="onClose"
          >
            <svg class="icon"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
      </div>

      <div class="viewer-toolbar">
        <SiButton
          :loading="scanning"
          @click="onScanImages"
        >
          {{ scanning ? i18n.scanning : i18n.scanImages }}
        </SiButton>

        <div class="filter-group">
          <SiSelect
            :options="minFileSizeOptions"
            :model-value="scanMinFileSize"
            :label="i18n.scanFilterLabel"
            size="xsmall"
            @update:model-value="(v) => scanMinFileSize = Number(v)"
          />
        </div>

        <div class="filter-group">
          <SiSelect
            :options="minFileSizeOptions"
            :model-value="minFileSize"
            :label="i18n.displayFilterLabel"
            size="xsmall"
            @update:model-value="(v) => minFileSize = Number(v)"
          />
        </div>

        <div class="toolbar-spacer"></div>

        <template v-if="totalPages > 1">
          <div class="pagination-controls">
            <SiButton
              variant="ghost"
              size="xsmall"
              :disabled="currentPage === 1"
              @click="currentPage = 1"
            >
              {{ i18n.firstPage }}
            </SiButton>
            <SiButton
              variant="ghost"
              size="xsmall"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              {{ i18n.prevPage }}
            </SiButton>
            <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
            <SiButton
              variant="ghost"
              size="xsmall"
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >
              {{ i18n.nextPage }}
            </SiButton>
            <SiButton
              variant="ghost"
              size="xsmall"
              :disabled="currentPage === totalPages"
              @click="currentPage = totalPages"
            >
              {{ i18n.lastPage }}
            </SiButton>
            <SiSelect
              :options="pageSizeOptions"
              :model-value="pageSize"
              size="xsmall"
              @update:model-value="(v) => { pageSize = Number(v); currentPage = 1 }"
            />
          </div>
        </template>

        <SiButton
          variant="ghost"
          :disabled="filteredImages.length === 0"
          @click="onSelectAll"
        >
          {{ i18n.selectAll }}
        </SiButton>
        <SiButton
          variant="ghost"
          :disabled="selectedImages.size === 0"
          @click="onDeselectAll"
        >
          {{ i18n.deselectAll }}
        </SiButton>
        <SiButton
          :loading="compressing"
          :disabled="selectedImages.size === 0"
          @click="onCompress"
        >
          {{ compressing ? i18n.compressing : i18n.compress }}
          <span v-if="selectedImages.size > 0">({{ selectedImages.size }})</span>
        </SiButton>
      </div>

      <div
        v-if="scanning"
        class="progress-bar"
      >
        <div
          class="progress-fill"
          :style="{ width: `${scanProgress}%` }"
        ></div>
        <span class="progress-text">{{ scanProgressText }}</span>
      </div>

      <div
        v-if="paginatedImages.length > 0"
        ref="imageListRef"
        class="image-list"
      >
        <div
          v-for="image in paginatedImages"
          :key="image.path"
          class="image-item"
          :class="{ selected: selectedImages.has(image.path) }"
        >
          <div
            class="image-checkbox"
            @click.stop="toggleSelect(image.path)"
          >
            <input
              type="checkbox"
              :checked="selectedImages.has(image.path)"
              @click.stop="toggleSelect(image.path)"
            />
          </div>
          <div
            class="image-preview"
            @click.stop="previewImage(image)"
          >
            <img
              v-if="image.url"
              :src="image.url"
              :alt="image.name"
              loading="lazy"
              @error="onImageError"
            />
            <div
              v-else
              class="image-placeholder"
            >
              <svg class="icon"><use xlink:href="#iconImage"></use></svg>
              <p>{{ i18n.loadingImage }}</p>
            </div>
            <div class="preview-hint">
              <svg class="icon"><use xlink:href="#iconEye"></use></svg>
              {{ i18n.clickToPreview }}
            </div>
          </div>
          <div
            class="image-info"
            @click.stop="toggleSelect(image.path)"
          >
            <div
              class="image-name"
              :title="image.name"
            >
              {{ image.name }}
            </div>
            <div class="image-actions">
              <button
                class="action-btn"
                :title="i18n.copyImageNameTitle"
                @click.stop="copyImageName(image.name)"
              >
                <svg class="icon"><use xlink:href="#iconCopy"></use></svg>
                {{ i18n.copyBtn }}
              </button>
              <button
                class="action-btn"
                :title="i18n.navigateToDocBtn"
                @click.stop="navigateToDoc(image)"
              >
                <svg class="icon"><use xlink:href="#iconLink"></use></svg>
                {{ i18n.navigateToDocBtn }}
              </button>
            </div>
            <div class="image-meta">
              <div class="meta-row">
                <span class="meta-label">{{ i18n.metaDimensions }}</span>
                <span v-if="image.width && image.height">{{ image.width }} × {{ image.height }}</span>
                <span v-else>-</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">{{ i18n.metaFileSize }}</span>
                <span class="meta-value">{{ formatFileSize(image.size) }}</span>
              </div>
            </div>
            <div
              class="image-path"
              :title="image.path"
            >
              {{ image.path }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="!scanning"
        class="empty-state"
      >
        <svg class="empty-icon"><use xlink:href="#iconImage"></use></svg>
        <p>{{ i18n.scanImages }}</p>
        <SiButton @click="onScanImages">
          {{ i18n.startScan }}
        </SiButton>
      </div>

      <div
        v-if="compressResults.length > 0"
        class="compress-results"
      >
        <div class="results-header">
          <h3>{{ i18n.statistics }}</h3>
          <SiButton
            variant="ghost"
            size="xsmall"
            @click="compressResults = []"
          >
            {{ i18n.clearResults }}
          </SiButton>
        </div>
        <div class="results-stats">
          <div class="stat-item">
            <span class="stat-label">{{ i18n.totalImages }}:</span>
            <span class="stat-value">{{ stats.total }}</span>
          </div>
          <div class="stat-item success">
            <span class="stat-label">{{ i18n.successCount }}:</span>
            <span class="stat-value">{{ stats.success }}</span>
          </div>
          <div class="stat-item failed">
            <span class="stat-label">{{ i18n.failedCount }}:</span>
            <span class="stat-value">{{ stats.failed }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ i18n.compressionRatio }}:</span>
            <span class="stat-value">{{ stats.averageRatio }}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ i18n.totalSaved }}:</span>
            <span class="stat-value">{{ stats.totalSavedMB }} MB</span>
          </div>
        </div>
        <SiButton
          :loading="replacing"
          block
          :disabled="replacing"
          @click="onReplaceImages"
        >
          {{ replacing ? i18n.replacing : i18n.replace }}
        </SiButton>
      </div>
    </div>

    <div
      v-if="previewImageData"
      class="image-preview-dialog"
      @click="closePreview"
    >
      <div
        class="preview-content"
        @click.stop
      >
        <div class="preview-header">
          <div class="preview-title">
            <h3>{{ previewImageData.name }}</h3>
            <div class="preview-meta">
              <span>{{ i18n.metaDimensions }} {{ previewImageData.width }} × {{ previewImageData.height }}</span>
              <span>{{ i18n.metaFileSize }} {{ formatFileSize(previewImageData.size) }}</span>
            </div>
          </div>
          <button
            class="icon-btn"
            :title="i18n.closePreviewTitle"
            @click="closePreview"
          >
            <svg class="icon"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
        <div class="preview-image-wrapper">
          <img
            :src="previewImageData.url"
            :alt="previewImageData.name"
          />
        </div>
      </div>
    </div>

    <CompressDialog
      v-if="showCompressDialog"
      :i18n="i18n"
      :selectedCount="selectedImages.size"
      @confirm="onCompressConfirm"
      @cancel="showCompressDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  CompressOptions,
  ImageCompressorI18n,
  ImageInfo,
} from "./types"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
} from "vue"
import * as api from "@/api"
import SiButton from "@/components/Button.vue"
import SiSelect from "@/components/Select.vue"
import { copyToClipboard } from "@/utils/domUtils"
import CompressDialog from "./components/CompressDialog.vue"
import { useImageCompress } from "./composables/useImageCompress"
import { useImagePagination } from "./composables/useImagePagination"
import { useImageScanner } from "./composables/useImageScanner"
import { useImageSelection } from "./composables/useImageSelection"
import { formatFileSize } from "./services/comparator"
import {
  batchReplaceImages,
} from "./services/compressor"
import { revokeImageUrls } from "./services/scanner"

interface Props {
  visible: boolean
  i18n: ImageCompressorI18n
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: "close"): void
}>()

const visible = computed({
  get: () => props.visible,
  set: () => emit("close"),
})

// ── Composables ──────────────────────────────────────────────

const {
  images,
  scanning,
  scanProgress,
  scanProgressText,
  scanMinFileSize,
  onScanImages: doScan,
} = useImageScanner()

const {
  currentPage,
  pageSize,
  minFileSize,
  imageListRef,
  filteredImages,
  totalPages,
  paginatedImages,
} = useImagePagination(images)

const {
  selectedImages,
  toggleSelect,
  onSelectAll,
  onDeselectAll,
  clearSelection,
  removeFromSelection,
} = useImageSelection(paginatedImages)

const {
  compressing,
  compressResults,
  showCompressDialog,
  stats,
  onCompress,
  onCompressConfirm,
} = useImageCompress(
  filteredImages,
  selectedImages,
  (text) => { scanProgressText.value = text },
)

const replacing = ref(false)
const previewImageData = ref<ImageInfo | null>(null)

// ── 下拉选项 ──────────────────────────────────────────────────

const minFileSizeOptions = computed(() => [
  {
    value: 0,
    label: props.i18n.allOption,
  },
  {
    value: 100,
    label: "100 KB",
  },
  {
    value: 200,
    label: "200 KB",
  },
  {
    value: 500,
    label: "500 KB",
  },
  {
    value: 1024,
    label: "1 MB",
  },
  {
    value: 2048,
    label: "2 MB",
  },
  {
    value: 5120,
    label: "5 MB",
  },
])

const pageSizeOptions = computed(() => {
  const tpl = props.i18n.perPageOption
  return [20, 30, 50, 100].map((n) => ({
    value: n,
    label: tpl.replace("{num}", String(n)),
  }))
})

// ── 扫描（组合 composable + 选中清空） ────────────────────────

const onScanImages = () => {
  clearSelection()
  doScan()
}

// ── 替换（保留在 index.vue，因需跨 composable 编排） ──────────

const showDelayedMessage = (
  message: string,
  duration: number,
  type: "info" | "error" = "info",
) => {
  setTimeout(() => showMessage(message, duration, type), 100)
}

const onReplaceImages = async () => {
  const confirmMsg = props.i18n.replaceConfirmMessage
  if (!confirm(confirmMsg)) return

  replacing.value = true

  try {
    const {
      success,
      failed,
    } = await batchReplaceImages(
      compressResults.value,
      (current, total) => {
        scanProgressText.value = `替换中... ${current}/${total}`
      },
    )

    showDelayedMessage(
      `替换完成! 成功 ${success} 张, 失败 ${failed} 张。如需查看最新状态，请手动点击"扫描图片"`,
      5000,
      success > 0 ? "info" : "error",
    )

    const successfulResults = compressResults.value.filter((r) => r.success)
    compressResults.value = []

    if (success > 0 && successfulResults.length > 0) {
      const replacedPaths = new Set(
        successfulResults.map((r) => r.originalFile.path),
      )
      // 释放被替换图片的 blob URL
      const removedImages = images.value.filter((img) => replacedPaths.has(img.path))
      revokeImageUrls(removedImages)
      images.value = images.value.filter((img) => !replacedPaths.has(img.path))
      removeFromSelection(replacedPaths)
    }
  } catch (error) {
    console.error("替换失败:", error)
    showDelayedMessage(`替换失败: ${error}`, 5000, "error")
  } finally {
    replacing.value = false
  }
}

// ── 图片操作 ──────────────────────────────────────────────────

const onImageError = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.style.display = "none"
  const parent = img.parentElement
  if (parent) {
    // 用 DOM API 替代 innerHTML，避免 XSS 风险
    const placeholder = document.createElement("div")
    placeholder.className = "image-placeholder"

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("class", "icon")
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use")
    use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#iconImage")
    svg.appendChild(use)

    const text = document.createElement("p")
    text.textContent = props.i18n.loadFailed

    placeholder.appendChild(svg)
    placeholder.appendChild(text)
    parent.appendChild(placeholder)
  }
}

const copyImageName = async (name: string) => {
  try {
    await copyToClipboard(name)
    showMessage("已复制图片名称", 2000, "info")
  } catch (error) {
    console.error("复制失败:", error)
    showMessage("复制失败", 2000, "error")
  }
}

// ── 文档导航 ──────────────────────────────────────────────────

const escapeSqlString = (str: string): string => {
  return str.replace(/\\/g, "\\\\").replace(/'/g, "''")
}

const extractDocIdFromImageName = (imageName: string): string | null => {
  const match = imageName.match(/-([a-z0-9]{7})\.[^.]+$/)
  return match ? match[1] : null
}

const openDoc = (docId: string) => {
  window.open(`siyuan://blocks/${docId}`)
}

const navigateToDoc = async (image: ImageInfo) => {
  try {
    const docId = extractDocIdFromImageName(image.name)
    if (docId && (await api.getBlockByID(docId))) {
      openDoc(docId)
      return
    }

    const escapedPath = escapeSqlString(image.path.replace("/data/", ""))
    const escapedName = escapeSqlString(image.name)
    const blocks = await api.sql(`
      SELECT DISTINCT root_id, content, hpath
      FROM blocks
      WHERE markdown LIKE '%${escapedPath}%'
      OR content LIKE '%${escapedName}%'
      ORDER BY updated DESC
      LIMIT 5
    `)

    if (blocks?.length) {
      showMessage(`该图片在 ${blocks.length} 个文档中被引用`, 3000, "info")
      openDoc(blocks[0].root_id)
    } else {
      showMessage("未找到引用该图片的文档", 3000, "info")
    }
  } catch (error) {
    console.error("导航到文档失败:", error)
    showMessage(`导航失败: ${error}`, 3000, "error")
  }
}

// ── 预览 ─────────────────────────────────────────────────────

const previewImage = (image: ImageInfo) => {
  previewImageData.value = image
}

const closePreview = () => {
  previewImageData.value = null
}

const onClose = () => {
  emit("close")
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
