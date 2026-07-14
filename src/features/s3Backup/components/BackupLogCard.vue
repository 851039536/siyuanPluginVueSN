<!-- 备份日志列表卡片 — 显示最近的压缩/上传/下载/删除操作记录 -->
<template>
  <section class="card-section">
    <div class="section-header">
      <h4>{{ i18n.backupLogs || "操作日志" }}</h4>
      <Button
        v-if="logs.length > 0"
        variant="ghost"
        size="xsmall"
        @click="$emit('clear')"
      >
        {{ i18n.clearAll || "清空" }}
      </Button>
    </div>
    <div v-if="logs.length > 0" class="log-list">
      <div
        v-for="log in logs"
        :key="log.id"
        class="log-item"
        :class="{ 'log-fail': !log.success }"
      >
        <span class="log-type" :class="`log-type-${log.type}`">{{ typeLabel(log.type) }}</span>
        <span class="log-filename">{{ log.fileName }}</span>
        <span class="log-meta">
          <span v-if="log.fileSize" class="log-size">{{ formatFileSize(log.fileSize) }}</span>
          <span class="log-sep" v-if="log.fileSize && log.fileSize">·</span>
          <span class="log-time">{{ formatTime(log.time) }}</span>
        </span>
        <span
          class="log-status"
          :class="log.success ? 'status-ok' : 'status-fail'"
        >
          {{ log.success ? (i18n.success || "成功") : (i18n.failed || "失败") }}
        </span>
        <span v-if="log.message" class="log-msg">{{ log.message }}</span>
      </div>
    </div>
    <div v-else class="empty-state">
      <p>{{ i18n.noLogs || "暂无操作记录" }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { formatFileSize, formatTime } from "@/utils/format"
import Button from "@/components/Button.vue"
import type { BackupLog } from "../types"

defineProps<{
  logs: BackupLog[]
  i18n: Record<string, string>
}>()

defineEmits<{
  (e: "clear"): void
}>()

function typeLabel(type: BackupLog["type"]): string {
  const map: Record<string, string> = {
    localZip: "压缩",
    s3Upload: "上传",
    s3Download: "下载",
    s3Delete: "删除",
  }
  return map[type] || type
}
</script>

<style scoped lang="scss">
@use "../styles/BackupLogCard.scss";
@use "../styles/index.scss";
</style>
