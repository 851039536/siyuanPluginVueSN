<template>
  <div class="highlight-settings">
    <label class="setting-label">
      <span class="label-icon">🖍️</span>
      {{ i18n?.enableHighlight || '双击高亮功能' }}
    </label>
    <SiSwitch v-model="enableHighlight" @change="handleToggleChange" />
    <p class="toggle-description">
      {{ i18n?.highlightDescription || '双击选中文本自动高亮显示' }}
    </p>

    <!-- 功能说明 -->
    <div class="feature-description">
      <div class="description-title">
        <span class="title-icon">💡</span>
        {{ i18n?.featureDescription || '功能说明' }}
      </div>
      <ul class="description-list">
        <li>{{ i18n?.highlightFeature1 || '在文档编辑器中双击选中文本，自动应用高亮样式' }}</li>
        <li>{{ i18n?.highlightFeature2 || '支持多种高亮颜色，可在设置中自定义颜色主题' }}</li>
        <li>{{ i18n?.highlightFeature3 || '高亮内容会在文档中持久保存，方便后续查阅' }}</li>
        <li>{{ i18n?.highlightFeature4 || '配合搜索功能可快速定位高亮内容' }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from "siyuan";
import { onMounted, ref } from "vue";
import SiSwitch from "@/components/Switch.vue";

const props = defineProps<{
	i18n?: Record<string, string>;
	plugin?: any;
}>();

const enableHighlight = ref(true);

const loadSettings = async () => {
	try {
		const settings = await props.plugin?.loadData("highlight-settings");
		if (settings) enableHighlight.value = settings.enableHighlight ?? true;

		// 从 GeneralSettings 共享实例获取当前高亮状态
		const generalSettings = (props.plugin as any).__generalSettings;
		if (generalSettings) {
			const manager = generalSettings.getHighlightManager();
			if (manager) {
				enableHighlight.value = manager.isActive();
			}
		}
	} catch (e) {
		console.error("加载高亮设置失败:", e);
	}
};

const handleToggleChange = async () => {
	try {
		await props.plugin?.saveData("highlight-settings", {
			enableHighlight: enableHighlight.value,
		});

		// 通过 GeneralSettings 共享实例更新高亮状态
		const generalSettings = (props.plugin as any).__generalSettings;
		if (generalSettings) {
			generalSettings.updateHighlight(enableHighlight.value);
		}

		showMessage(
			enableHighlight.value ? "双击高亮功能已启用" : "双击高亮功能已禁用",
			2000,
			"info",
		);
	} catch (e) {
		console.error("保存高亮设置失败:", e);
	}
};

onMounted(loadSettings);

defineExpose({ loadSettings, enableHighlight });
</script>

<style scoped>
.highlight-settings {
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
</style>
