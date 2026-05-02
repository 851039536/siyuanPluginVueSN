<template>
  <div class="table-style-settings">
    <div class="settings-container">
      <!-- 表格样式设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">📊</span>
            {{ i18n.tableStyleSettings || '表格样式设置' }}
          </label>
          <p class="setting-description">{{ i18n.tableStyleSettingsDesc || '自定义表格的边框、背景、颜色等样式' }}</p>
        </div>
      </div>

      <!-- 启用表格样式设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">✨</span>
            {{ i18n.enableTableStyle || '启用表格样式设置' }}
          </label>
          <div class="toggle-container">
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="settings.enabled"
                class="toggle-input"
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-description">
              {{ settings.enabled ? (i18n.enabled || '已启用') : (i18n.disabled || '已禁用') }}
            </span>
          </div>
        </div>
      </div>

      <template v-if="settings.enabled">
        <!-- 表格外框 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">🔲</span>
              {{ i18n.tableBorder || '表格外框' }}
            </label>
            <div class="color-input-group">
              <input
                v-model="settings.borderColor"
                type="color"
                class="color-picker"
              />
              <input
                v-model="settings.borderColor"
                type="text"
                class="color-text"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <!-- 单元格边框 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">📐</span>
              {{ i18n.tableCellBorder || '单元格边框' }}
            </label>
            <div class="color-input-group">
              <input
                v-model="settings.cellBorderColor"
                type="color"
                class="color-picker"
              />
              <input
                v-model="settings.cellBorderColor"
                type="text"
                class="color-text"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <!-- 表头背景 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">🎨</span>
              {{ i18n.tableHeaderBackground || '表头背景' }}
            </label>
            <div class="color-input-group">
              <input
                v-model="settings.headerBackground"
                type="color"
                class="color-picker"
              />
              <input
                v-model="settings.headerBackground"
                type="text"
                class="color-text"
                placeholder="#e0ffd6"
              />
            </div>
          </div>
        </div>

        <!-- 奇数行背景 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">📝</span>
              {{ i18n.tableOddRowBackground || '奇数行背景' }}
            </label>
            <div class="color-input-group">
              <input
                v-model="settings.oddRowBackground"
                type="color"
                class="color-picker"
              />
              <input
                v-model="settings.oddRowBackground"
                type="text"
                class="color-text"
                placeholder="#ffffff"
              />
            </div>
          </div>
        </div>

        <!-- 偶数行背景 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">📝</span>
              {{ i18n.tableEvenRowBackground || '偶数行背景' }}
            </label>
            <div class="color-input-group">
              <input
                v-model="settings.evenRowBackground"
                type="color"
                class="color-picker"
              />
              <input
                v-model="settings.evenRowBackground"
                type="text"
                class="color-text"
                placeholder="#f8f8f8"
              />
            </div>
          </div>
        </div>

        <!-- 文本颜色 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">🖌️</span>
              {{ i18n.tableTextColor || '文本颜色' }}
            </label>
            <div class="color-input-group">
              <input
                v-model="settings.textColor"
                type="color"
                class="color-picker"
              />
              <input
                v-model="settings.textColor"
                type="text"
                class="color-text"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <!-- 圆角大小 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">⭕</span>
              {{ i18n.tableBorderRadius || '圆角大小' }}
              <span class="setting-value">{{ settings.borderRadius }}px</span>
            </label>
            <div class="slider-container">
              <input
                v-model.number="settings.borderRadius"
                type="range"
                min="0"
                max="20"
                step="1"
                class="range-slider"
              />
              <div class="slider-labels">
                <span>0px</span>
                <span>20px</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 预览区域 -->
        <div class="preview-section">
          <div class="preview-toggle" @click="togglePreview">
            <span class="preview-icon">{{ showPreview ? '👁️' : '👁️‍🗨️' }}</span>
            <span>{{ i18n.preview || '预览效果' }}</span>
            <span class="toggle-arrow" :class="{ expanded: showPreview }">▼</span>
          </div>
          <transition name="preview-expand">
            <div v-show="showPreview" class="preview-content">
              <table class="preview-table" :style="previewTableStyle">
                <thead>
                  <tr>
                    <th>标题 1</th>
                    <th>标题 2</th>
                    <th>标题 3</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>数据 1-1</td>
                    <td>数据 1-2</td>
                    <td>数据 1-3</td>
                  </tr>
                  <tr>
                    <td>数据 2-1</td>
                    <td>数据 2-2</td>
                    <td>数据 2-3</td>
                  </tr>
                  <tr>
                    <td>数据 3-1</td>
                    <td>数据 3-2</td>
                    <td>数据 3-3</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </transition>
        </div>
      </template>

      <!-- 重置按钮 -->
      <div class="setting-row">
        <div class="setting-item">
          <button class="reset-btn" @click="resetSettings">
            <span class="btn-icon">🔄</span>
            {{ i18n.resetToDefault || '恢复默认设置' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import { Plugin } from "siyuan";

export interface TableStyleSettingsData {
	enabled: boolean;
	borderColor: string;
	cellBorderColor: string;
	headerBackground: string;
	oddRowBackground: string;
	evenRowBackground: string;
	textColor: string;
	borderRadius: number;
}

interface Props {
	i18n?: any;
	plugin?: Plugin;
}

interface Emits {
	(e: "change", settings: TableStyleSettingsData): void;
}

const props = withDefaults(defineProps<Props>(), {
	i18n: () => ({}),
	plugin: null,
});

const emit = defineEmits<Emits>();

const DEFAULT_SETTINGS: TableStyleSettingsData = {
	enabled: false,
	borderColor: "rgba(0, 0, 0, 0.623)",
	cellBorderColor: "rgba(0, 0, 0, 0.171)",
	headerBackground: "#e0ffd6",
	oddRowBackground: "#ffffff",
	evenRowBackground: "#f8f8f8",
	textColor: "#000000",
	borderRadius: 6,
};

const settings = ref<TableStyleSettingsData>({ ...DEFAULT_SETTINGS });
const showPreview = ref(true);

const previewTableStyle = computed(() => ({
	borderRadius: `${settings.value.borderRadius}px`,
}));

watch(
	settings,
	(newSettings) => {
		emit("change", newSettings);
		saveSettings();
		applySettings();
	},
	{ deep: true },
);

function togglePreview() {
	showPreview.value = !showPreview.value;
}

function resetSettings() {
	settings.value = { ...DEFAULT_SETTINGS };
	applySettings();
}

function applySettings() {
	applyTableStyles(settings.value);
}

function applyTableStyles(tableSettings: TableStyleSettingsData) {
	try {
		// 移除现有样式
		const existingStyle = document.getElementById("table-style-settings");
		if (existingStyle) {
			existingStyle.remove();
		}

		if (!tableSettings.enabled) {
			return;
		}

		// 创建新的样式元素
		const style = document.createElement("style");
		style.id = "table-style-settings";

		style.textContent = `
      /* 表格整体外框 */
      .protyle-wysiwyg table {
        border-collapse: collapse !important;
        border: 1px solid ${tableSettings.borderColor} !important;
        border-radius: ${tableSettings.borderRadius}px !important;
        overflow: hidden;
        box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.15);
      }
      
      /* 表格内部网格线 */
      .protyle-wysiwyg table th,
      .protyle-wysiwyg table td {
        border: 1.5px solid ${tableSettings.cellBorderColor} !important;
      }
      
      /* 表头 */
      .protyle-wysiwyg table th {
        background-color: ${tableSettings.headerBackground} !important;
        color: ${tableSettings.textColor};
      }
      
      /* 奇数行 */
      .protyle-wysiwyg table tr:nth-child(odd) {
        background-color: ${tableSettings.oddRowBackground} !important;
        color: ${tableSettings.textColor};
      }
      
      /* 偶数行 */
      .protyle-wysiwyg table tr:nth-child(even) {
        background-color: ${tableSettings.evenRowBackground} !important;
        color: ${tableSettings.textColor};
      }
      
      /* 暗色主题适配 */
      :root[data-theme-mode="dark"] .protyle-wysiwyg table th {
        color: #ffffff;
      }
      
      :root[data-theme-mode="dark"] .protyle-wysiwyg table tr:nth-child(odd),
      :root[data-theme-mode="dark"] .protyle-wysiwyg table tr:nth-child(even) {
        color: #ffffff;
      }
    `;

		document.head.appendChild(style);
	} catch (error) {
		console.error("应用表格样式失败:", error);
	}
}

import { GeneralSettingsStorage } from "../types/storage";

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null);

async function loadSettings() {
	if (!gsStorage.value) {
		return;
	}

	try {
		const data = await gsStorage.value.tableStyle.load();
		if (data) {
			settings.value = { ...DEFAULT_SETTINGS, ...data };
			applySettings();
		}
	} catch (error) {
		console.error("加载表格样式设置失败:", error);
	}
}

async function saveSettings() {
	if (!gsStorage.value) {
		return;
	}

	try {
		await gsStorage.value.tableStyle.save(settings.value);
	} catch (error) {
		console.error("保存表格样式设置失败:", error);
	}
}

onMounted(async () => {
	await loadSettings();
});

defineExpose({
	settings,
	loadSettings,
});
</script>

<style scoped lang="scss">
@use "../styles/TableStyleSettings.scss";
</style>
