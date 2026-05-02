<template>
  <div class="doc-count-settings">
    <label class="setting-label">
      <span class="label-icon">📊</span>
      {{ i18n?.enableDocCount || '笔记本文档数统计' }}
    </label>
    <SiSwitch
      v-model="enableDocCount"
      @change="handleToggleChange"
    />
    <p class="toggle-description">
      {{ i18n?.docCountDescription || '在笔记本名称后显示文档数量' }}
    </p>

    <!-- 功能说明 -->
    <div class="feature-description">
      <div class="description-title">
        <span class="title-icon">💡</span>
        {{ i18n?.featureDescription || '功能说明' }}
      </div>
      <ul class="description-list">
        <li>{{ i18n?.docCountFeature1 || '在笔记本列表中显示每个笔记本的文档数量' }}</li>
        <li>{{ i18n?.docCountFeature3 || '支持手机端和桌面端' }}</li>
        <li>{{ i18n?.docCountFeature4 || '每小时自动更新笔记本文档数' }}</li>
      </ul>
    </div>

    <!-- 更新间隔设置 -->
    <div class="update-interval">
      <label class="interval-label">
        {{ i18n?.updateInterval || '更新间隔' }}
      </label>
      <select v-model="updateInterval" class="interval-select" @change="handleIntervalChange">
        <option value="1800000">{{ i18n?.interval30min || '30分钟' }}</option>
        <option value="3600000">{{ i18n?.interval1hour || '1小时' }}</option>
        <option value="7200000">{{ i18n?.interval2hour || '2小时' }}</option>
        <option value="14400000">{{ i18n?.interval4hour || '4小时' }}</option>
      </select>
    </div>

    <!-- 字体样式设置 -->
    <div class="font-style-settings">
      <div class="settings-title">
        <span class="title-icon">🎨</span>
        {{ i18n?.fontStyleSettings || '字体样式设置' }}
      </div>

      <div class="style-row">
        <label class="style-label">
          {{ i18n?.fontSize || '字体大小' }}
        </label>
        <select v-model="fontSize" class="style-select" @change="handleFontStyleChange">
          <option value="10px">10px</option>
          <option value="11px">11px</option>
          <option value="12px">12px</option>
          <option value="13px">13px</option>
          <option value="14px">14px</option>
          <option value="15px">15px</option>
          <option value="16px">16px</option>
        </select>
      </div>

      <div class="style-row">
        <label class="style-label">
          {{ i18n?.fontColor || '字体颜色' }}
        </label>
        <div class="color-input-wrapper">
          <input
            type="color"
            v-model="fontColor"
            class="color-picker"
            @input="handleFontStyleChange"
          />
          <input
            type="text"
            v-model="fontColor"
            class="color-text"
            @change="handleFontStyleChange"
            placeholder="#8c8c8c"
          />
        </div>
      </div>

      <div class="style-row">
        <label class="style-label">
          {{ i18n?.fontWeight || '字体粗细' }}
        </label>
        <select v-model="fontWeight" class="style-select" @change="handleFontStyleChange">
          <option value="normal">{{ i18n?.fontWeightNormal || '正常' }}</option>
          <option value="bold">{{ i18n?.fontWeightBold || '粗体' }}</option>
          <option value="lighter">{{ i18n?.fontWeightLighter || '细体' }}</option>
        </select>
      </div>

      <!-- 样式预览 -->
      <div class="style-preview">
        <label class="preview-label">
          {{ i18n?.stylePreview || '样式预览' }}
        </label>
        <div class="preview-box">
          <span class="preview-text">我的笔记本</span>
          <span
            class="preview-count"
            :style="{
              fontSize: fontSize,
              color: fontColor,
              fontWeight: fontWeight
            }"
          >(123)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { showMessage } from "siyuan";
import SiSwitch from "@/components/Switch.vue";
import { DocCountManager } from "../modules/DocCountManager";

const props = defineProps<{
	i18n?: Record<string, string>;
	plugin?: any;
}>();

const emit = defineEmits<{
	change: [settings: any];
}>();

const enableDocCount = ref(true);
const updateInterval = ref("3600000");
const fontSize = ref("12px");
const fontColor = ref("#8c8c8c");
const fontWeight = ref("normal");

/**
 * 获取 GeneralSettings 实例中的 DocCountManager
 */
const getDocCountManager = (): DocCountManager | null => {
	const generalSettings = props.plugin?.__generalSettings;
	return generalSettings?.docCountManager || null;
};

import { GeneralSettingsStorage } from "../types/storage";

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null);

const ensureStorage = (): GeneralSettingsStorage => {
	if (!gsStorage.value) throw new Error("插件实例不可用");
	return gsStorage.value;
};

const loadSettings = async () => {
	try {
		const data = gsStorage.value ? await gsStorage.value.docCount.load() : null;
		if (data) {
			enableDocCount.value = data.enableDocCount ?? true;
			updateInterval.value = data.updateInterval || "3600000";
			fontSize.value = data.fontSize || "12px";
			fontColor.value = data.fontColor || "#8c8c8c";
			fontWeight.value = data.fontWeight || "normal";
		}
	} catch (e) {
		console.error("加载文档数统计设置失败:", e);
	}
};

const handleToggleChange = async () => {
	try {
		await ensureStorage().docCount.save({
			enableDocCount: enableDocCount.value,
			updateInterval: updateInterval.value,
			fontSize: fontSize.value,
			fontColor: fontColor.value,
			fontWeight: fontWeight.value,
		});

		const manager = getDocCountManager();
		if (enableDocCount.value) {
			// 如果启用但管理器不存在,创建并启动
			if (!manager && props.plugin?.__generalSettings) {
				props.plugin.__generalSettings.docCountManager = new DocCountManager();
				const newManager = getDocCountManager();
				newManager?.start();
				newManager?.setUpdateInterval(parseInt(updateInterval.value));
				newManager?.setFontStyle({
					fontSize: fontSize.value,
					color: fontColor.value,
					fontWeight: fontWeight.value,
				});
			} else {
				manager?.start();
			}
		} else {
			// 如果禁用,停止管理器
			manager?.stop();
		}

		showMessage(
			enableDocCount.value
				? "笔记本文档数统计已启用"
				: "笔记本文档数统计已禁用",
			2000,
			"info",
		);

		emit("change", {
			enableDocCount: enableDocCount.value,
			updateInterval: updateInterval.value,
			fontSize: fontSize.value,
			fontColor: fontColor.value,
			fontWeight: fontWeight.value,
		});
	} catch (e) {
		console.error("保存文档数统计设置失败:", e);
	}
};

const handleIntervalChange = async () => {
	try {
		await ensureStorage().docCount.save({
			enableDocCount: enableDocCount.value,
			updateInterval: updateInterval.value,
			fontSize: fontSize.value,
			fontColor: fontColor.value,
			fontWeight: fontWeight.value,
		});

		const manager = getDocCountManager();
		manager?.setUpdateInterval(parseInt(updateInterval.value));

		showMessage("更新间隔已修改", 2000, "info");
	} catch (e) {
		console.error("保存更新间隔失败:", e);
	}
};

const handleFontStyleChange = async () => {
	try {
		await ensureStorage().docCount.save({
			enableDocCount: enableDocCount.value,
			updateInterval: updateInterval.value,
			fontSize: fontSize.value,
			fontColor: fontColor.value,
			fontWeight: fontWeight.value,
		});

		const manager = getDocCountManager();
		manager?.setFontStyle({
			fontSize: fontSize.value,
			color: fontColor.value,
			fontWeight: fontWeight.value,
		});

		showMessage("字体样式已修改", 2000, "info");
	} catch (e) {
		console.error("保存字体样式失败:", e);
	}
};

onMounted(async () => {
	await loadSettings();
	// 注意:不再在这里创建和启动 DocCountManager
	// 它由 GeneralSettings 在插件启动时统一管理
});

onUnmounted(() => {
	// 清理工作由 GeneralSettings 统一处理
});

defineExpose({ loadSettings, enableDocCount });
</script>

<style scoped>
.doc-count-settings {
  padding: 16px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 12px;
}

.label-icon {
  font-size: 14px;
  opacity: 0.8;
}

.toggle-description {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  margin-top: 8px;
  line-height: 1.4;
}

.feature-description {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
}

.description-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 10px;
}

.title-icon {
  font-size: 14px;
}

.description-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  line-height: 1.8;
}

.description-list li {
  margin-bottom: 4px;
}

.description-list li:last-child {
  margin-bottom: 0;
}

.update-interval {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
}

.interval-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
}

.interval-select {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}

.interval-select:hover {
  border-color: var(--b3-theme-primary);
}

.interval-select:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.font-style-settings {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 14px;
}

.style-row {
  margin-bottom: 12px;
}

.style-row:last-of-type {
  margin-bottom: 0;
}

.style-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface-variant);
  margin-bottom: 6px;
}

.style-select {
  width: 100%;
  padding: 6px 10px;
  font-size: 13px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}

.style-select:hover {
  border-color: var(--b3-theme-primary);
}

.style-select:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.color-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-picker {
  width: 40px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  cursor: pointer;
  background: var(--b3-theme-background);
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.color-text {
  flex: 1;
  padding: 6px 10px;
  font-size: 13px;
  font-family: monospace;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
}

.color-text:hover {
  border-color: var(--b3-theme-primary);
}

.color-text:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.style-preview {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
}

.preview-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface-variant);
  margin-bottom: 8px;
}

.preview-box {
  padding: 10px 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  font-size: 13px;
  display: flex;
  align-items: center;
}

.preview-text {
  color: var(--b3-theme-on-background);
}

.preview-count {
  margin-left: 2px;
}

</style>
