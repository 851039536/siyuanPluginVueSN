<template>
  <div class="markdown-export-settings">
    <div class="settings-section">
      <h4 class="section-title">Markdown 导出</h4>
      <p class="section-desc">一键导出所有笔记本为 Markdown 格式</p>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <div class="button-group">
          <Button variant="primary" @click="exportSelected" :disabled="exporting" :loading="exporting">
            {{ exporting ? '导出中...' : '导出选中的笔记本' }}
          </Button>
          <Button variant="primary" @click="exportAllNotebooks" :disabled="exporting" :loading="exporting">
            {{ exporting ? '导出中...' : '📁 一键导出所有笔记本' }}
          </Button>
          <Button variant="success" @click="exportAll" :disabled="exporting" :loading="exporting">
            {{ exporting ? '导出中...' : '📦 一键导出工作空间' }}
          </Button>
        </div>
        <div class="button-group">
          <Button variant="secondary" @click="selectAll">全选</Button>
          <Button variant="secondary" @click="deselectAll">取消全选</Button>
        </div>
      </div>

      <!-- 提示信息 -->
      <div class="export-tips">
        <div class="tip-item">
          <span class="tip-icon">💡</span>
          <span class="tip-text">"导出选中的笔记本": 导出勾选的笔记本,每个生成一个 ZIP</span>
        </div>
        <div class="tip-item">
          <span class="tip-icon">💡</span>
          <span class="tip-text">"一键导出所有笔记本": 自动导出所有笔记本并打包成一个 ZIP 文件</span>
        </div>
        <div class="tip-item">
          <span class="tip-icon">💡</span>
          <span class="tip-text">"一键导出工作空间": 将整个工作空间打包成一个 ZIP 文件</span>
        </div>
      </div>

      <!-- 笔记本列表 -->
      <div class="notebook-list">
        <div v-if="loading" class="loading">加载中...</div>
        
        <div v-else-if="notebooks.length === 0" class="empty">
          没有找到笔记本
        </div>

        <div v-else class="notebook-items">
          <div
            v-for="notebook in notebooks"
            :key="notebook.id"
            class="notebook-item"
            :class="{ selected: selectedNotebooks.has(notebook.id) }"
            @click="toggleNotebook(notebook.id)"
          >
            <input
              type="checkbox"
              :checked="selectedNotebooks.has(notebook.id)"
              @click.stop
              @change="toggleNotebook(notebook.id)"
            />
            <span class="notebook-icon">📓</span>
            <span class="notebook-name">{{ notebook.name }}</span>
            <span class="notebook-count">{{ notebook.docCount || 0 }} 个文档</span>
          </div>
        </div>
      </div>

      <!-- 导出进度 -->
      <div v-if="exportProgress.show" class="export-progress">
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
      <div v-if="exportLogs.length > 0" class="export-logs">
        <h4>导出日志</h4>
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
import { ref, computed, onMounted } from "vue";
import { lsNotebooks, pushMsg, pushErrMsg } from "@/api";
import Button from "@/components/Button.vue";
// @ts-ignore
import JSZip from "jszip";

interface Notebook {
	id: string;
	name: string;
	docCount?: number;
}

interface ExportLog {
	type: "success" | "error" | "info";
	message: string;
}

interface Props {
	i18n?: any;
	plugin?: any;
}

const props = withDefaults(defineProps<Props>(), {
	i18n: () => ({}),
	plugin: null,
});

const emit = defineEmits(["change"]);

const loading = ref(true);
const exporting = ref(false);
const notebooks = ref<Notebook[]>([]);
const selectedNotebooks = ref<Set<string>>(new Set());
const exportLogs = ref<ExportLog[]>([]);
const exportProgress = ref({
	show: false,
	current: 0,
	total: 0,
	percent: 0,
});

// 计算属性：优化查找性能
const selectedNotebookIds = computed(() => Array.from(selectedNotebooks.value));

// 加载笔记本列表
onMounted(async () => {
	await loadNotebooks();
});

async function loadNotebooks() {
	try {
		loading.value = true;
		const data = await lsNotebooks();

		if (data && data.notebooks) {
			notebooks.value = data.notebooks.map((nb: any) => ({
				id: nb.id,
				name: nb.name,
				docCount: nb.docCount,
			}));
		}
	} catch (error) {
		console.error("加载笔记本列表失败:", error);
		addLog("error", "加载笔记本列表失败");
	} finally {
		loading.value = false;
	}
}

function toggleNotebook(notebookId: string) {
	const next = new Set(selectedNotebooks.value);
	if (next.has(notebookId)) {
		next.delete(notebookId);
	} else {
		next.add(notebookId);
	}
	selectedNotebooks.value = next;
}

function selectAll() {
	selectedNotebooks.value = new Set(notebooks.value.map((nb) => nb.id));
}

function deselectAll() {
	selectedNotebooks.value.clear();
}

// 公共函数：下载 ZIP 文件
async function downloadZipBlob(zipPath: string): Promise<Blob> {
	const response = await fetch(zipPath);
	if (!response.ok) {
		throw new Error(`下载失败: ${response.status}`);
	}
	return response.blob();
}

// 公共函数：触发浏览器下载
function triggerDownload(blob: Blob, filename: string) {
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();

	setTimeout(() => {
		window.URL.revokeObjectURL(url);
		document.body.removeChild(a);
	}, 100);
}

// 公共函数：导出 API 请求
async function exportApiRequest(url: string, body: Record<string, unknown>) {
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

	const result = await response.json();
	if (result.code !== 0) throw new Error(result.msg || "导出失败");

	const zipPath = result.data?.zip;
	if (!zipPath) throw new Error("未获取到ZIP文件路径");

	return zipPath;
}

// 公共函数：更新进度
function updateProgress(current: number, total: number) {
	exportProgress.value.current = current;
	exportProgress.value.total = total;
	exportProgress.value.percent = Math.round((current / total) * 100);
}

async function exportAllNotebooks() {
	exporting.value = true;
	addLog("info", "开始批量导出所有笔记本并打包...");

	exportProgress.value = {
		show: true,
		current: 0,
		total: notebooks.value.length,
		percent: 0,
	};

	const zip = new JSZip();
	const errors: string[] = [];

	for (const [index, notebook] of notebooks.value.entries()) {
		try {
			addLog("info", `正在导出: ${notebook.name}`);

			const zipPath = await exportApiRequest("/api/export/exportNotebookMd", { notebook: notebook.id });

			// 下载并解压笔记本的 ZIP 文件
			const zipBlob = await downloadZipBlob(zipPath);
			const notebookZip = await JSZip.loadAsync(zipBlob);

			// 将笔记本的内容直接添加到大 ZIP 中（保持文件夹结构）
			const notebookFolder = zip.folder(notebook.name);
			if (notebookFolder) {
				for (const [relativePath, file] of Object.entries(notebookZip.files)) {
					if (!file.dir) {
						const content = await file.async("blob");
						notebookFolder.file(relativePath, content);
					} else {
						notebookFolder.folder(relativePath);
					}
				}
			}

			addLog("success", `✅ 已添加: ${notebook.name}`);
		} catch (error) {
			addLog("error", `❌ 导出失败: ${notebook.name}`);
			errors.push(notebook.name);
			console.error(`导出笔记本 ${notebook.name} 失败:`, error);
		}

		updateProgress(index + 1, notebooks.value.length);
	}

	// 生成最终的ZIP文件
	try {
		addLog("info", "正在打包所有笔记本...");

		const finalZipBlob = await zip.generateAsync(
			{
				type: "blob",
				compression: "DEFLATE",
				compressionOptions: { level: 6 },
			},
			(metadata) => {
				const percent = Math.round(metadata.percent);
				if (percent % 10 === 0) addLog("info", `打包进度: ${percent}%`);
			},
		);

		const timestamp = new Date().toISOString().slice(0, 10);
		triggerDownload(finalZipBlob, `all-notebooks-${timestamp}.zip`);

		addLog("success", `✅ 已打包所有笔记本到一个 ZIP 文件`);
		await pushMsg(
			`成功导出并打包 ${notebooks.value.length - errors.length} 个笔记本`,
		);
	} catch (error) {
		addLog("error", "❌ 打包失败");
		await pushErrMsg("打包失败");
		console.error("打包失败:", error);
	}

	exporting.value = false;
	exportProgress.value.show = false;

	if (errors.length > 0) {
		await pushErrMsg(`${errors.length} 个笔记本导出失败: ${errors.join(", ")}`);
	}
}

async function exportAll() {
	exporting.value = true;
	addLog("info", "开始导出整个工作空间...");

	try {
		const zipPath = await exportApiRequest("/api/export/exportData", {});

		addLog("info", `正在下载: ${zipPath}`);
		const blob = await downloadZipBlob(zipPath);

		const timestamp = new Date().toISOString().slice(0, 10);
		triggerDownload(blob, `siyuan-workspace-${timestamp}.zip`);

		addLog("success", `✅ 已导出整个工作空间`);
		await pushMsg(`成功导出整个工作空间`);
	} catch (error) {
		addLog("error", `❌ 导出工作空间失败`);
		await pushErrMsg("导出工作空间失败");
		console.error("导出工作空间失败:", error);
	} finally {
		exporting.value = false;
	}
}

async function exportSelected() {
	const selectedList = selectedNotebookIds.value;
	if (selectedList.length === 0) {
		await pushErrMsg("请至少选择一个笔记本");
		return;
	}

	exporting.value = true;
	exportProgress.value = {
		show: true,
		current: 0,
		total: selectedList.length,
		percent: 0,
	};

	const notebookMap = new Map(notebooks.value.map((nb) => [nb.id, nb]));
	const errors: string[] = [];

	for (const [index, notebookId] of selectedList.entries()) {
		const notebook = notebookMap.get(notebookId);

		if (notebook) {
			try {
				await exportNotebookMd(notebookId, notebook.name);
				addLog("success", `✅ 已导出: ${notebook.name}`);
			} catch (error) {
				addLog("error", `❌ 导出失败: ${notebook.name}`);
				errors.push(notebook.name);
				console.error(`导出笔记本 ${notebook.name} 失败:`, error);
			}
		}

		updateProgress(index + 1, selectedList.length);
	}

	exporting.value = false;
	exportProgress.value.show = false;

	if (errors.length === 0) {
		await pushMsg(`成功导出 ${selectedList.length} 个笔记本`);
	} else {
		await pushErrMsg(`${errors.length} 个笔记本导出失败: ${errors.join(", ")}`);
	}
}

async function exportNotebookMd(notebookId: string, notebookName: string) {
	try {
		addLog("info", `开始导出: ${notebookName}`);

		const zipPath = await exportApiRequest("/api/export/exportNotebookMd", { notebook: notebookId });

		addLog("info", `正在下载: ${zipPath}`);
		const blob = await downloadZipBlob(zipPath);

		triggerDownload(blob, `${notebookName}.zip`);
	} catch (error) {
		console.error("导出失败详情:", error);
		throw error;
	}
}

function addLog(type: ExportLog["type"], message: string) {
	exportLogs.value.push({ type, message });
	// 限制日志数量
	if (exportLogs.value.length > 50) {
		exportLogs.value.shift();
	}
}
</script>

<style scoped lang="scss">
.markdown-export-settings {
  padding: 12px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0 0 4px;
}

.section-desc {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  margin: 0 0 12px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.button-group {
  display: flex;
  gap: 8px;
}

.export-tips {
  margin-bottom: 12px;
  padding: 10px;
  background: var(--b3-theme-surface);
  border-radius: 4px;
  border-left: 3px solid var(--b3-theme-primary);
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);

  &:last-child {
    margin-bottom: 0;
  }
}

.tip-icon {
  flex-shrink: 0;
  font-size: 13px;
}

.tip-text {
  flex: 1;
  line-height: 1.4;
}

.notebook-list {
  margin-bottom: 12px;
}

.loading,
.empty {
  text-align: center;
  padding: 24px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  font-size: 13px;
}

.notebook-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notebook-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface-light);
  }

  &.selected {
    background: var(--b3-theme-primary-lightest);
    border-color: var(--b3-theme-primary);
  }

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .notebook-icon {
    font-size: 18px;
  }

  .notebook-name {
    flex: 1;
    font-size: 13px;
    color: var(--b3-theme-on-background);
  }

  .notebook-count {
    font-size: 11px;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
  }
}

.export-progress {
  margin-bottom: 12px;

  .progress-bar {
    height: 6px;
    background: var(--b3-theme-surface-light);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .progress-fill {
    height: 100%;
    background: var(--b3-theme-primary);
    transition: width 0.3s;
  }

  .progress-text {
    text-align: center;
    font-size: 11px;
    color: var(--b3-theme-on-surface);
  }
}

.export-logs {
  margin-top: 12px;

  h4 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .log-items {
    max-height: 150px;
    overflow-y: auto;
    background: var(--b3-theme-surface);
    border-radius: 4px;
    padding: 8px;
  }

  .log-item {
    font-size: 11px;
    padding: 3px 0;
    font-family: monospace;

    &.success {
      color: #4caf50;
    }

    &.error {
      color: #f44336;
    }

    &.info {
      color: var(--b3-theme-on-surface);
    }
  }
}
</style>
