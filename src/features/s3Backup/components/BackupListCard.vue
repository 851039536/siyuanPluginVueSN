<!-- 备份列表通用卡片组件 — 本地/S3 列表复用，泛型化约束展示项类型，通过具名插槽注入操作按钮 -->
<template>
  <section class="card-section">
    <!-- 卡片标题 + 刷新按钮 -->
    <div class="section-header">
      <h4>{{ title }}</h4>
      <!-- 按钮："刷新" -->
      <Button
        variant="ghost"
        size="xsmall"
        :disabled="disableRefresh"
        @click="$emit('refresh')"
      >
        {{ i18n.refresh }}
      </Button>
    </div>
    <!-- 备份条目列表 -->
    <div v-if="items.length > 0" class="backup-list">
      <div v-for="item in items" :key="item.name" class="backup-item">
        <div class="backup-info">
          <!-- 备份文件名 -->
          <span class="backup-name">{{ item.name }}</span>
          <!-- 备份时间 -->
          <span class="backup-time">{{ formatTime(item.time ?? item.lastModified ?? "") }}</span>
          <span class="backup-sep">·</span>
          <!-- 备份文件大小 -->
          <span class="backup-size">{{ formatFileSize(item.size) }}</span>
          <!-- 来源设备名（S3 列表用，本地列表不传 hostMap） -->
          <template v-if="hostMap?.[item.name]">
            <span class="backup-sep">·</span>
            <span class="backup-host">{{ hostMap[item.name] }}</span>
          </template>
        </div>
        <!-- 操作按钮区（具名插槽） -->
        <div class="backup-actions">
          <slot name="actions" :item="item" />
        </div>
      </div>
    </div>
    <!-- 空状态提示 -->
    <div v-else class="empty-state">
      <p>{{ emptyText }}</p>
    </div>
  </section>
</template>

<script setup lang="ts" generic="T extends BackupListDisplayItem">
import { formatFileSize, formatTime } from "@/utils/format"
import type { BackupListDisplayItem } from "../types"
import Button from "@/components/Button.vue"

defineProps<{
  title: string
  emptyText: string
  items: T[]
  disableRefresh: boolean
  i18n: Record<string, string>
  hostMap?: Record<string, string>
}>()

defineEmits<{
  (e: "refresh"): void
}>()
</script>

<style scoped lang="scss">
@use "../styles/BackupListCard.scss";
@use "../styles/index.scss";
</style>
