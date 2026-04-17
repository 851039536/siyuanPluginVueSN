<template>
  <div class="highlight-settings">
    <label class="section-header setting-label">
      <span class="section-icon">🖍️</span>
      {{ i18n?.enableHighlight || '双击高亮功能' }}
    </label>
    <SiSwitch v-model="enableHighlight" @change="handleToggleChange" />
    <p class="toggle-description">
      {{ i18n?.highlightDescription || '双击选中文本自动高亮显示' }}
    </p>

    <!-- 功能说明 -->
    <div class="feature-description">
      <div class="section-header description-title">
        <span class="section-icon">💡</span>
        {{ i18n?.featureDescription || '功能说明' }}
      </div>
      <ul class="description-list">
        <li>{{ i18n?.highlightFeature1 || '在文档编辑器中双击选中文本，自动应用高亮样式' }}</li>
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
		if (settings) {
			enableHighlight.value = settings.enableHighlight ?? true;
		}
	} catch (e) {
		console.error("加载高亮设置失败:", e);
	}
};

const handleToggleChange = () => {
	try {
		const generalSettings = (props.plugin as any).__generalSettings;
		if (generalSettings) {
			generalSettings.updateHighlight(enableHighlight.value);
		}

		showMessage(
			enableHighlight.value
				? (props.i18n?.highlightEnabled ?? "双击高亮功能已启用")
				: (props.i18n?.highlightDisabled ?? "双击高亮功能已禁用"),
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

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.setting-label {
  margin-bottom: 12px;
}

.description-title {
  margin-bottom: 10px;
}

.section-icon {
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

.description-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  line-height: 1.8;
}

.description-list li:not(:last-child) {
  margin-bottom: 4px;
}
</style>
