<template>
  <div class="settings-section">
    <div class="settings-row">
      <!-- 内容类型 -->
      <div class="setting-item">
        <label class="setting-label">{{ contentTypeLabel }}</label>
        <Select
          :model-value="contentType"
          @update:model-value="onContentTypeChange"
          :options="contentTypeOptions"
          size="small"
        />
      </div>

      <!-- 语言选择(代码模式) -->
      <div class="setting-item" v-if="contentType === 'code'">
        <label class="setting-label">{{ languageLabel }}</label>
        <Select
          :model-value="selectedLanguage"
          @update:model-value="onLanguageChange"
          :options="languageOptions"
          size="small"
        />
      </div>

      <!-- 风格选择 -->
      <div class="setting-item">
        <label class="setting-label">{{ styleLabel }}</label>
        <Select
          :model-value="selectedStyle"
          @update:model-value="onStyleChange"
          :options="styleOptions"
          size="small"
        />
      </div>
    </div>

    <div class="settings-row">
      <!-- 主题选择 -->
      <div class="setting-item">
        <label class="setting-label">{{ themeLabel }}</label>
        <Select
          :model-value="selectedTheme"
          @update:model-value="onThemeChange"
          :options="themeOptions"
          size="small"
        />
      </div>

      <!-- 字体大小 -->
      <div class="setting-item">
        <label class="setting-label">{{ fontSizeLabel }}</label>
        <div class="size-control">
          <input
            :value="fontSize"
            @input="onFontSizeChange"
            type="range"
            min="12"
            max="24"
            step="1"
            class="size-slider"
          />
          <span class="size-value">{{ fontSize }}px</span>
        </div>
      </div>
    </div>

    <!-- 装饰选项插槽 -->
    <slot name="decorations" />
  </div>
</template>

<script setup lang="ts">
import Select from "@/components/Select.vue";
import type { SelectOption } from "@/components/Select.vue";

interface Props {
	contentType: "code" | "text";
	selectedLanguage: string;
	selectedStyle: string;
	selectedTheme: string;
	fontSize: number;
	contentTypeLabel: string;
	languageLabel: string;
	styleLabel: string;
	themeLabel: string;
	fontSizeLabel: string;
	contentTypeOptions: SelectOption[];
	languageOptions: SelectOption[];
	styleOptions: SelectOption[];
	themeOptions: SelectOption[];
}

defineProps<Props>();
const emit = defineEmits<{
	"update:contentType": [value: string];
	"update:selectedLanguage": [value: string];
	"update:selectedStyle": [value: string];
	"update:selectedTheme": [value: string];
	"update:fontSize": [value: number];
}>();

const onContentTypeChange = (value: string) =>
	emit("update:contentType", value);
const onLanguageChange = (value: string) =>
	emit("update:selectedLanguage", value);
const onStyleChange = (value: string) => emit("update:selectedStyle", value);
const onThemeChange = (value: string) => emit("update:selectedTheme", value);
const onFontSizeChange = (e: Event) => {
	emit("update:fontSize", Number((e.target as HTMLInputElement).value));
};
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
