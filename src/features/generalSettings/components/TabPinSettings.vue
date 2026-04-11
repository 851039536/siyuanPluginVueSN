<template>
  <div class="tab-pin-settings">
    <div class="settings-container">
      <!-- 启用钉住页签优化 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">📌</span>
            {{ i18n.enableTabPinOptimization || '钉住页签优化' }}
          </label>
          <div class="toggle-container">
            <input
              v-model="enabled"
              type="checkbox"
              class="toggle-checkbox"
              @change="onEnabledChange"
            />
            <span class="toggle-label">{{ enabled ? (i18n.enabled || '已启用') : (i18n.disabled || '已禁用') }}</span>
          </div>
        </div>
      </div>

      <!-- 显示模式选项 -->
      <div v-if="enabled" class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">👁️</span>
            {{ i18n.tabPinDisplayMode || '显示模式' }}
          </label>
          <div class="display-mode-options">
            <label class="radio-item">
              <input
                v-model="displayMode"
                type="radio"
                value="iconAndText"
                @change="onDisplayModeChange"
              />
              <span class="radio-label">{{ i18n.iconAndText || '图标 + 标题' }}</span>
            </label>
            <label class="radio-item">
              <input
                v-model="displayMode"
                type="radio"
                value="textOnly"
                @change="onDisplayModeChange"
              />
              <span class="radio-label">{{ i18n.textOnly || '仅标题' }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 页签设置选项 -->
      <div v-if="enabled" class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🎨</span>
            {{ i18n.tabPinTextColor || '页签文字颜色' }}
          </label>
          <div class="color-input-group">
            <input
              v-model="textColor"
              type="color"
              class="color-picker"
              @change="onTextColorChange"
            />
            <input
              v-model="textColor"
              type="text"
              class="color-text"
              @change="onTextColorChange"
            />
            <button
              v-if="textColor !== defaultTextColor"
              class="reset-color-btn"
              @click="resetTextColor"
            >
              {{ i18n.resetColor || '重置' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="enabled" class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🖼️</span>
            {{ i18n.tabPinBackground || '页签背景颜色' }}
          </label>
          <div class="color-input-group">
            <input
              v-model="backgroundColor"
              type="color"
              class="color-picker"
              @change="onBackgroundColorChange"
            />
            <input
              v-model="backgroundColor"
              type="text"
              class="color-text"
              @change="onBackgroundColorChange"
            />
            <button
              v-if="backgroundColor !== defaultBackgroundColor"
              class="reset-color-btn"
              @click="resetBackgroundColor"
            >
              {{ i18n.resetColor || '重置' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 说明提示 -->
      <div v-if="enabled" class="setting-row">
        <div class="setting-item">
          <div class="level-display-hint">
            <span class="hint-icon">ℹ️</span>
            <span class="hint-text">{{ i18n.tabPinHint || '钉住的页签将同时显示图标和标题，方便快速识别' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { saveTabPinSettings, loadTabPinSettings } from "@/config/settings";

interface Props {
	i18n?: any;
	plugin?: any;
}

interface Emits {
	(e: "change", settings: any): void;
}

const props = withDefaults(defineProps<Props>(), {
	i18n: () => ({}),
	plugin: null,
});

const emit = defineEmits<Emits>();

// 默认值
const defaultTextColor = "inherit";
const defaultBackgroundColor = "rgba(var(--b3-theme-primary-rgb), 0.1)";

// 状态
const enabled = ref(true);
const displayMode = ref<"iconAndText" | "textOnly">("iconAndText");
const textColor = ref(defaultTextColor);
const backgroundColor = ref(defaultBackgroundColor);

// 统一的设置变更处理函数
function handleSettingsChange() {
	applyToDocument();
	autoSave();
}

// 应用到文档
function applyToDocument() {
	let style = document.getElementById(
		"tab-pin-settings-style",
	) as HTMLStyleElement | null;
	if (!style) {
		style = document.createElement("style");
		style.id = "tab-pin-settings-style";
		document.head.appendChild(style);
	}

	if (enabled.value) {
		let css = `
      /* 钉住页签：显示标题文本 */
      .layout-tab-bar .item.item--pin .item__text {
        width: auto !important;
        max-width: none !important;
        display: flex !important;
      }
    `;

		// 根据显示模式添加不同的样式
		if (displayMode.value === "textOnly") {
			css += `
        /* 仅显示标题：隐藏图标 */
        .layout-tab-bar .item.item--pin .item__icon {
          display: none !important;
        }
      `;
		}

		css += `
      /* 钉住页签：应用自定义颜色 */
      .layout-tab-bar .item.item--pin {
        ${textColor.value !== defaultTextColor ? `color: ${textColor.value} !important;` : ""}
        ${backgroundColor.value !== defaultBackgroundColor ? `background: ${backgroundColor.value} !important;` : ""}
      }
    `;

		style.textContent = css;
	} else {
		// 禁用时移除所有样式
		style.textContent = "";
	}
}

// 启用状态变化
function onEnabledChange() {
	handleSettingsChange();
}

// 显示模式变化
function onDisplayModeChange() {
	handleSettingsChange();
}

// 文字颜色变化
function onTextColorChange() {
	handleSettingsChange();
}

// 背景颜色变化
function onBackgroundColorChange() {
	handleSettingsChange();
}

// 重置文字颜色
function resetTextColor() {
	textColor.value = defaultTextColor;
	handleSettingsChange();
}

// 重置背景颜色
function resetBackgroundColor() {
	backgroundColor.value = defaultBackgroundColor;
	handleSettingsChange();
}

// 自动保存设置
async function autoSave() {
	if (!props.plugin) return;

	try {
		const settingsToSave = {
			enabled: enabled.value,
			displayMode: displayMode.value,
			textColor: textColor.value,
			backgroundColor: backgroundColor.value,
		};

		await saveTabPinSettings(props.plugin, settingsToSave);
		emit("change", settingsToSave);
	} catch (error) {
		console.error("保存钉住页签设置失败:", error);
	}
}

// 加载保存的设置
async function loadSettings() {
	if (!props.plugin) {
		console.warn("插件实例不可用，使用默认设置");
		return;
	}

	try {
		const settings = await loadTabPinSettings(props.plugin);

		enabled.value = settings.enabled ?? true;
		displayMode.value = settings.displayMode || "iconAndText";
		textColor.value = settings.textColor || defaultTextColor;
		backgroundColor.value = settings.backgroundColor || defaultBackgroundColor;
	} catch (error) {
		console.error("加载钉住页签设置失败:", error);
	}
}

// 初始化 - 在组件挂载后执行
onMounted(async () => {
	await loadSettings();
	// 样式应用已移至 GeneralSettings.init() 中
});

// 监听变化，自动保存
watch(enabled, handleSettingsChange);
watch(displayMode, handleSettingsChange);
watch(textColor, handleSettingsChange);
watch(backgroundColor, handleSettingsChange);

// 暴露方法
defineExpose({
	loadSettings,
	enabled,
	displayMode,
	textColor,
	backgroundColor,
});
</script>

<style scoped>
.tab-pin-settings {
  padding: 12px;
  box-sizing: border-box;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 100%;
}

/* 设置行样式 */
.setting-row {
  display: flex;
  width: 100%;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin: 0;
}

.label-icon {
  font-size: 14px;
  opacity: 0.8;
}

/* 切换按钮样式 */
.toggle-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toggle-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.toggle-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  user-select: none;
}

/* 显示模式选项 */
.display-mode-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 10px;
  background: var(--b3-theme-surface-variant);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.radio-item:hover {
  background: rgba(var(--b3-theme-primary-rgb), 0.08);
}

.radio-item input[type="radio"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.radio-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  user-select: none;
}

/* 颜色输入组 */
.color-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.color-picker {
  width: 48px;
  height: 36px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
}

.color-picker:hover {
  border-color: var(--b3-theme-primary);
}

.color-text {
  flex: 1;
  min-width: 100px;
  padding: 6px 10px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  text-transform: uppercase;
  transition: all 0.2s ease;
}

.color-text:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.reset-color-btn {
  padding: 6px 12px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.reset-color-btn:hover {
  border-color: var(--b3-theme-primary);
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

/* 提示信息 */
.level-display-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 6px 10px;
  background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08);
  border-left: 3px solid var(--b3-theme-primary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
}

.hint-icon {
  font-size: 14px;
  opacity: 0.8;
}

.hint-text {
  flex: 1;
  line-height: 1.4;
}

/* 响应式调整 */
@media (max-width: 480px) {
  .color-input-group {
    flex-direction: column;
    align-items: stretch;
  }
  
  .color-picker {
    width: 100%;
  }
  
  .color-text {
    min-width: auto;
  }
}
</style>
