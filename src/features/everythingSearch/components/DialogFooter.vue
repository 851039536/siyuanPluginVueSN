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
@use "../styles/DialogFooter.scss";
</style>
