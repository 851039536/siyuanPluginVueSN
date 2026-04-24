<template>
  <div class="data-backup-settings">
    <div class="settings-container">
      <!-- 工作区信息 -->
      <div class="info-section">
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

      <!-- 备份进度 -->
      <div v-if="isBackingUp || isRestoring" class="progress-section">
        <div class="section-header">
          <span class="section-icon">{{ isRestoring ? '🔄' : '📊' }}</span>
          <h4>{{ isRestoring ? '恢复进度' : '备份进度' }}</h4>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: `${backupProgress.percent}%` }"></div>
        </div>
        <div class="progress-info">
          <span class="progress-phase">{{ phaseLabel }}</span>
          <span class="progress-percent">{{ backupProgress.percent }}%</span>
        </div>
        <div v-if="backupProgress.currentFile" class="progress-current-file">
          {{ backupProgress.currentFile }}
        </div>
      </div>

      <!-- 手动备份 -->
      <div class="backup-section">
        <div class="section-header">
          <span class="section-icon">📦</span>
          <h4>{{ i18n.manualBackup || '手动备份' }}</h4>
        </div>
        <div class="backup-actions-row">
          <button @click="performFullBackup" class="backup-btn primary" :disabled="isBackingUp || isRestoring">
            <span v-if="isBackingUp && !backupProgress.isIncremental" class="loading-spinner"></span>
            <span v-else>📀</span>
            <span>全量备份</span>
          </button>
          <button @click="performIncrementalBackup" class="backup-btn secondary" :disabled="isBackingUp || isRestoring">
            <span v-if="isBackingUp && backupProgress.isIncremental" class="loading-spinner"></span>
            <span v-else>⚡</span>
            <span>增量备份</span>
          </button>
        </div>
        <p class="backup-hint">全量备份包含所有文件；增量备份仅包含自上次备份后变更的文件（变更超过80%自动转为全量）</p>
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
              <label class="form-label">备份模式</label>
              <select v-model="backupMode" class="form-select" @change="saveSettings">
                <option value="full">全量备份</option>
                <option value="incremental">增量备份</option>
              </select>
            </div>

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
              <input type="time" v-model="backupTime" class="form-input" @change="saveSettings" />
            </div>

            <div class="form-row">
              <label class="form-label">{{ i18n.keepBackups || '保留备份数' }}</label>
              <input type="number" v-model="keepBackupCount" class="form-input small" min="1" max="30" @change="saveSettings" />
            </div>

            <div class="form-row">
              <label class="form-label">云同步</label>
              <select v-model="cloudSyncEnabled" class="form-select" @change="saveSettings">
                <option :value="false">禁用</option>
                <option :value="true">启用</option>
              </select>
            </div>
          </template>
        </div>
      </div>

      <!-- 云备份设置 -->
      <div v-if="cloudSyncEnabled" class="cloud-backup-section">
        <div class="section-header">
          <span class="section-icon">☁️</span>
          <h4>云备份设置</h4>
        </div>
        <div class="settings-form">
          <div class="form-row">
            <label class="form-label">云服务商</label>
            <select v-model="cloudConfig.type" class="form-select" @change="saveCloudConfig">
              <option value="qiniu">七牛云</option>
              <option value="alibaba">阿里云 OSS</option>
              <option value="tencent">腾讯云 COS</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">AccessKey</label>
            <input type="password" v-model="cloudConfig.accessKey" class="form-input" @change="saveCloudConfig" />
          </div>
          <div class="form-row">
            <label class="form-label">SecretKey</label>
            <input type="password" v-model="cloudConfig.secretKey" class="form-input" @change="saveCloudConfig" />
          </div>
          <div class="form-row">
            <label class="form-label">Bucket</label>
            <input type="text" v-model="cloudConfig.bucket" class="form-input" @change="saveCloudConfig" />
          </div>
          <div class="form-row">
            <label class="form-label">Region</label>
            <input type="text" v-model="cloudConfig.region" class="form-input" placeholder="如 oss-cn-hangzhou / ap-guangzhou" @change="saveCloudConfig" />
          </div>
          <div class="form-row">
            <label class="form-label">存储路径</label>
            <input type="text" v-model="cloudConfig.prefix" class="form-input" placeholder="siyuan-backup/" @change="saveCloudConfig" />
          </div>
          <div class="cloud-actions">
            <button @click="testCloudConnection" class="backup-btn secondary" :disabled="isTestingCloud">
              {{ isTestingCloud ? '测试中...' : '测试连接' }}
            </button>
          </div>
          <div v-if="cloudTestResult" class="cloud-test-result" :class="{ success: cloudTestResult.success, error: !cloudTestResult.success }">
            {{ cloudTestResult.message }}
          </div>

          <!-- 云端备份列表 -->
          <div v-if="cloudBackupList.length > 0" class="cloud-backup-list">
            <div class="section-header" style="margin-top: 0.5rem;">
              <h4>云端备份</h4>
              <button @click="loadCloudBackups" class="refresh-btn">刷新</button>
            </div>
            <div v-for="file in cloudBackupList" :key="file.key" class="backup-item">
              <div class="backup-info">
                <span class="backup-name">{{ file.name }}</span>
                <span class="backup-time">{{ file.lastModified }}</span>
                <span class="backup-size">{{ formatFileSize(file.size) }}</span>
              </div>
              <div class="backup-actions">
                <button @click="downloadFromCloud(file)" class="action-btn restore" :disabled="isRestoring">下载</button>
                <button @click="deleteFromCloud(file)" class="action-btn delete">删除</button>
              </div>
            </div>
          </div>
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
          <div v-for="(backup, index) in backupList" :key="index" class="backup-item">
            <div class="backup-info">
              <span class="backup-name">
                {{ backup.name }}
                <span v-if="backup.isIncremental" class="badge incremental">增量</span>
              </span>
              <span class="backup-time">{{ backup.time }}</span>
              <span class="backup-size">{{ backup.size }}</span>
            </div>
            <div class="backup-actions">
              <button @click="verifyBackup(backup)" class="action-btn verify" :disabled="isVerifying">校验</button>
              <button @click="restoreBackup(backup)" class="action-btn restore" :disabled="isRestoring">恢复</button>
              <button @click="uploadToCloud(backup)" class="action-btn cloud" :disabled="!cloudSyncEnabled">☁️</button>
              <button @click="deleteBackup(backup)" class="action-btn delete">{{ i18n.delete || '删除' }}</button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon">📭</span>
          <p>{{ i18n.noBackups || '暂无备份记录' }}</p>
        </div>
      </div>
    </div>

    <!-- 校验结果对话框 -->
    <div v-if="verifyResult" class="input-dialog-overlay" @click.self="verifyResult = null">
      <div class="input-dialog">
        <div class="input-dialog-header">
          <h4>备份校验结果</h4>
        </div>
        <div class="input-dialog-body verify-result-body">
          <div class="verify-status" :class="{ valid: verifyResult.valid, invalid: !verifyResult.valid }">
            <span class="verify-icon">{{ verifyResult.valid ? '✅' : '❌' }}</span>
            <span>{{ verifyResult.valid ? '校验通过' : '校验失败' }}</span>
          </div>
          <div class="verify-details">
            <div class="verify-row"><span>文件数:</span><span>{{ verifyResult.fileCount }}</span></div>
            <div class="verify-row"><span>文件大小:</span><span>{{ formatFileSize(verifyResult.totalSize) }}</span></div>
            <div class="verify-row"><span>实际校验和:</span><span class="checksum">{{ verifyResult.checksum.slice(0, 16) }}...</span></div>
            <div class="verify-row"><span>预期校验和:</span><span class="checksum">{{ verifyResult.expectedChecksum.slice(0, 16) }}...</span></div>
            <div v-if="verifyResult.error" class="verify-row error"><span>错误:</span><span>{{ verifyResult.error }}</span></div>
          </div>
        </div>
        <div class="input-dialog-footer">
          <button @click="verifyResult = null" class="input-dialog-btn confirm">关闭</button>
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
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from "vue";
import { showMessage } from "siyuan";
import { checkIsMobile } from "../types";
import { BackupManager } from "../modules/BackupManager";
import type { BackupProgress, VerifyResult as VerifyResultType } from "../modules/BackupManager";
import { CloudBackupManager } from "../modules/CloudBackupManager";
import type { CloudProviderConfig, CloudFileInfo } from "../modules/CloudBackupManager";

interface Props {
	i18n?: any;
	plugin?: any;
}

const props = withDefaults(defineProps<Props>(), {
	i18n: () => ({}),
	plugin: null,
});

// 基础状态
const workspacePath = ref("");
const workspaceRoot = ref("");
const isBackingUp = ref(false);
const isRestoring = ref(false);
const isVerifying = ref(false);
const isLoading = ref(false);
const isTestingCloud = ref(false);
const lastBackupTime = ref("");
const autoBackupEnabled = ref(false);
const isMobile = ref(false);
const backupFrequency = ref("daily");
const backupTime = ref("03:00");
const backupMode = ref<"full" | "incremental">("full");
const keepBackupCount = ref(7);
const cloudSyncEnabled = ref(false);
const backupList = ref<
	Array<{ name: string; path: string; time: string; size: string; isIncremental?: boolean }>
>([]);

let lastBackupTimestamp = 0;

// 备份进度
const backupProgress = ref<BackupProgress & { isIncremental?: boolean }>({
	phase: "scanning",
	currentFile: "",
	filesProcessed: 0,
	totalFiles: 0,
	percent: 0,
});

const phaseLabel = computed(() => {
	const labels: Record<string, string> = {
		scanning: "扫描文件",
		packing: "打包文件",
		compressing: "压缩数据",
		saving: "保存备份",
		verifying: "校验完整性",
		uploading: "上传云端",
	};
	return labels[backupProgress.value.phase] || backupProgress.value.phase;
});

// 校验结果
const verifyResult = ref<VerifyResultType | null>(null);

// 云备份
const cloudConfig = ref<CloudProviderConfig>({
	type: "qiniu",
	accessKey: "",
	secretKey: "",
	bucket: "",
	region: "",
	prefix: "siyuan-backup/",
});
const cloudTestResult = ref<{ success: boolean; message: string } | null>(null);
const cloudBackupList = ref<CloudFileInfo[]>([]);

// Manager 实例
let backupManager: BackupManager | null = null;
let cloudBackupManager: CloudBackupManager | null = null;

// 初始化 Manager
function initManagers() {
	backupManager = new BackupManager(props.plugin, workspacePath.value, workspaceRoot.value);
	backupManager.setLastBackupTimestamp(lastBackupTimestamp);
	cloudBackupManager = new CloudBackupManager(props.plugin);
}

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
	if (backupManager) {
		backupManager.updateWorkspacePaths(workspacePath.value, workspaceRoot.value);
	}
	if (shouldSave) {
		saveSettings();
	}
}

// 通过 API 获取工作区路径
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

// 初始化
onMounted(async () => {
	isMobile.value = checkIsMobile();
	await loadSettings();

	if (isMobile.value && autoBackupEnabled.value) {
		autoBackupEnabled.value = false;
		await saveSettings();
	}

	await detectWorkspacePath();
	initManagers();
	await loadBackupList();
	await loadCloudConfig();

	window.addEventListener("autoBackupTrigger", handleAutoBackupTrigger);
});

onUnmounted(() => {
	window.removeEventListener("autoBackupTrigger", handleAutoBackupTrigger);
});

async function handleAutoBackupTrigger() {
	if (backupMode.value === "incremental") {
		await performIncrementalBackup();
	} else {
		await performFullBackup();
	}
}

// 定时器重启逻辑（委托给 GeneralSettings）
function handleTimerRestart(enabled: boolean) {
	const generalSettings = props.plugin?.__generalSettings;
	if (generalSettings && typeof generalSettings.restartAutoBackupTimer === "function") {
		generalSettings.restartAutoBackupTimer(enabled, backupFrequency.value, backupTime.value);
	}
}

watch(backupFrequency, () => handleTimerRestart(autoBackupEnabled.value));
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
				backupMode.value = data.backupMode ?? "full";
				cloudSyncEnabled.value = data.cloudSyncEnabled ?? false;
				lastBackupTime.value = data.lastBackupTime ?? "";
				lastBackupTimestamp = data.lastBackupTimestamp ?? 0;
				if (data.workspacePath) {
					workspacePath.value = data.workspacePath;
					workspaceRoot.value = data.workspaceRoot || data.workspacePath.replace(/\/data$/, "");
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
				backupMode: backupMode.value,
				cloudSyncEnabled: cloudSyncEnabled.value,
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

// 加载云备份配置
async function loadCloudConfig() {
	if (!cloudBackupManager) return;
	const config = await cloudBackupManager.loadConfig();
	if (config) {
		cloudConfig.value = config;
	}
	if (cloudSyncEnabled.value) {
		await loadCloudBackups();
	}
}

// 保存云备份配置
async function saveCloudConfig() {
	if (!cloudBackupManager) return;
	await cloudBackupManager.saveConfig(cloudConfig.value);
}

// 检测工作区路径
async function detectWorkspacePath() {
	const envRoot = (window as any).__SIYUAN_WORKSPACE__ || (window as any).SIYUAN_WORKSPACE;
	if (envRoot) {
		updateWorkspacePath(envRoot);
		return;
	}

	const savedPath = localStorage.getItem("siyuan-workspace-path");
	const savedRoot = localStorage.getItem("siyuan-workspace-root");
	if (savedPath) {
		workspacePath.value = savedPath;
		workspaceRoot.value = savedRoot || savedPath.replace(/\/data$/, "");
		return;
	}

	try {
		if (props.plugin?.dataPath) {
			updateWorkspacePath(props.plugin.dataPath);
			return;
		}
	} catch {
		/* 忽略错误 */
	}

	const apiPath = await fetchWorkspacePath();
	if (apiPath) {
		updateWorkspacePath(apiPath);
		return;
	}

	window.addEventListener("workspacePathDetected", handleWorkspacePathDetected);
}

function handleWorkspacePathDetected(event: CustomEvent) {
	updateWorkspacePath(event.detail.path);
}

// 输入对话框
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
		showMessage(props.i18n.pleaseSelectWorkspace || "请先选择工作区路径", 3000, "info");
		return;
	}
	try {
		if (typeof window.require === "function") {
			const electron = window.require("electron");
			const shell = electron.shell || electron.remote?.shell;
			if (shell?.openPath) {
				await shell.openPath(workspaceRoot.value);
				return;
			}
		}
		const response = await fetch("/api/file/getFile", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: workspaceRoot.value }),
		});
		if (response.ok) {
			showMessage(props.i18n.folderOpened || "已在浏览器中打开", 2000, "info");
		} else {
			showMessage(props.i18n.openFolderFailed || "打开文件夹失败", 3000, "error");
		}
	} catch (error) {
		console.error("打开工作区文件夹失败:", error);
		showMessage(props.i18n.openFolderFailed || "打开文件夹失败", 3000, "error");
	}
}

// 选择工作区路径
async function selectWorkspacePath() {
	if (!workspaceRoot.value) {
		const wsPath = await fetchWorkspacePath();
		if (wsPath) {
			updateWorkspacePath(wsPath, true);
			showMessage(props.i18n.workspacePathSet || "工作区路径已自动获取", 2000, "info");
			return;
		}
	}
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
					showMessage(props.i18n.workspacePathSet || "工作区路径已设置", 2000, "info");
					return;
				}
			}
		} catch (error) {
			console.warn("Electron dialog 不可用:", error);
		}
	}
	const inputPath = await showInputDialogHelper(props.i18n.enterWorkspacePath || "请输入思源工作区路径:");
	if (inputPath) {
		updateWorkspacePath(inputPath, true);
		showMessage(props.i18n.workspacePathSet || "工作区路径已设置", 2000, "info");
	}
}

// ========== 备份操作 ==========

// 全量备份
async function performFullBackup() {
	if (isBackingUp.value || !backupManager) return;

	if (!workspacePath.value) {
		showMessage(props.i18n.pleaseSelectWorkspace || "请先选择工作区路径", 3000, "info");
		await selectWorkspacePath();
		if (!workspacePath.value) return;
	}

	isBackingUp.value = true;
	backupProgress.value = { phase: "scanning", currentFile: "", filesProcessed: 0, totalFiles: 0, percent: 0, isIncremental: false };

	try {
		const result = await backupManager.performFullBackup({
			onProgress: (p) => {
				backupProgress.value = { ...p, isIncremental: false };
			},
		});

		await onBackupComplete(result);
	} catch (error: any) {
		console.error("全量备份失败:", error);
		showMessage(`${props.i18n.backupFailed || "备份失败"}: ${error.message}`, 5000, "error");
	} finally {
		isBackingUp.value = false;
	}
}

// 增量备份
async function performIncrementalBackup() {
	if (isBackingUp.value || !backupManager) return;

	if (!workspacePath.value) {
		showMessage(props.i18n.pleaseSelectWorkspace || "请先选择工作区路径", 3000, "info");
		await selectWorkspacePath();
		if (!workspacePath.value) return;
	}

	isBackingUp.value = true;
	backupProgress.value = { phase: "scanning", currentFile: "", filesProcessed: 0, totalFiles: 0, percent: 0, isIncremental: true };

	try {
		const result = await backupManager.performIncrementalBackup({
			onProgress: (p) => {
				backupProgress.value = { ...p, isIncremental: true };
			},
		});

		await onBackupComplete(result);
	} catch (error: any) {
		console.error("增量备份失败:", error);
		showMessage(`${props.i18n.backupFailed || "备份失败"}: ${error.message}`, 5000, "error");
	} finally {
		isBackingUp.value = false;
	}
}

// 备份完成后的统一处理
async function onBackupComplete(result: any) {
	lastBackupTime.value = new Date().toLocaleString();
	lastBackupTimestamp = Date.now();
	await saveSettings();

	props.plugin?.__generalSettings?.updateLastBackupTime?.(lastBackupTimestamp);

	// 更新备份列表
	backupList.value.unshift({
		name: result.fileName,
		path: result.filePath,
		time: lastBackupTime.value,
		size: formatFileSize(result.size),
		isIncremental: result.isIncremental,
	});

	if (backupList.value.length > keepBackupCount.value) {
		backupList.value = backupList.value.slice(0, keepBackupCount.value);
	}

	await props.plugin.saveData("backup-history", { list: backupList.value });

	const modeLabel = result.isIncremental ? "增量" : "全量";
	showMessage(`${modeLabel}备份成功: ${result.fileName}（${result.changedFiles}/${result.totalFiles} 文件）`, 3000, "info");

	// 自动云同步
	if (cloudSyncEnabled.value && cloudBackupManager) {
		try {
			await cloudBackupManager.upload(result.filePath);
			showMessage("已同步至云端", 2000, "info");
		} catch (err: any) {
			console.error("自动云同步失败:", err);
			showMessage(`云同步失败: ${err.message}`, 3000, "error");
		}
	}
}

// 恢复备份
async function restoreBackup(backup: { name: string; path: string }) {
	if (isRestoring.value || !backupManager) return;

	const confirmRestore = confirm(
		`确定要从备份 "${backup.name}" 恢复吗？\n\n⚠️ 此操作将覆盖当前工作区数据，请确保已做好其他备份！`,
	);
	if (!confirmRestore) return;

	isRestoring.value = true;
	backupProgress.value = { phase: "reading", currentFile: "", filesProcessed: 0, totalFiles: 0, percent: 0 };

	try {
		const result = await backupManager.restoreBackup(backup.path, {
			onProgress: (p) => {
				backupProgress.value = { ...p, isIncremental: false };
			},
		});

		showMessage(
			`恢复成功！已恢复 ${result.restoredFiles} 个文件${result.skippedFiles > 0 ? `，跳过 ${result.skippedFiles} 个` : ""}`,
			5000,
			"info",
		);
	} catch (error: any) {
		console.error("恢复备份失败:", error);
		showMessage(`恢复失败: ${error.message}`, 5000, "error");
	} finally {
		isRestoring.value = false;
	}
}

// 校验备份
async function verifyBackup(backup: { name: string; path: string }) {
	if (isVerifying.value || !backupManager) return;

	isVerifying.value = true;
	verifyResult.value = null;

	try {
		const result = await backupManager.verifyBackup(backup.path);
		verifyResult.value = result;
	} catch (error: any) {
		verifyResult.value = {
			valid: false,
			checksum: "",
			expectedChecksum: "",
			fileCount: 0,
			totalSize: 0,
			error: error.message,
		};
	} finally {
		isVerifying.value = false;
	}
}

// 上传到云端
async function uploadToCloud(backup: { name: string; path: string }) {
	if (!cloudBackupManager) return;

	try {
		await cloudBackupManager.upload(backup.path);
		showMessage(`已上传 ${backup.name} 至云端`, 2000, "info");
		await loadCloudBackups();
	} catch (error: any) {
		console.error("云上传失败:", error);
		showMessage(`上传失败: ${error.message}`, 3000, "error");
	}
}

// 测试云连接
async function testCloudConnection() {
	if (!cloudBackupManager) return;

	isTestingCloud.value = true;
	cloudTestResult.value = null;

	try {
		await saveCloudConfig();
		cloudTestResult.value = await cloudBackupManager.testConnection(cloudConfig.value);
	} catch (error: any) {
		cloudTestResult.value = { success: false, message: error.message };
	} finally {
		isTestingCloud.value = false;
	}
}

// 加载云端备份列表
async function loadCloudBackups() {
	if (!cloudBackupManager) return;

	try {
		cloudBackupList.value = await cloudBackupManager.listBackups();
	} catch (error) {
		console.error("加载云端备份列表失败:", error);
		cloudBackupList.value = [];
	}
}

// 从云端下载
async function downloadFromCloud(file: CloudFileInfo) {
	if (!cloudBackupManager || isRestoring.value) return;

	isRestoring.value = true;
	try {
		const path = window.require("path");
		const localPath = path.join(getBackupDir(), file.name);
		await cloudBackupManager.download(file.key, localPath);
		showMessage(`已下载 ${file.name}`, 2000, "info");
		await loadBackupList();
	} catch (error: any) {
		showMessage(`下载失败: ${error.message}`, 3000, "error");
	} finally {
		isRestoring.value = false;
	}
}

// 删除云端备份
async function deleteFromCloud(file: CloudFileInfo) {
	if (!cloudBackupManager) return;

	const confirmDelete = confirm(`确定要删除云端备份 "${file.name}" 吗？`);
	if (!confirmDelete) return;

	try {
		await cloudBackupManager.deleteBackup(file.key);
		showMessage("云端备份已删除", 2000, "info");
		await loadCloudBackups();
	} catch (error: any) {
		showMessage(`删除失败: ${error.message}`, 3000, "error");
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
		// 优先从文件系统扫描（获取最新的 isIncremental 信息）
		if (backupManager) {
			const scanned = await backupManager.scanBackupDir();
			if (scanned.length > 0) {
				backupList.value = scanned;
				await props.plugin.saveData("backup-history", { list: backupList.value });
				return;
			}
		}

		// 降级到已保存的记录
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
		const confirmDelete = confirm(props.i18n.confirmDelete || "确定要删除此备份吗？");
		if (!confirmDelete) return;

		// 从文件系统删除
		if (backupManager) {
			await backupManager.deleteBackupFile(backup.path);
		}

		backupList.value = backupList.value.filter((b) => b.name !== backup.name);
		await props.plugin.saveData("backup-history", { list: backupList.value });

		showMessage(props.i18n.deleteSuccess || "删除成功", 2000, "info");
	} catch (error) {
		console.error("删除备份失败:", error);
		showMessage(props.i18n.deleteFailed || "删除失败", 3000, "error");
	}
}

defineExpose({
	loadSettings,
	saveSettings,
	performFullBackup,
	performIncrementalBackup,
	refreshBackupList,
});
</script>

<style scoped lang="scss">
@use './styles/DataBackupSettings.scss';
</style>
