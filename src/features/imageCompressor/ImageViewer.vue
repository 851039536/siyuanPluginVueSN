<template>
  <div class="image-viewer-overlay" v-if="visible" @click="onClose">
    <div class="image-viewer" @click.stop>
      <!-- 头部工具栏 -->
      <div class="viewer-header">
        <div class="header-left">
          <h2>{{ i18n.title }}</h2>
          <span class="image-count" v-if="images.length > 0">
            <template v-if="minFileSize > 0">
              {{ filteredImages.length }} / {{ images.length }}
            </template>
            <template v-else>
              {{ images.length }}
            </template>
            {{ i18n.foundImages?.replace('{count}', '') || '张图片' }}
          </span>
        </div>
        <div class="header-right">
          <button class="icon-btn" @click="onClose" :title="i18n.cancel">
            <svg class="icon"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
      </div>

      <!-- 操作栏 -->
      <div class="viewer-toolbar">
        <button
          class="btn btn-primary"
          @click="onScanImages"
          :disabled="scanning"
        >
          <svg class="icon"><use xlink:href="#iconRefresh"></use></svg>
          {{ scanning ? i18n.scanning : i18n.scanImages }}
        </button>

        <!-- 文件大小过滤 -->
        <div class="filter-group">
          <label class="filter-label">只显示大于:</label>
          <select class="filter-select" v-model.number="minFileSize">
            <option :value="0">全部</option>
            <option :value="100">100 KB</option>
            <option :value="200">200 KB</option>
            <option :value="500">500 KB</option>
            <option :value="1024">1 MB</option>
            <option :value="2048">2 MB</option>
            <option :value="5120">5 MB</option>
          </select>
        </div>

        <div class="toolbar-spacer"></div>

        <!-- 分页控制 -->
        <div class="pagination-controls" v-if="totalPages > 1">
          <button class="btn btn-text btn-sm" @click="currentPage = 1" :disabled="currentPage === 1">
            首页
          </button>
          <button class="btn btn-text btn-sm" @click="currentPage--" :disabled="currentPage === 1">
            上一页
          </button>
          <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
          <button class="btn btn-text btn-sm" @click="currentPage++" :disabled="currentPage === totalPages">
            下一页
          </button>
          <button class="btn btn-text btn-sm" @click="currentPage = totalPages" :disabled="currentPage === totalPages">
            末页
          </button>
          <select class="page-size-select" v-model.number="pageSize" @change="currentPage = 1">
            <option :value="20">20/页</option>
            <option :value="30">30/页</option>
            <option :value="50">50/页</option>
            <option :value="100">100/页</option>
          </select>
        </div>

        <button
          class="btn btn-text"
          @click="onSelectAll"
          :disabled="filteredImages.length === 0"
        >
          {{ i18n.selectAll }}
        </button>
        <button
          class="btn btn-text"
          @click="onDeselectAll"
          :disabled="selectedImages.size === 0"
        >
          {{ i18n.deselectAll }}
        </button>
        <button
          class="btn btn-primary"
          @click="onCompress"
          :disabled="selectedImages.size === 0 || compressing"
        >
          <svg class="icon"><use xlink:href="#iconImage"></use></svg>
          {{ compressing ? i18n.compressing : i18n.compress }}
          <span v-if="selectedImages.size > 0">({{ selectedImages.size }})</span>
        </button>
      </div>

      <!-- 扫描进度 -->
      <div class="progress-bar" v-if="scanning">
        <div class="progress-fill" :style="{ width: scanProgress + '%' }"></div>
        <span class="progress-text">{{ scanProgressText }}</span>
      </div>



      <!-- 图片列表 -->
      <div class="image-list" ref="imageListRef" v-if="paginatedImages.length > 0">
        <div
          v-for="image in paginatedImages"
          :key="image.path"
          class="image-item"
          :class="{ selected: selectedImages.has(image.path) }"
        >
          <div class="image-checkbox" @click.stop="toggleSelect(image.path)">
            <input
              type="checkbox"
              :checked="selectedImages.has(image.path)"
              @click.stop="toggleSelect(image.path)"
            />
          </div>
          <div class="image-preview" @click.stop="previewImage(image)">
            <img
              v-if="image.url"
              :src="image.url"
              :alt="image.name"
              @load="onImageLoad"
              @error="onImageError($event, image)"
              loading="lazy"
            />
            <div v-else class="image-placeholder">
              <svg class="icon"><use xlink:href="#iconImage"></use></svg>
              <p>加载中...</p>
            </div>
            <div class="preview-hint">
              <svg class="icon"><use xlink:href="#iconEye"></use></svg>
              点击预览
            </div>
          </div>
          <div class="image-info" @click.stop="toggleSelect(image.path)">
            <div class="image-name" :title="image.name">{{ image.name }}</div>
            <div class="image-actions">
              <button
                class="action-btn"
                @click.stop="copyImageName(image.name)"
                title="复制图片名称"
              >
                <svg class="icon"><use xlink:href="#iconCopy"></use></svg>
                复制
              </button>
              <button
                class="action-btn"
                @click.stop="navigateToDoc(image)"
                title="导航到关联文档"
              >
                <svg class="icon"><use xlink:href="#iconLink"></use></svg>
                定位
              </button>
            </div>
            <div class="image-meta">
              <div class="meta-row">
                <span class="meta-label">尺寸:</span>
                <span v-if="image.width && image.height">
                  {{ image.width }} × {{ image.height }}
                </span>
                <span v-else>-</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">大小:</span>
                <span class="meta-value">{{ formatFileSize(image.size) }}</span>
              </div>
            </div>
            <div class="image-path" :title="image.path">{{ image.path }}</div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div class="empty-state" v-else-if="!scanning">
        <svg class="empty-icon"><use xlink:href="#iconImage"></use></svg>
        <p>{{ i18n.scanImages }}</p>
        <button class="btn btn-primary" @click="onScanImages">
          开始扫描
        </button>
      </div>

      <!-- 压缩结果 -->
      <div class="compress-results" v-if="compressResults.length > 0">
        <div class="results-header">
          <h3>{{ i18n.statistics }}</h3>
          <button class="btn btn-sm" @click="compressResults = []">
            清除结果
          </button>
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
        <button
          class="btn btn-primary btn-block"
          @click="onReplaceImages"
          :disabled="replacing"
        >
          {{ replacing ? i18n.replacing : i18n.replace }}
        </button>
      </div>
    </div>

    <!-- 图片预览对话框 -->
    <div class="image-preview-dialog" v-if="previewImageData" @click="closePreview">
      <div class="preview-content" @click.stop>
        <div class="preview-header">
          <div class="preview-title">
            <h3>{{ previewImageData.name }}</h3>
            <div class="preview-meta">
              <span>尺寸: {{ previewImageData.width }} × {{ previewImageData.height }}</span>
              <span>大小: {{ formatFileSize(previewImageData.size) }}</span>
            </div>
          </div>
          <button class="icon-btn" @click="closePreview" title="关闭">
            <svg class="icon"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
        <div class="preview-image-wrapper">
          <img :src="previewImageData.url" :alt="previewImageData.name" />
        </div>
      </div>
    </div>

    <!-- 压缩配置对话框 -->
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
import { ref, computed, watch } from 'vue'
import { showMessage } from 'siyuan'
import type { ImageInfo, CompressOptions, CompressResult } from './types'
import { scanAllAssets, batchGetImageDetails } from './scanner'
import { batchCompressImages, batchReplaceImages, getCompressStats } from './compressor'
import { formatFileSize } from './comparator'
import CompressDialog from './CompressDialog.vue'
import * as api from '@/api'

interface Props {
  visible: boolean
  i18n: any
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 状态
const images = ref<ImageInfo[]>([])
const selectedImages = ref<Set<string>>(new Set())
const scanning = ref(false)
const compressing = ref(false)
const replacing = ref(false)
const scanProgress = ref(0)
const scanProgressText = ref('')
const compressResults = ref<CompressResult[]>([])
const showCompressDialog = ref(false)
const imageListRef = ref<HTMLElement | null>(null)
const previewImageData = ref<ImageInfo | null>(null)

// 分页状态
const currentPage = ref(1)
const pageSize = ref(30) // 默认每页30张

// 过滤状态
const minFileSize = ref(0) // 最小文件大小(KB), 0表示不过滤

// 过滤后的图片列表
const filteredImages = computed(() => {
  if (minFileSize.value === 0) {
    return images.value
  }
  const minBytes = minFileSize.value * 1024
  return images.value.filter(img => img.size >= minBytes)
})

// 分页计算 - 基于过滤后的列表
const totalPages = computed(() => Math.ceil(filteredImages.value.length / pageSize.value))
const paginatedImages = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredImages.value.slice(start, end)
})

// 监听页码变化,滚动到顶部
watch(currentPage, () => {
  if (imageListRef.value) {
    imageListRef.value.scrollTop = 0
  }
})

// 监听过滤条件变化,重置到第一页
watch(minFileSize, () => {
  currentPage.value = 1
})

// 统计信息
const stats = computed(() => {
  if (compressResults.value.length === 0) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      averageRatio: 0,
      totalSavedMB: '0.00'
    }
  }
  return getCompressStats(compressResults.value)
})

// 扫描图片
const onScanImages = async () => {
  scanning.value = true
  scanProgress.value = 0
  images.value = []
  selectedImages.value.clear()

  try {
    const scannedImages = await scanAllAssets((progress) => {
      scanProgress.value = Math.floor((progress.current / progress.total) * 50)
      scanProgressText.value = `扫描中... ${progress.current}/${progress.total}`
    })

    scanProgressText.value = '正在获取图片详情...'

    const detailedImages = await batchGetImageDetails(
      scannedImages,
      (current, total) => {
        scanProgress.value = 50 + Math.floor((current / total) * 50)
        scanProgressText.value = `获取详情... ${current}/${total}`
      }
    )

    images.value = detailedImages
    currentPage.value = 1 // 重置到第一页

    // 显示统计信息
    const totalSize = detailedImages.reduce((sum, img) => sum + img.size, 0)
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)
    showMessage(
      `扫描完成: 共 ${detailedImages.length} 张图片, 总大小 ${totalSizeMB} MB`,
      3000,
      'info'
    )
  } catch (error) {
    console.error('扫描图片失败:', error)
    showMessage('扫描图片失败: ' + error, 5000, 'error')
  } finally {
    scanning.value = false
    scanProgress.value = 0
  }
}

// 切换选择
const toggleSelect = (path: string) => {
  if (selectedImages.value.has(path)) {
    selectedImages.value.delete(path)
  } else {
    selectedImages.value.add(path)
  }
  // 触发响应式更新
  selectedImages.value = new Set(selectedImages.value)
}

// 全选当前页
const onSelectAll = () => {
  paginatedImages.value.forEach(img => selectedImages.value.add(img.path))
  selectedImages.value = new Set(selectedImages.value)
}

// 全选所有页
const onSelectAllPages = () => {
  filteredImages.value.forEach(img => selectedImages.value.add(img.path))
  selectedImages.value = new Set(selectedImages.value)
}

// 取消全选
const onDeselectAll = () => {
  selectedImages.value.clear()
  selectedImages.value = new Set(selectedImages.value)
}

// 开始压缩
const onCompress = () => {
  showCompressDialog.value = true
}

// 确认压缩
const onCompressConfirm = async (options: CompressOptions) => {
  showCompressDialog.value = false
  compressing.value = true
  compressResults.value = []

  try {
    const selectedImageList = filteredImages.value.filter(img =>
      selectedImages.value.has(img.path)
    )

    const results = await batchCompressImages(
      selectedImageList,
      options,
      (current, total, imageName) => {
        scanProgressText.value = `压缩中... ${current}/${total} - ${imageName}`
      }
    )

    compressResults.value = results

    // 延迟显示消息,避免对话框关闭竞态
    setTimeout(() => {
      const successCount = results.filter(r => r.success).length
      showMessage(
        `压缩完成! 成功 ${successCount}/${results.length} 张`,
        3000,
        'info'
      )
    }, 100)
  } catch (error) {
    console.error('压缩失败:', error)
    setTimeout(() => {
      showMessage('压缩失败: ' + error, 5000, 'error')
    }, 100)
  } finally {
    compressing.value = false
  }
}

// 替换原图
const onReplaceImages = async () => {
  if (!confirm('确定要替换原图吗? 此操作不可撤销!')) {
    return
  }

  replacing.value = true

  try {
    const { success, failed } = await batchReplaceImages(
      compressResults.value,
      (current, total) => {
        scanProgressText.value = `替换中... ${current}/${total}`
      }
    )

    setTimeout(() => {
      showMessage(
        `替换完成! 成功 ${success} 张, 失败 ${failed} 张。如需查看最新状态，请手动点击"扫描图片"`,
        5000,
        success > 0 ? 'info' : 'error'
      )
    }, 100)

    // 清空压缩结果，但不自动刷新
    const successfulResults = compressResults.value.filter(r => r.success)
    compressResults.value = []

    // 从当前列表中移除已替换的图片（避免混淆）
    if (success > 0 && successfulResults.length > 0) {
      const replacedPaths = new Set(
        successfulResults.map(r => r.originalFile.path)
      )
      images.value = images.value.filter(img => !replacedPaths.has(img.path))
      // 清空这些图片的选中状态
      replacedPaths.forEach(path => selectedImages.value.delete(path))
      selectedImages.value = new Set(selectedImages.value)
    }
  } catch (error) {
    console.error('替换失败:', error)
    setTimeout(() => {
      showMessage('替换失败: ' + error, 5000, 'error')
    }, 100)
  } finally {
    replacing.value = false
  }
}

// 图片加载成功
const onImageLoad = (e: Event) => {
  // 图片加载成功，无需额外处理
}

// 图片加载错误
const onImageError = (e: Event, image: ImageInfo) => {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
  const parent = img.parentElement
  if (parent) {
    parent.innerHTML = '<div class="image-placeholder"><svg class="icon"><use xlink:href="#iconImage"></use></svg><p>加载失败</p></div>'
  }
}

// 复制图片名称
const copyImageName = async (name: string) => {
  try {
    await navigator.clipboard.writeText(name)
    showMessage('已复制图片名称', 2000, 'info')
  } catch (error) {
    console.error('复制失败:', error)
    showMessage('复制失败', 2000, 'error')
  }
}

// 从图片名称中提取文档ID
function extractDocIdFromImageName(imageName: string): string | null {
  // 思源笔记图片命名格式: {hash}-{timestamp}-{docId}.{ext}
  // 例如: 01c8d88a60112d6fcb8beb900d4ecf89-20250913160629-4j7x9v8.jpg
  const match = imageName.match(/-([a-z0-9]{7})\.[^.]+$/)
  return match ? match[1] : null
}

// 导航到关联文档
const navigateToDoc = async (image: ImageInfo) => {
  try {
    // 方法1: 从文件名提取文档ID
    const docIdFromName = extractDocIdFromImageName(image.name)
    if (docIdFromName) {
      // 验证文档是否存在
      const doc = await api.getBlockByID(docIdFromName)
      if (doc) {
        window.open(`siyuan://blocks/${docIdFromName}`)
        return
      }
    }

    // 方法2: 通过SQL查询引用了该图片的文档
    const imagePath = image.path.replace('/data/', '')
    const blocks = await api.sql(`
      SELECT DISTINCT root_id, content, hpath
      FROM blocks
      WHERE markdown LIKE '%${imagePath}%'
      OR content LIKE '%${image.name}%'
      ORDER BY updated DESC
      LIMIT 5
    `)

    if (blocks && blocks.length > 0) {
      if (blocks.length === 1) {
        // 只有一个文档,直接打开
        window.open(`siyuan://blocks/${blocks[0].root_id}`)
        showMessage(`已打开文档`, 2000, 'info')
      } else {
        // 多个文档,显示列表供用户选择
        const docList = blocks.map((b, i) => `${i + 1}. ${b.hpath || b.content}`).join('\n')
        showMessage(`该图片在 ${blocks.length} 个文档中被引用`, 3000, 'info')
        // 默认打开第一个(最新更新的)
        window.open(`siyuan://blocks/${blocks[0].root_id}`)
      }
    } else {
      showMessage('未找到引用该图片的文档', 3000, 'info')
    }
  } catch (error) {
    console.error('导航到文档失败:', error)
    showMessage('导航失败: ' + error, 3000, 'error')
  }
}

// 预览图片
const previewImage = (image: ImageInfo) => {
  previewImageData.value = image
}

// 关闭预览
const closePreview = () => {
  previewImageData.value = null
}

// 关闭
const onClose = () => {
  emit('close')
}
</script>

<style scoped lang="scss">
.image-viewer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  pointer-events: auto;
}

.image-viewer {
  width: 90%;
  max-width: 1200px;
  height: 85vh;
  background: var(--b3-theme-background);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--b3-theme-on-background);
    }

    .image-count {
      padding: 4px 12px;
      background: var(--b3-theme-primary);
      color: #fff;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
    }
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    color: var(--b3-theme-on-background);
    opacity: 0.6;
    border-radius: 4px;

    &:hover {
      opacity: 1;
      background: var(--b3-theme-surface-lighter);
    }

    .icon {
      width: 20px;
      height: 20px;
    }
  }
}

.viewer-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-background);
  flex-wrap: wrap;

  .toolbar-spacer {
    flex: 1;
  }
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  border: 1px solid var(--b3-border-color);

  .filter-label {
    font-size: 13px;
    color: var(--b3-theme-on-background);
    font-weight: 500;
    white-space: nowrap;
  }

  .filter-select {
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 12px;
    cursor: pointer;
    min-width: 90px;

    &:hover {
      border-color: var(--b3-theme-primary);
    }

    &:focus {
      outline: none;
      border-color: var(--b3-theme-primary);
      box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
    }
  }
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--b3-theme-surface);
  border-radius: 6px;

  .page-info {
    font-size: 13px;
    color: var(--b3-theme-on-background);
    padding: 0 8px;
    font-weight: 500;
  }

  .page-size-select {
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 12px;
    cursor: pointer;

    &:hover {
      border-color: var(--b3-theme-primary);
    }
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  .icon {
    width: 16px;
    height: 16px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
}

.btn-primary {
  background: var(--b3-theme-primary);
  color: #fff;
}

.btn-text {
  background: transparent;
  color: var(--b3-theme-on-background);

  &:hover {
    background: var(--b3-theme-surface);
  }
}

.btn-sm {
  padding: 4px 12px;
  font-size: 13px;
}

.btn-block {
  width: 100%;
  justify-content: center;
}

.progress-bar {
  position: relative;
  height: 4px;
  background: var(--b3-theme-surface);

  .progress-fill {
    height: 100%;
    background: var(--b3-theme-primary);
    transition: width 0.3s;
  }

  .progress-text {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    color: var(--b3-theme-on-background);
  }
}

.image-list {
  flex: 1;
  min-height: 300px;
  overflow-y: auto;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  align-content: start;
}

.image-item {
  position: relative;
  background: var(--b3-theme-surface);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  min-height: 320px;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &.selected {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb), 0.1);
  }
}

.image-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
}

.image-preview {
  position: relative;
  width: 100%;
  height: 200px;
  background: var(--b3-theme-background);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;

  &:hover {
    .preview-hint {
      opacity: 1;
    }
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    gap: 8px;

    .icon {
      width: 48px;
      height: 48px;
      opacity: 0.3;
    }

    p {
      margin: 0;
      font-size: 12px;
      color: var(--b3-theme-on-surface-light);
      opacity: 0.6;
    }
  }

  .preview-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    border-radius: 20px;
    font-size: 13px;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;

    .icon {
      width: 16px;
      height: 16px;
    }
  }
}

.image-info {
  padding: 12px;
}

.image-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--b3-theme-on-background);

  .icon {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: var(--b3-theme-primary);
    color: #fff;
    border-color: var(--b3-theme-primary);
  }
}

.image-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  margin-bottom: 4px;

  .meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .meta-label {
    color: var(--b3-theme-on-surface-light);
    opacity: 0.7;
    min-width: 36px;
    font-weight: 500;
  }

  .meta-value {
    color: var(--b3-theme-primary);
    font-weight: 600;
  }
}

.image-path {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;

  .empty-icon {
    width: 80px;
    height: 80px;
    opacity: 0.3;
  }

  p {
    font-size: 16px;
    color: var(--b3-theme-on-surface-light);
  }
}

.compress-results {
  padding: 20px 24px;
  border-top: 2px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }
}

.results-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--b3-theme-background);
  border-radius: 6px;

  &.success {
    background: rgba(76, 175, 80, 0.1);

    .stat-value {
      color: #4caf50;
    }
  }

  &.failed {
    background: rgba(244, 67, 54, 0.1);

    .stat-value {
      color: #f44336;
    }
  }

  .stat-label {
    font-size: 13px;
    color: var(--b3-theme-on-surface-light);
  }

  .stat-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-primary);
  }
}

// 图片预览对话框
.image-preview-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}

.preview-content {
  max-width: 90vw;
  max-height: 90vh;
  background: var(--b3-theme-background);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);

  .preview-title {
    flex: 1;

    h3 {
      margin: 0 0 4px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--b3-theme-on-background);
    }

    .preview-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--b3-theme-on-surface-light);
      opacity: 0.8;
    }
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    color: var(--b3-theme-on-background);
    opacity: 0.6;
    border-radius: 4px;

    &:hover {
      opacity: 1;
      background: var(--b3-theme-surface-lighter);
    }

    .icon {
      width: 20px;
      height: 20px;
    }
  }
}

.preview-image-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  max-height: calc(90vh - 80px);
  overflow: auto;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
  }
}
</style>
