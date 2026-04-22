<template>
  <div v-if="visible" class="shortcut-dialog-overlay" @click="$emit('close')">
    <div class="shortcut-dialog" @click.stop>
      <div class="dialog-header">
        <div class="dialog-title">{{ title }}</div>
        <Button variant="ghost" size="small" icon="close" @click="$emit('close')" />
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>{{ formatLabel }}</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" v-model="localFormat" value="json" />
              <span>{{ jsonOption }}</span>
            </label>
            <label class="radio-label">
              <input type="radio" v-model="localFormat" value="markdown" />
              <span>{{ markdownOption }}</span>
            </label>
          </div>
        </div>
        <div class="export-preview">
          <p>{{ previewText }} {{ count }} {{ previewUnit }}</p>
        </div>
      </div>
      <div class="dialog-footer">
        <Button variant="secondary" @click="$emit('close')">{{ cancelText }}</Button>
        <Button variant="primary" @click="handleExport">{{ exportText }}</Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import Button from "@/components/Button.vue";

interface Props {
	visible: boolean;
	count: number;
	format: "json" | "markdown";
	title?: string;
	formatLabel?: string;
	jsonOption?: string;
	markdownOption?: string;
	previewText?: string;
	previewUnit?: string;
	cancelText?: string;
	exportText?: string;
}

const props = withDefaults(defineProps<Props>(), {
	title: "导出快捷键",
	formatLabel: "导出格式",
	jsonOption: "JSON 格式",
	markdownOption: "Markdown 表格",
	previewText: "将导出",
	previewUnit: "个快捷键",
	cancelText: "取消",
	exportText: "导出",
});

const emit = defineEmits<{
	close: [];
	export: [format: "json" | "markdown"];
}>();

const localFormat = ref<"json" | "markdown">(props.format);

watch(
	() => props.format,
	(val) => {
		localFormat.value = val;
	},
);

function handleExport() {
	emit("export", localFormat.value);
}
</script>

<style scoped lang="scss">
.shortcut-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.shortcut-dialog {
  background: var(--b3-theme-background);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 450px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.dialog-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.dialog-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 12px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 4px;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-label:hover {
  background: var(--b3-theme-surface);
  border-color: var(--b3-theme-primary);
}

.radio-label input[type="radio"] {
  margin: 0;
  cursor: pointer;
}

.export-preview {
  padding: 12px;
  background: var(--b3-theme-surface);
  border-radius: 4px;
  border-left: 3px solid var(--b3-theme-primary);
}

.export-preview p {
  margin: 0;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
}

.dialog-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}
</style>
