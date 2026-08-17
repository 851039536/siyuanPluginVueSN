<!-- 操作日志面板 — 成功/失败徽章、相对时间、失败清单展开、清空需确认 -->
<template>
  <div
    class="fm-dialog-mask"
    @click.self="$emit('close')"
  >
    <div class="fm-dialog fm-log-panel">
      <!-- 弹窗标题："操作日志" -->
      <div class="fm-dialog-header">
        <span class="fm-dialog-title">{{ i18n.logTitle }}</span>
        <div class="fm-log-header-actions">
          <!-- 按钮："清空" -->
          <Button
            v-if="logs.length > 0"
            variant="ghost"
            size="xsmall"
            icon="eraser"
            :icon-size="14"
            :title="i18n.clearLogs"
            @click="handleClear"
          />
          <Button
            variant="ghost"
            size="xsmall"
            icon="close"
            :icon-size="14"
            @click="$emit('close')"
          />
        </div>
      </div>

      <div class="fm-dialog-body fm-log-body">
        <!-- 空态："暂无操作记录" -->
        <div
          v-if="logs.length === 0"
          class="fm-log-empty"
        >
          {{ i18n.noLogs }}
        </div>
        <div
          v-for="log in logs"
          :key="log.id"
          class="fm-log-item"
        >
          <div class="fm-log-line">
            <!-- 状态徽章：成功/失败 -->
            <span
              class="fm-log-badge"
              :class="log.success ? 'success' : 'error'"
            >{{ log.success ? i18n.logSucceed : i18n.logFailed }}</span>
            <span class="fm-log-action">{{ log.action }}</span>
            <span class="fm-log-name">{{ log.fileName }}</span>
            <span class="fm-log-time">{{ relativeTime(log.time) }}</span>
          </div>
          <!-- 附加消息 -->
          <div
            v-if="log.message"
            class="fm-log-message"
          >
            {{ log.message }}
          </div>
          <!-- 失败清单展开 -->
          <details
            v-if="log.detail?.failed?.length"
            class="fm-log-detail"
          >
            <!-- 展开标题："失败清单（N）" -->
            <summary>{{ i18n.failedList }} ({{ log.detail.failed.length }})</summary>
            <div
              v-for="(key, idx) in log.detail.failed"
              :key="idx"
              class="fm-log-detail-line"
            >
              {{ key }}
            </div>
            <!-- 省略提示："…另有 N 条未显示" -->
            <div
              v-if="log.detail.omitted"
              class="fm-log-detail-omitted"
            >
              {{ i18n.omittedPrefix }} {{ log.detail.omitted }}
            </div>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from "siyuan"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import { formatRelativeTime } from "@/utils/format"
import type { FileOpLog, S3FileManagerI18n } from "../types"
import { useEscClose } from "../composables/useEscClose"

const props = defineProps<{
  logs: FileOpLog[]
  i18n: S3FileManagerI18n
  /** 清空确认回调（由父组件统一确认框承载） */
  requestClearConfirm?: () => void
}>()

const emit = defineEmits<{
  clear: []
  close: []
}>()

// Esc 关闭面板
useEscClose(() => emit("close"))

function relativeTime(time: string): string {
  return formatRelativeTime(time) || time
}

const hasConfirmHost = computed(() => typeof props.requestClearConfirm === "function")

/** 清空确认（有父级确认框时委托父组件，否则回退原生确认） */
function handleClear(): void {
  if (hasConfirmHost.value && props.requestClearConfirm) {
    props.requestClearConfirm()
    return
  }
  if (!confirm(props.i18n.confirmClearLogs)) { return }
  emit("clear")
  showMessage(props.i18n.logsCleared, 2000, "info")
}
</script>

<style scoped lang="scss">
@use "../styles/FmLogPanel.scss";
@use "../styles/index.scss";
</style>
