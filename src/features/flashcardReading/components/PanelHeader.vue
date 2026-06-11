<template>
  <div class="panel-header-wrapper">
    <div class="panel-header">
      <h4 class="panel-title">
        <IconWrapper
          name="headphones"
          :size="18"
        />
        <span>{{ t.panelTitle }}</span>
      </h4>
      <div class="header-actions">
        <Button
          variant="ghost"
          size="small"
          icon="add"
          :title="t.addCard"
          @click="$emit('addCard')"
        />
        <Button
          variant="ghost"
          size="small"
          icon="refresh"
          :title="t.refresh"
          @click="$emit('refresh')"
        />
        <Button
          variant="ghost"
          size="small"
          icon="info"
          :title="storagePath"
          @click="copyPath"
        />
      </div>
    </div>
    <div class="panel-meta">
      <span class="panel-meta-key">STORE</span>
      <code class="panel-meta-val">{{ storagePath }}</code>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { I18n } from "../types"
import { showMessage } from "siyuan"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { useI18n } from "../composables/useI18n"
import { STORAGE_KEY } from "../types/storage"

const props = defineProps<{
  i18n: I18n
  plugin: Plugin
}>()

defineEmits<{
  addCard: []
  refresh: []
}>()

const t = useI18n(props.i18n)

const storagePath = computed(() => {
  const base = (props.plugin as any).getDataDir?.() || ""
  return base
    ? `${base.replace(/\/$/, "")}/${STORAGE_KEY}.json`
    : `storage/petal/siyuan-plugin-vite-vue-sn/${STORAGE_KEY}.json`
})

const copyPath = async () => {
  const ok = await copyToClipboard(storagePath.value)
  showMessage(ok ? "已复制存储路径" : "复制失败", 2000, ok ? "info" : "error")
}
</script>
