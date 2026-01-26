<template>
  <div class="dialog-footer">
    <div class="config-section">
      <span class="config-label">服务地址:</span>
      <input
        :model-value="config.host"
        @input="updateConfig('host', ($event.target as HTMLInputElement).value)"
        type="text"
        class="config-input"
        placeholder="localhost"
        aria-label="服务地址"
      />
      <span class="config-label">端口:</span>
      <input
        :model-value="config.port"
        @input="updateConfig('port', Number(($event.target as HTMLInputElement).value))"
        type="number"
        class="config-input port-input"
        placeholder="80"
        aria-label="服务端口"
        min="1"
        max="65535"
      />
    </div>
    <div class="footer-actions">
      <span class="shortcut-hint">{{ shortcutHint }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EverythingConfig } from '../api'

interface Props {
  /** 配置 */
  config: EverythingConfig
  /** 快捷键提示文本 */
  shortcutHint?: string
}

interface Emits {
  (e: 'update:config', key: keyof EverythingConfig, value: EverythingConfig[keyof EverythingConfig]): void
}

const props = withDefaults(defineProps<Props>(), {
  shortcutHint: 'Esc 关闭 | Enter 搜索'
})

const emit = defineEmits<Emits>()

/** 更新配置 */
const updateConfig = (key: keyof EverythingConfig, value: EverythingConfig[keyof EverythingConfig]) => {
  emit('update:config', key, value)
}
</script>

<style scoped lang="scss">
@use "@/index.scss" as *;

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

.config-input {
  padding: 3px 6px;
  width: 75px;
  border: 1px solid var(--b3-border-color);
  border-radius: 3px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 11px;
  font-family: $font-body;
  transition: border-color 0.15s;

  &:focus {
    outline: none;
    border-color: $brand-orange;
  }
}

.port-input {
  width: 45px;
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
