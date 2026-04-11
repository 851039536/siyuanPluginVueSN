<template>
  <div class="dialog-footer">
    <div class="config-section">
      <span class="config-label">服务地址:</span>
      <Input
        :model-value="config.host"
        type="text"
        size="small"
        placeholder="localhost"
        aria-label="服务地址"
        @update:model-value="updateConfig('host', $event as string)"
      />
      <span class="config-label">端口:</span>
      <Input
        :model-value="config.port"
        type="number"
        size="small"
        placeholder="80"
        aria-label="服务端口"
        @update:model-value="updateConfig('port', Number($event))"
      />
    </div>
    <div class="footer-actions">
      <span class="shortcut-hint">{{ shortcutHint }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from "@/components/Input.vue";
import type { EverythingConfig } from "../types";

interface Props {
	/** 配置 */
	config: EverythingConfig;
	/** 快捷键提示文本 */
	shortcutHint?: string;
}

interface Emits {
	(
		e: "update:config",
		key: keyof EverythingConfig,
		value: EverythingConfig[keyof EverythingConfig],
	): void;
}

const props = withDefaults(defineProps<Props>(), {
	shortcutHint: "Esc 关闭 | Enter 搜索",
});

const emit = defineEmits<Emits>();

/** 更新配置 */
const updateConfig = (
	key: keyof EverythingConfig,
	value: EverythingConfig[keyof EverythingConfig],
) => {
	emit("update:config", key, value);
};
</script>

<style scoped lang="scss">
@use "@/variables" as *;

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--b3-theme-surface);
  border-top: 1px solid var(--b3-border-color);
}

.config-section {
  display: flex;
  align-items: center;
  gap: 6px;
}

.config-label {
  font-size: 10px;
  font-family: $font-body;
  color: $brand-mid-gray;
  white-space: nowrap;
}

.footer-actions {
  display: flex;
  align-items: center;
}

.shortcut-hint {
  font-size: 10px;
  font-family: $font-body;
  color: $brand-mid-gray;
}
</style>
