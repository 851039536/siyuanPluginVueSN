<!-- 备份列表通用卡片组件 — 本地/S3 列表复用，通过具名插槽注入操作按钮 -->
<template>
  <section class="card-section">
    <div class="section-header">
      <h4>{{ title }}</h4>
      <Button
        variant="ghost"
        size="xsmall"
        :disabled="disableRefresh"
        @click="$emit('refresh')"
      >
        {{ i18n.refresh || "刷新" }}
      </Button>
    </div>
    <div v-if="items.length > 0" class="backup-list">
      <div v-for="(item, index) in items" :key="index" class="backup-item">
        <div class="backup-info">
          <span class="backup-name">{{ item.name }}</span>
          <span class="backup-time">{{ item[timeKey] }}</span>
          <span class="backup-size">{{ formatFileSize(item.size) }}</span>
        </div>
        <div class="backup-actions">
          <slot name="actions" :item="item" />
        </div>
      </div>
    </div>
    <div v-else class="empty-state">
      <p>{{ emptyText }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { formatFileSize } from "@/utils/format"
import Button from "@/components/Button.vue"

withDefaults(defineProps<{
  title: string
  emptyText: string
  items: Record<string, any>[]
  timeKey?: string
  disableRefresh: boolean
  i18n: Record<string, string>
}>(), {
  timeKey: "time",
})

defineEmits<{
  (e: "refresh"): void
}>()
</script>

<style scoped lang="scss">
@use "../styles/BackupListCard.scss";
@use "../styles/index.scss";
</style>
