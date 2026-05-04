<template>
  <div class="panel-header">
    <h4 class="panel-title">
      <IconWrapper
        name="headphones"
        :size="20"
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
</template>

<script setup lang="ts">
import type { I18n } from "../types"
import { showMessage } from "siyuan"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

defineProps<{
  i18n: I18n
}>()

defineEmits<{
  addCard: []
  refresh: []
}>()

const storagePath = computed(() => {
  const base = (window as any).siyuan?.config?.system?.dataDir || ""
  const key = "flashcard-cards"
  return base
    ? `${base.replace(/\/$/, "")}/storage/petal/siyuan-plugin-vite-vue-sn/${key}.json`
    : `storage/petal/siyuan-plugin-vite-vue-sn/${key}.json`
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
