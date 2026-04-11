<template>
  <div class="image-viewer-overlay" v-if="visible" @click="onClose">
    <div class="image-viewer" @click.stop>
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

      <div class="viewer-toolbar">
        <SiButton :loading="scanning" @click="onScanImages">
          {{ scanning ? i18n.scanning : i18n.scanImages }}
        </SiButton>

        <div class="filter-group">
          <SiSelect
            :options="minFileSizeOptions"
            :model-value="scanMinFileSize"
            label="扫描筛选"
            size="small"
            @update:model-value="(v) => scanMinFileSize = Number(v)"
          />
        </div>

        <div class="filter-group">
          <SiSelect
            :options="minFileSizeOptions"
            :model-value="minFileSize"
            label="显示筛选"
            size="small"
            @update:model-value="(v) => minFileSize = Number(v)"
          />
        </div>

        <div class="toolbar-spacer"></div>

        <template v-if="totalPages > 1">
          <div class="pagination-controls">
            <SiButton variant="ghost" size="small" @click="currentPage = 1" :disabled="currentPage === 1">首页</SiButton>
            <SiButton variant="ghost" size="small" @click="currentPage--" :disabled="currentPage === 1">上一页</SiButton>
            <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
            <SiButton variant="ghost" size="small" @click="currentPage++" :disabled="currentPage === totalPages">下一页</SiButton>
            <SiButton variant="ghost" size="small" @click="currentPage = totalPages" :disabled="currentPage === totalPages">末页</SiButton>
            <SiSelect
              :options="pageSizeOptions"
              :model-value="pageSize"
              size="small"
              @update:model-value="(v) => { pageSize = Number(v); currentPage = 1 }"
            />
          </div>
        </template>

        <SiButton variant="ghost" @click="onSelectAll" :disabled="filteredImages.length === 0">
          {{ i18n.selectAll }}
        </SiButton>
        <SiButton variant="ghost" @click="onDeselectAll" :disabled="selectedImages.size === 0">
          {{ i18n.deselectAll }}
        </SiButton>
        <SiButton :loading="compressing" @click="onCompress" :disabled="selectedImages.size === 0">
          {{ compressing ? i18n.compressing : i18n.compress }}
          <span v-if="selectedImages.size > 0">({{ selectedImages.size }})</span>
        </SiButton>
      </div>

      <div class="progress-bar" v-if="scanning">
        <div class="progress-fill" :style="{ width: scanProgress + '%' }"></div>
        <span class="progress-text">{{ scanProgressText }}</span>
      </div>

      <div class="image-list" ref="imageListRef" v-if="paginatedImages.length > 0">
        <div v-for="image in paginatedImages" :key="image.path" class="image-item" :class="{ selected: selectedImages.has(image.path) }">
          <div class="image-checkbox" @click.stop="toggleSelect(image.path)">
            <input type="checkbox" :checked="selectedImages.has(image.path)" @click.stop="toggleSelect(image.path)" />
          </div>
          <div class="image-preview" @click.stop="previewImage(image)">
            <img v-if="image.url" :src="image.url" :alt="image.name" @error="onImageError" loading="lazy" />
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
              <button class="action-btn" @click.stop="copyImageName(image.name)" title="复制图片名称">
                <svg class="icon"><use xlink:href="#iconCopy"></use></svg>
                复制
              </button>
              <button class="action-btn" @click.stop="navigateToDoc(image)" title="导航到关联文档">
                <svg class="icon"><use xlink:href="#iconLink"></use></svg>
                定位
              </button>
            </div>
            <div class="image-meta">
              <div class="meta-row">
                <span class="meta-label">尺寸:</span>
                <span v-if="image.width && image.height">{{ image.width }} × {{ image.height }}</span>
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

      <div class="empty-state" v-else-if="!scanning">
        <svg class="empty-icon"><use xlink:href="#iconImage"></use></svg>
        <p>{{ i18n.scanImages }}</p>
        <SiButton @click="onScanImages">
          开始扫描
        </SiButton>
      </div>

      <div class="compress-results" v-if="compressResults.length > 0">
        <div class="results-header">
          <h3>{{ i18n.statistics }}</h3>
          <SiButton variant="ghost" size="small" @click="compressResults = []">清除结果</SiButton>
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
        <SiButton :loading="replacing" block @click="onReplaceImages" :disabled="replacing">
          {{ replacing ? i18n.replacing : i18n.replace }}
        </SiButton>
      </div>
    </div>

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
import { ref, computed, watch, shallowRef, nextTick } from "vue";
import { showMessage } from "siyuan";
import type { ImageInfo, CompressOptions, CompressResult } from "./types";
import { scanAllAssets, batchGetImageDetails } from "./services/scanner";
import {
	batchCompressImages,
	batchReplaceImages,
	getCompressStats,
} from "./services/compressor";
import { formatFileSize } from "./services/comparator";
import CompressDialog from "./components/CompressDialog.vue";
import SiButton from "@/components/Button.vue";
import SiSelect from "@/components/Select.vue";
import * as api from "@/api";

interface Props {
	visible: boolean;
	i18n: any;
}

const props = defineProps<Props>();
const emit = defineEmits<{
	(e: "close"): void;
}>();

const visible = computed({
	get: () => props.visible,
	set: () => emit("close"),
});
const images = shallowRef<ImageInfo[]>([]);
const selectedImages = ref<Set<string>>(new Set());
const scanning = ref(false);
const compressing = ref(false);
const replacing = ref(false);
const scanProgress = ref(0);
const scanProgressText = ref("");
const compressResults = shallowRef<CompressResult[]>([]);
const showCompressDialog = ref(false);
const imageListRef = ref<HTMLElement | null>(null);
const previewImageData = ref<ImageInfo | null>(null);

const currentPage = ref(1);
const pageSize = ref(30);

const minFileSize = ref(0);
const scanMinFileSize = ref(0); // 扫描时的大小筛选

const minFileSizeOptions = computed(() => [
	{ value: 0, label: "全部" },
	{ value: 100, label: "100 KB" },
	{ value: 200, label: "200 KB" },
	{ value: 500, label: "500 KB" },
	{ value: 1024, label: "1 MB" },
	{ value: 2048, label: "2 MB" },
	{ value: 5120, label: "5 MB" },
]);

const pageSizeOptions = computed(() => [
	{ value: 20, label: "20/页" },
	{ value: 30, label: "30/页" },
	{ value: 50, label: "50/页" },
	{ value: 100, label: "100/页" },
]);

const filteredImages = computed(() => {
	if (minFileSize.value === 0) {
		return images.value;
	}
	const minBytes = minFileSize.value * 1024;
	return images.value.filter((img) => img.size >= minBytes);
});

const totalPages = computed(() =>
	Math.ceil(filteredImages.value.length / pageSize.value),
);
const paginatedImages = computed(() => {
	const start = (currentPage.value - 1) * pageSize.value;
	const end = start + pageSize.value;
	return filteredImages.value.slice(start, end);
});

const stats = computed(() => {
	if (compressResults.value.length === 0) {
		return {
			total: 0,
			success: 0,
			failed: 0,
			averageRatio: 0,
			totalSavedMB: "0.00",
		};
	}
	return getCompressStats(compressResults.value);
});

watch(currentPage, () => {
	nextTick(() => {
		imageListRef.value?.scrollTo({ top: 0, behavior: "smooth" });
	});
});

watch(minFileSize, () => {
	currentPage.value = 1;
});

const showDelayedMessage = (
	message: string,
	duration: number,
	type: "info" | "error" = "info",
) => {
	setTimeout(() => showMessage(message, duration, type), 100);
};

const onScanImages = async () => {
	scanning.value = true;
	scanProgress.value = 0;
	images.value = [];
	selectedImages.value.clear();

	try {
		const scannedImages = await scanAllAssets((progress) => {
			scanProgress.value = Math.floor((progress.current / progress.total) * 50);
			scanProgressText.value = `扫描中... ${progress.current}/${progress.total}`;
		});

		scanProgressText.value = "正在获取图片详情...";

		const detailedImages = await batchGetImageDetails(
			scannedImages,
			(current, total) => {
				scanProgress.value = 50 + Math.floor((current / total) * 50);
				scanProgressText.value = `获取详情... ${current}/${total}`;
			},
			scanMinFileSize.value,
		);

		images.value = detailedImages;
		currentPage.value = 1;

		const totalSize = detailedImages.reduce((sum, img) => sum + img.size, 0);
		const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

		let message = `扫描完成: 共 ${detailedImages.length} 张图片, 总大小 ${totalSizeMB} MB`;
		if (scanMinFileSize.value > 0) {
			message += ` (已筛选 ≥${scanMinFileSize.value}KB)`;
		}
		showMessage(message, 3000, "info");
	} catch (error) {
		console.error("扫描图片失败:", error);
		showMessage("扫描图片失败: " + error, 5000, "error");
	} finally {
		scanning.value = false;
		scanProgress.value = 0;
	}
};

const updateSelection = (operation: (set: Set<string>) => void) => {
	operation(selectedImages.value);
	selectedImages.value = new Set(selectedImages.value);
};

const toggleSelect = (path: string) => {
	updateSelection((set) => {
		if (set.has(path)) {
			set.delete(path);
		} else {
			set.add(path);
		}
	});
};

const onSelectAll = () => {
	updateSelection((set) => {
		paginatedImages.value.forEach((img) => set.add(img.path));
	});
};

const onDeselectAll = () => {
	updateSelection((set) => set.clear());
};

const onCompress = () => {
	showCompressDialog.value = true;
};

const onCompressConfirm = async (options: CompressOptions) => {
	showCompressDialog.value = false;
	compressing.value = true;
	compressResults.value = [];

	try {
		const selectedImageList = filteredImages.value.filter((img) =>
			selectedImages.value.has(img.path),
		);

		const results = await batchCompressImages(
			selectedImageList,
			options,
			(current, total, imageName) => {
				scanProgressText.value = `压缩中... ${current}/${total} - ${imageName}`;
			},
		);

		compressResults.value = results;

		const successCount = results.filter((r) => r.success).length;
		showDelayedMessage(
			`压缩完成! 成功 ${successCount}/${results.length} 张`,
			3000,
			"info",
		);
	} catch (error) {
		console.error("压缩失败:", error);
		showDelayedMessage("压缩失败: " + error, 5000, "error");
	} finally {
		compressing.value = false;
	}
};

const onReplaceImages = async () => {
	if (!confirm("确定要替换原图吗? 此操作不可撤销!")) {
		return;
	}

	replacing.value = true;

	try {
		const { success, failed } = await batchReplaceImages(
			compressResults.value,
			(current, total) => {
				scanProgressText.value = `替换中... ${current}/${total}`;
			},
		);

		showDelayedMessage(
			`替换完成! 成功 ${success} 张, 失败 ${failed} 张。如需查看最新状态，请手动点击"扫描图片"`,
			5000,
			success > 0 ? "info" : "error",
		);

		const successfulResults = compressResults.value.filter((r) => r.success);
		compressResults.value = [];

		if (success > 0 && successfulResults.length > 0) {
			const replacedPaths = new Set(
				successfulResults.map((r) => r.originalFile.path),
			);
			images.value = images.value.filter((img) => !replacedPaths.has(img.path));
			updateSelection((set) => {
				replacedPaths.forEach((path) => set.delete(path));
			});
		}
	} catch (error) {
		console.error("替换失败:", error);
		showDelayedMessage("替换失败: " + error, 5000, "error");
	} finally {
		replacing.value = false;
	}
};

const onImageError = (e: Event) => {
	const img = e.target as HTMLImageElement;
	img.style.display = "none";
	const parent = img.parentElement;
	if (parent) {
		parent.innerHTML =
			'<div class="image-placeholder"><svg class="icon"><use xlink:href="#iconImage"></use></svg><p>加载失败</p></div>';
	}
};

const copyImageName = async (name: string) => {
	try {
		await navigator.clipboard.writeText(name);
		showMessage("已复制图片名称", 2000, "info");
	} catch (error) {
		console.error("复制失败:", error);
		showMessage("复制失败", 2000, "error");
	}
};

const extractDocIdFromImageName = (imageName: string): string | null => {
	const match = imageName.match(/-([a-z0-9]{7})\.[^.]+$/);
	return match ? match[1] : null;
};

const openDoc = (docId: string) => {
	window.open(`siyuan://blocks/${docId}`);
};

const navigateToDoc = async (image: ImageInfo) => {
	try {
		const docId = extractDocIdFromImageName(image.name);
		if (docId && (await api.getBlockByID(docId))) {
			openDoc(docId);
			return;
		}

		const imagePath = image.path.replace("/data/", "");
		const blocks = await api.sql(`
      SELECT DISTINCT root_id, content, hpath
      FROM blocks
      WHERE markdown LIKE '%${imagePath}%'
      OR content LIKE '%${image.name}%'
      ORDER BY updated DESC
      LIMIT 5
    `);

		if (blocks?.length) {
			showMessage(`该图片在 ${blocks.length} 个文档中被引用`, 3000, "info");
			openDoc(blocks[0].root_id);
		} else {
			showMessage("未找到引用该图片的文档", 3000, "info");
		}
	} catch (error) {
		console.error("导航到文档失败:", error);
		showMessage("导航失败: " + error, 3000, "error");
	}
};

const previewImage = (image: ImageInfo) => {
	previewImageData.value = image;
};

const closePreview = () => {
	previewImageData.value = null;
};

const onClose = () => {
	emit("close");
};
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
