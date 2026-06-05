<template>
  <div class="panel-header-wrapper">
    <div class="panel-header">
      <h4 class="panel-title">
        <IconWrapper
          name="headphones"
          :size="18"
        />
        <span>{{ i18n.panelTitle || '单词阅读' }}</span>
      </h4>
      <div class="header-actions">
        <Button
          variant="ghost"
          size="small"
          icon="add"
          :title="i18n.addCard || '添加卡片'"
          @click="$emit('addCard')"
        />
        <Button
          variant="ghost"
          size="small"
          icon="refresh"
          :title="i18n.refresh || '刷新'"
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

const props = defineProps<{
  i18n: I18n
  plugin: Plugin
}>()

defineEmits<{
  addCard: []
  refresh: []
}>()

const STORAGE_KEY = "flashcard-cards"

const storagePath = computed(() => {
  const base = (props.plugin as any).getDataDir?.() || ""
  return base
    ? `${base.replace(/\/$/, "")}/${STORAGE_KEY}.json`
    : `storage/petal/siyuan-plugin-vite-vue-sn/${STORAGE_KEY}.json`
})

const copyPath = async () => {
  try {
    await navigator.clipboard.writeText(storagePath.value)
    showMessage("已复制存储路径", 2000, "info")
  } catch {
    showMessage("复制失败", 2000, "error")
  }
}
</script>
