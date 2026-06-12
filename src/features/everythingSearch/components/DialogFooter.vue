<template>
  <div class="vp-footer">
    <div class="vp-footer__config">
      <span class="vp-footer__key">地址</span>
      <Input
        :model-value="config.host"
        type="text"
        size="small"
        placeholder="localhost"
        aria-label="服务地址"
        @update:model-value="updateConfig('host', $event as string)"
      />
      <span class="vp-footer__key">端口</span>
      <Input
        :model-value="config.port"
        type="number"
        size="small"
        placeholder="80"
        aria-label="服务端口"
        @update:model-value="updateConfig('port', Number($event))"
      />
    </div>
    <div class="vp-footer__hints">
      <span class="vp-footer__kbd">ESC</span>
      <span class="vp-footer__sep">关闭</span>
      <span class="vp-footer__kbd">ENTER</span>
      <span class="vp-footer__sep">搜索</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EverythingConfig } from "../types"
import Input from "@/components/Input.vue"

interface Props {
  /** 配置 */
  config: EverythingConfig
}

interface Emits {
  (
    e: "update:config",
    key: keyof EverythingConfig,
    value: EverythingConfig[keyof EverythingConfig],
  ): void
}

defineProps<Props>()

const emit = defineEmits<Emits>()

/** 更新配置 */
const updateConfig = (
  key: keyof EverythingConfig,
  value: EverythingConfig[keyof EverythingConfig],
) => {
  emit("update:config", key, value)
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;

$vp-mono: "JetBrains Mono", "Fira Code", "Consolas", monospace;

.vp-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 16px;
  background: var(--b3-theme-surface);
  border-top: 1px solid var(--b3-border-color);

  &__config {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__key {
    font-size: 11px;
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
    white-space: nowrap;
  }

  &__hints {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__kbd {
    font-size: 9px;
    font-weight: 700;
    font-family: $vp-mono;
    letter-spacing: 0.06em;
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
    padding: 1px 5px;
    border: 1px solid var(--b3-border-color);
    border-radius: 3px;
  }

  &__sep {
    font-size: 10px;
    color: var(--b3-theme-on-surface);
    opacity: 0.3;
    margin: 0 2px;
  }
}
</style>
