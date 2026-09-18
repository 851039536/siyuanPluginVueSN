<!-- 操作日志面板 — 成功/失败徽章、相对时间、失败清单展开、清空需确认（外壳复用共享 Dialog） -->
<template>
  <Dialog
    :visible="true"
    size="large"
    :header="i18n.logTitle"
    :dismissable-mask="true"
    @update:visible="$emit('close')"
  >
    <template #header="{ headerId }">
      <span
        :id="headerId"
        class="fm-log-header"
      >{{ i18n.logTitle }}</span>
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
      </div>
    </template>

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
        <!-- 状态徽章：成功/失败（复用共享 Tag） -->
        <Tag
          :variant="log.success ? 'success' : 'danger'"
          size="xsmall"
        >
          {{ log.success ? i18n.logSucceed : i18n.logFailed }}
        </Tag>
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
      <!-- 失败清单展开（复用共享 Panel 的可折叠能力；默认收起，按需展开控制 DOM 量）
           头部经 header 插槽保留语义错误色，与原 <summary> 观感一致 -->
      <Panel
        v-if="log.detail?.failed?.length"
        class="fm-log-detail"
        toggleable
        :collapsed="!expandedIds.has(log.id)"
        :toggle-label="i18n.failedList"
        @update:collapsed="(collapsed) => toggleExpanded(log.id, collapsed)"
      >
        <template #header>
          <span class="fm-log-detail-title">{{ i18n.failedList }} ({{ log.detail.failed.length }})</span>
        </template>
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
      </Panel>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { reactive } from "vue"
import { formatRelativeTime } from "@/utils/format"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import Panel from "@/components/Panel.vue"
import Tag from "@/components/Tag.vue"
import type { FileOpLog, S3FileManagerI18n } from "../types"

const props = defineProps<{
  logs: FileOpLog[]
  i18n: S3FileManagerI18n
  /** 清空确认回调（由父组件统一确认框承载；调用方保证注入） */
  requestClearConfirm: () => void
}>()

defineEmits<{
  close: []
}>()

/** 已展开失败清单的日志 id 集合（默认全部收起，按需展开控制大目录下的 DOM 量） */
const expandedIds = reactive(new Set<string>())

function toggleExpanded(id: string, collapsed: boolean): void {
  if (collapsed) {
    expandedIds.delete(id)
  } else {
    expandedIds.add(id)
  }
}

function relativeTime(time: string): string {
  return formatRelativeTime(time) || time
}

/** 清空确认：统一委托父组件的共享确认框（不再回退原生 confirm） */
function handleClear(): void {
  props.requestClearConfirm()
}
</script>

<style scoped lang="scss">
@use "../styles/FmLogPanel.scss";
</style>
