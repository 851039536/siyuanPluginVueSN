<template>
  <div class="data-backup-settings">
    <div class="settings-container">
      <!-- 工作区信息 -->
      <div class="info-section">
        <!-- 移动端提示 -->
        <div v-if="isMobile" class="mobile-warning">
          <span class="warning-icon">📱</span>
          <span class="warning-text">{{ i18n.mobileBackupDisabled || '检测到移动端环境，备份功能已自动禁用以节省流量和存储空间' }}</span>
        </div>
        <div class="section-header">
          <span class="section-icon">💾</span>
          <h4>{{ i18n.workspaceInfo || '工作区信息' }}</h4>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ i18n.workspacePath || '工作区路径' }}</span>
            <div class="workspace-path-row">
              <span class="info-value workspace-path">{{ workspacePath || i18n.notSet || '未设置' }}</span>
              <div class="path-actions">
                <button @click="selectWorkspacePath" class="select-path-btn">
                  {{ i18n.selectPath || '选择路径' }}
                </button>
                <button
                  @click="openWorkspaceFolder"
                  class="open-folder-btn"
                  :disabled="!workspaceRoot"
                  :title="i18n.openInExplorer || '在文件管理器中打开'"
                >
                  📂
                </button>
              </div>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">{{ i18n.lastBackup || '上次备份' }}</span>
            <span class="info-value">{{ lastBackupTime || i18n.never || '从未' }}</span>
          </div>
        </div>
      </div>

      <!-- 手动备份 -->
      <div class="backup-section">
        <div class="section-header">
          <span class="section-icon">📦</span>
          <h4>{{ i18n.manualBackup || '手动备份' }}</h4>
        </div>
        <button
          @click="performBackup"
          class="backup-btn primary"
          :disabled="isBackingUp"
        >
          <span v-if="isBackingUp" class="loading-spinner"></span>
          <span v-else>📀</span>
          <span>{{ i18n.backupNow || '立即备份' }}</span>
        </button>
      </div>

      <!-- 自动备份设置 -->
      <div class="auto-backup-section">
        <div class="section-header">
          <span class="section-icon">⏰</span>
          <h4>{{ i18n.autoBackupSettings || '自动备份设置' }}</h4>
        </div>
        <div class="settings-form">
          <div class="form-row">
            <label class="form-label">{{ i18n.autoBackup || '自动备份' }}</label>
            <select v-model="autoBackupEnabled" class="form-select" @change="saveSettings">
              <option :value="false">{{ i18n.disabled || '禁用' }}</option>
              <option :value="true">{{ i18n.enabled || '启用' }}</option>
            </select>
          </div>

          <template v-if="autoBackupEnabled">
            <div class="form-row">
              <label class="form-label">{{ i18n.backupFrequency || '备份频率' }}</label>
              <select v-model="backupFrequency" class="form-select" @change="saveSettings">
                <option value="minute">{{ i18n.everyMinute || '每分钟' }}</option>
                <option value="hourly">{{ i18n.everyHour || '每小时' }}</option>
                <option value="daily">{{ i18n.everyDay || '每天' }}</option>
              </select>
            </div>

            <div v-if="backupFrequency === 'daily'" class="form-row">
              <label class="form-label">{{ i18n.backupTime || '备份时间' }}</label>
              <input
                type="time"
                v-model="backupTime"
                class="form-input"
                @change="saveSettings"
              />
            </div>

            <div class="form-row">
              <label class="form-label">{{ i18n.keepBackups || '保留备份数' }}</label>
              <input
                type="number"
                v-model="keepBackupCount"
                class="form-input small"
                min="1"
                max="30"
                @change="saveSettings"
              />
            </div>
          </template>
        </div>
      </div>

      <!-- 备份历史 -->
      <div class="history-section">
        <div class="section-header">
          <span class="section-icon">📋</span>
          <h4>{{ i18n.backupHistory || '备份历史' }}</h4>
          <button @click="refreshBackupList" class="refresh-btn" :disabled="isLoading">
            {{ i18n.refresh || '刷新' }}
          </button>
        </div>
        <div class="backup-list" v-if="backupList.length > 0">
          <div
            v-for="(backup, index) in backupList"
            :key="index"
            class="backup-item"
          >
            <div class="backup-info">
              <span class="backup-name">{{ backup.name }}</span>
              <span class="backup-time">{{ backup.time }}</span>
              <span class="backup-size">{{ backup.size }}</span>
            </div>
            <div class="backup-actions">
              <button @click="deleteBackup(backup)" class="action-btn delete">
                {{ i18n.delete || '删除' }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon">📭</span>
          <p>{{ i18n.noBackups || '暂无备份记录' }}</p>
        </div>
      </div>
    </div>

    <!-- 自定义输入对话框 -->
    <div v-if="showInputDialog" class="input-dialog-overlay" @click.self="cancelInputDialog">
      <div class="input-dialog">
        <div class="input-dialog-header">
          <h4>{{ i18n.enterWorkspacePath || '请输入思源工作区路径' }}</h4>
        </div>
        <div class="input-dialog-body">
          <input
            v-model="inputDialogValue"
            type="text"
            class="input-dialog-field"
            :placeholder="inputDialogPlaceholder"
            @keyup.enter="confirmInputDialog"
            @keyup.esc="cancelInputDialog"
            ref="dialogInputRef"
          />
        </div>
        <div class="input-dialog-footer">
          <button @click="cancelInputDialog" class="input-dialog-btn cancel">
            {{ i18n.cancel || '取消' }}
          </button>
          <button @click="confirmInputDialog" class="input-dialog-btn confirm">
            {{ i18n.confirm || '确定' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { showMessage } from "siyuan";
import { checkIsMobile } from "../types";
import JSZip from "jszip";

interface Props {
	i18n?: any;
	plugin?: any;
}

const props = withDefaults(defineProps<Props>(), {
	i18n: () => ({}),
	plugin: null,
});

// 响应式数据
const workspacePath = ref("");
const workspaceRoot = ref("");
const isBackingUp = ref(false);
const isLoading = ref(false);
const lastBackupTime = ref("");
const autoBackupEnabled = ref(false);
const isMobile = ref(false);
const backupFrequency = ref("daily");
const backupTime = ref("03:00");
const keepBackupCount = ref(7);
const backupList = ref<
	Array<{ name: string; path: string; time: string; size: string }>
>([]);

let lastBackupTimestamp = 0;

// 获取备份目录路径
function getBackupDir(): string {
	return `${workspaceRoot.value}/data-backup`;
}

// 统一更新工作区路径并持久化
function updateWorkspacePath(root: string, shouldSave = false) {
	workspaceRoot.value = root;
	workspacePath.value = `${root}/data`;
	localStorage.setItem("siyuan-workspace-root", root);
	localStorage.setItem("siyuan-workspace-path", `${root}/data`);
	if (shouldSave) {
		saveSettings();
	}
}

// 通过 API 获取工作区路径（提取为独立方法避免重复）
async function fetchWorkspacePath(): Promise<string | null> {
	try {
		const response = await fetch("/api/system/getConf", { method: "POST" });
		if (response.ok) {
			const data = await response.json();
			return data?.data?.conf?.system?.workspaceDir || null;
		}
	} catch (e) {
		console.error("通过 API 获取工作区路径失败:", e);
	}
	return null;
}

// 初始化 - 仅加载设置和 UI 数据（自动备份定时器由 GeneralSettings.init() 在插件启动时初始化）
onMounted(async () => {
	isMobile.value = checkIsMobile();
	await loadSettings();

	if (isMobile.value && autoBackupEnabled.value) {
		autoBackupEnabled.value = false;
		await saveSettings();
	}

	await detectWorkspacePath();
	await loadBackupList();

	window.addEventListener("autoBackupTrigger", handleAutoBackupTrigger);
});

onUnmounted(() => {
	window.removeEventListener("autoBackupTrigger", handleAutoBackupTrigger);
});

async function handleAutoBackupTrigger() {
	await performBackup();
}

// 统一处理定时器重启逻辑（委托给 GeneralSettings）
function handleTimerRestart(enabled: boolean) {
	const generalSettings = props.plugin?.__generalSettings;
	if (generalSettings && typeof generalSettings.restartAutoBackupTimer === "function") {
		generalSettings.restartAutoBackupTimer(enabled, backupFrequency.value);
	}
}

// 监听备份频率变化
watch(backupFrequency, () => handleTimerRestart(autoBackupEnabled.value));

// 监听自动备份启用状态
watch(autoBackupEnabled, (enabled) => handleTimerRestart(enabled));

// 加载设置
async function loadSettings() {
	try {
		if (props.plugin) {
			const data = await props.plugin.loadData("data-backup-settings");
			if (data) {
				autoBackupEnabled.value = data.autoBackupEnabled ?? false;
				backupFrequency.value = data.backupFrequency ?? "daily";
				backupTime.value = data.backupTime ?? "03:00";
				keepBackupCount.value = data.keepBackupCount ?? 7;
				lastBackupTime.value = data.lastBackupTime ?? "";
				lastBackupTimestamp = data.lastBackupTimestamp ?? 0;
				if (data.workspacePath) {
					workspacePath.value = data.workspacePath;
					workspaceRoot.value =
						data.workspaceRoot || data.workspacePath.replace(/\/data$/, "");
				}
				if (data.workspaceRoot) {
					workspaceRoot.value = data.workspaceRoot;
				}
			}
		}
	} catch (error) {
		console.error("加载备份设置失败:", error);
	}
}

// 保存设置
async function saveSettings() {
	try {
		if (props.plugin) {
			await props.plugin.saveData("data-backup-settings", {
				autoBackupEnabled: autoBackupEnabled.value,
				backupFrequency: backupFrequency.value,
				backupTime: backupTime.value,
				keepBackupCount: keepBackupCount.value,
				lastBackupTime: lastBackupTime.value,
				lastBackupTimestamp,
				workspacePath: workspacePath.value,
				workspaceRoot: workspaceRoot.value,
			});
		}
	} catch (error) {
		console.error("保存备份设置失败:", error);
	}
}

// 检测工作区路径
async function detectWorkspacePath() {
	// 方式1: 检查环境变量
	const envRoot =
		(window as any).__SIYUAN_WORKSPACE__ || (window as any).SIYUAN_WORKSPACE;
	if (envRoot) {
		updateWorkspacePath(envRoot);
		return;
	}

	// 方式2: 从 localStorage 获取
	const savedPath = localStorage.getItem("siyuan-workspace-path");
	const savedRoot = localStorage.getItem("siyuan-workspace-root");
	if (savedPath) {
		workspacePath.value = savedPath;
		workspaceRoot.value = savedRoot || savedPath.replace(/\/data$/, "");
		return;
	}

	// 方式3: 从插件配置获取
	try {
		if (props.plugin?.dataPath) {
			updateWorkspacePath(props.plugin.dataPath);
			return;
		}
	} catch {
		/* 忽略错误 */
	}

	// 方式4: 通过 API 获取
	const apiPath = await fetchWorkspacePath();
	if (apiPath) {
		updateWorkspacePath(apiPath);
		return;
	}

	// 方式5: 监听事件
	window.addEventListener("workspacePathDetected", handleWorkspacePathDetected);
}

function handleWorkspacePathDetected(event: CustomEvent) {
	updateWorkspacePath(event.detail.path);
}

// 输入对话框相关
const showInputDialog = ref(false);
const inputDialogValue = ref("");
const inputDialogPlaceholder = ref("");
const inputDialogResolve = ref<((value: string | null) => void) | null>(null);
const dialogInputRef = ref<HTMLInputElement | null>(null);

function showInputDialogHelper(placeholder: string): Promise<string | null> {
	return new Promise((resolve) => {
		inputDialogPlaceholder.value = placeholder;
		inputDialogValue.value = workspaceRoot.value || "";
		inputDialogResolve.value = resolve;
		showInputDialog.value = true;
		nextTick(() => {
			dialogInputRef.value?.focus();
			dialogInputRef.value?.select();
		});
	});
}

function confirmInputDialog() {
	const value = inputDialogValue.value.trim();
	showInputDialog.value = false;
	inputDialogResolve.value?.(value || null);
	inputDialogResolve.value = null;
}

function cancelInputDialog() {
	showInputDialog.value = false;
	inputDialogResolve.value?.(null);
	inputDialogResolve.value = null;
}

// 打开工作区文件夹
async function openWorkspaceFolder() {
	if (!workspaceRoot.value) {
		showMessage(
			props.i18n.pleaseSelectWorkspace || "请先选择工作区路径",
			3000,
			"info",
		);
		return;
	}

	try {
		// 桌面版：使用 Electron shell 打开文件夹
		if (typeof window.require === "function") {
			const electron = window.require("electron");
			const shell = electron.shell || electron.remote?.shell;
			if (shell?.openPath) {
				await shell.openPath(workspaceRoot.value);
				return;
			}
		}

		// Web 版：尝试使用思源 API
		const response = await fetch("/api/file/getFile", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: workspaceRoot.value }),
		});

		if (response.ok) {
			showMessage(props.i18n.folderOpened || "已在浏览器中打开", 2000, "info");
		} else {
			showMessage(
				props.i18n.openFolderFailed || "打开文件夹失败，请手动访问路径",
				3000,
				"error",
			);
		}
	} catch (error) {
		console.error("打开工作区文件夹失败:", error);
		showMessage(
			props.i18n.openFolderFailed || "打开文件夹失败，请手动访问路径",
			3000,
			"error",
		);
	}
}

// 选择工作区路径
async function selectWorkspacePath() {
	if (!workspaceRoot.value) {
		const wsPath = await fetchWorkspacePath();
		if (wsPath) {
			updateWorkspacePath(wsPath, true);
			showMessage(
				props.i18n.workspacePathSet || "工作区路径已自动获取",
				2000,
				"info",
			);
			return;
		}
	}

	// 使用 Electron dialog
	if (typeof window.require === "function") {
		try {
			const electron = window.require("electron");
			const remote = electron.remote || electron;
			if (remote?.dialog?.showOpenDialog) {
				const result = await remote.dialog.showOpenDialog({
					properties: ["openDirectory"],
					title: props.i18n.selectWorkspace || "选择思源工作区",
					defaultPath: workspaceRoot.value || undefined,
				});
				if (!result.canceled && result.filePaths[0]) {
					updateWorkspacePath(result.filePaths[0], true);
					showMessage(
						props.i18n.workspacePathSet || "工作区路径已设置",
						2000,
						"info",
					);
					return;
				}
			}
		} catch (error) {
			console.warn("Electron dialog 不可用:", error);
		}
	}

	// 手动输入
	const inputPath = await showInputDialogHelper(
		props.i18n.enterWorkspacePath || "请输入思源工作区路径:",
	);
	if (inputPath) {
		updateWorkspacePath(inputPath, true);
		showMessage(
			props.i18n.workspacePathSet || "工作区路径已设置",
			2000,
			"info",
		);
	}
}

// 手动备份
async function performBackup() {
	if (isBackingUp.value) return;

	if (!workspacePath.value) {
		showMessage(
			props.i18n.pleaseSelectWorkspace || "请先选择工作区路径",
			3000,
			"info",
		);
		await selectWorkspacePath();
		if (!workspacePath.value) return;
	}

	isBackingUp.value = true;

	try {
		const now = new Date();
		const year = now.getFullYear().toString().slice(-2);
		const month = (now.getMonth() + 1).toString().padStart(2, "0");
		const day = now.getDate().toString().padStart(2, "0");
		const hour = now.getHours().toString().padStart(2, "0");
		const minute = now.getMinutes().toString().padStart(2, "0");
		const second = now.getSeconds().toString().padStart(2, "0");
		const fileName = `data-${year}${month}${day}-${hour}${minute}${second}.zip`;
		const backupDir = getBackupDir();

		if (typeof window.require !== "function") {
			throw new Error("无法访问文件系统，请使用桌面版思源笔记");
		}

		const fs = window.require("fs").promises;
		const path = window.require("path");

		try {
			await fs.access(workspacePath.value);
		} catch {
			throw new Error(`data 目录不存在: ${workspacePath.value}`);
		}

		const zip = new JSZip();
		const skipDirs = new Set(["temp", ".recycle"]);

		async function addDirectoryToZip(dirPath: string, zipPath: string) {
			const entries = await fs.readdir(dirPath, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);
				const relativePath = zipPath ? `${zipPath}/${entry.name}` : entry.name;
				if (entry.isDirectory()) {
					if (skipDirs.has(entry.name)) continue;
					await addDirectoryToZip(fullPath, relativePath);
				} else if (entry.isFile()) {
					try {
						zip.file(relativePath, await fs.readFile(fullPath));
					} catch (err) {
						console.warn(`无法读取文件: ${fullPath}`, err);
					}
				}
			}
		}

		await addDirectoryToZip(workspacePath.value, "");

		zip.file(
			"backup-info.json",
			JSON.stringify(
				{
					timestamp: Date.now(),
					backupTime: new Date().toISOString(),
					version: "1.0",
					workspaceRoot: workspaceRoot.value,
					workspaceDataPath: workspacePath.value,
					backupDir,
				},
				null,
				2,
			),
		);

		//开始压缩
		const zipBuffer = await zip.generateAsync({
			type: "uint8array",
			compression: "DEFLATE",
			compressionOptions: { level: 6 },
		});

		await fs.mkdir(backupDir, { recursive: true });
		const zipFilePath = path.join(backupDir, fileName);
		await fs.writeFile(zipFilePath, zipBuffer);

		lastBackupTime.value = new Date().toLocaleString();
		lastBackupTimestamp = Date.now();
		await saveSettings();

		props.plugin?.__generalSettings?.updateLastBackupTime?.(
			lastBackupTimestamp,
		);

		const stats = await fs.stat(zipFilePath);
		backupList.value.unshift({
			name: fileName,
			path: zipFilePath,
			time: lastBackupTime.value,
			size: formatFileSize(stats.size),
		});

		if (backupList.value.length > keepBackupCount.value) {
			backupList.value = backupList.value.slice(0, keepBackupCount.value);
		}

		await props.plugin.saveData("backup-history", { list: backupList.value });
		showMessage(
			props.i18n.backupSuccess || `备份成功: ${fileName}`,
			3000,
			"info",
		);
	} catch (error) {
		console.error("备份过程出错:", error);
		showMessage(
			`${props.i18n.backupFailed || "备份失败"}: ${error.message}`,
			5000,
			"error",
		);
	} finally {
		isBackingUp.value = false;
	}
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
}

// 加载备份列表
async function loadBackupList() {
	backupList.value = [];

	try {
		// 检查是否有保存的备份记录
		const backupHistory = await props.plugin.loadData("backup-history");
		if (backupHistory && backupHistory.list) {
			backupList.value = backupHistory.list;
		}
	} catch (error) {
		console.error("加载备份列表失败:", error);
	}
}

// 刷新备份列表
async function refreshBackupList() {
	isLoading.value = true;
	await loadBackupList();
	isLoading.value = false;
}

// 删除备份
async function deleteBackup(backup: { name: string; path: string }) {
	try {
		const confirmDelete = confirm(
			props.i18n.confirmDelete || "确定要删除此备份吗？",
		);
		if (!confirmDelete) return;

		// 从列表中移除
		backupList.value = backupList.value.filter((b) => b.name !== backup.name);

		// 保存更新后的列表
		await props.plugin.saveData("backup-history", { list: backupList.value });

		showMessage(props.i18n.deleteSuccess || "删除成功", 2000, "info");
	} catch (error) {
		console.error("删除备份失败:", error);
		showMessage(props.i18n.deleteFailed || "删除失败", 3000, "error");
	}
}

// 暴露方法给父组件
defineExpose({
	loadSettings,
	saveSettings,
	performBackup,
	refreshBackupList,
});
</script>

<style scoped lang="scss">
@use './styles/DataBackupSettings.scss';
</style>
