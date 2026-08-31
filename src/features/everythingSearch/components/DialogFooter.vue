<template>
  <div class="vp-footer">
    <div class="vp-footer__config">
      <!-- 配置标签："地址" -->
      <span class="vp-footer__key">{{ i18n.host }}</span>
      <Input
        :model-value="config.host"
        type="text"
        size="xsmall"
        placeholder="localhost"
        :aria-label="i18n.host"
        @update:model-value="updateConfig('host', $event as string)"
      />
      <!-- 配置标签："端口" -->
      <span class="vp-footer__key">{{ i18n.port }}</span>
      <Input
        :model-value="config.port"
        type="number"
        size="xsmall"
        placeholder="80"
        :aria-label="i18n.port"
        @update:model-value="updatePort"
      />
    </div>
    <div class="vp-footer__hints">
      <!-- 快捷键提示："ENTER 搜索" -->
      <span class="vp-footer__kbd">ENTER</span>
      <span class="vp-footer__sep">{{ i18n.search }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EverythingConfig } from "../types"
import Input from "@/components/Input.vue"

interface Props {
  /** 配置 */
  config: EverythingConfig
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
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

/** 更新端口（非法值/空输入/越界不回写，防止 port 被置 0 导致请求静默失败） */
const updatePort = (value: string | number | null) => {
  const port = Number(value)
  if (Number.isFinite(port) && port > 0 && port <= 65535) {
    updateConfig("port", port)
  }
}
</script>

<style scoped lang="scss">
@use "../styles/DialogFooter.scss";
</style>
