<!-- 脚本启动器 - 内置监听运行监控区 -->
<template>
  <section
    v-if="settingsEnabled"
    class="sc-monitor"
  >
    <header class="sc-monitor__header">
      <button
        class="sc-monitor__toggle"
        type="button"
        :title="expanded ? i18n.monitorCollapse : i18n.monitorExpand"
        @click="toggleExpanded"
      >
        <IconWrapper
          :name="expanded ? 'chevronDown' : 'chevronRight'"
          :size="14"
        />
        <span class="sc-monitor__title">
          {{ i18n.monitorTitle || "运行监控" }}
        </span>
        <Badge
          :variant="runningCount > 0 ? 'success' : 'default'"
          size="xsmall"
        >
          {{ runningCountLabel }}
        </Badge>
        <span
          v-if="expanded && runningCount > 0"
          class="sc-monitor__hint"
        >
          {{ i18n.windowHiddenHint || "控制台已隐藏" }}
        </span>
      </button>

      <div
        v-if="expanded"
        class="sc-monitor__actions"
      >
        <Button
          v-if="runningCount > 0"
          variant="danger"
          size="xsmall"
          icon="stop"
          :title="i18n.stopProcess || '停止'"
          @click="handleStopAll"
        />
        <Button
          variant="ghost"
          size="xsmall"
          icon="refresh"
          :title="i18n.clearOutput || '清空输出'"
          @click="handleClearAll"
        />
      </div>
    </header>

    <div
      v-if="expanded"
      class="sc-monitor__body"
    >
      <div
        v-if="processes.length === 0"
        class="sc-monitor__empty"
      >
        {{ i18n.emptyMonitor || "暂无运行中的脚本" }}
      </div>

      <div
        v-for="proc in processes"
        :key="proc.id"
        class="sc-monitor__item"
        :class="`sc-monitor__item--${proc.status}`"
      >
        <div class="sc-monitor__item-head">
          <span
            class="sc-monitor__dot"
            :class="`sc-monitor__dot--${proc.status}`"
          />
          <span class="sc-monitor__item-name">{{ proc.name }}</span>
          <Badge
            :variant="statusVariant(proc.status)"
            size="xsmall"
          >
            {{ statusLabel(proc.status) }}
          </Badge>
          <Badge
            v-if="proc.persisted"
            variant="warning"
            size="xsmall"
          >
            {{ i18n.restoredProcess || "上次遗留" }}
          </Badge>
          <span class="sc-monitor__item-meta">
            {{ formatTime(proc.startedAt) }}
            <template v-if="proc.finishedAt">
              · {{ formatTime(proc.finishedAt) }}
            </template>
          </span>
        </div>

        <p
          v-if="proc.description"
          class="sc-monitor__item-desc"
        >
          {{ proc.description }}
        </p>
        <p class="sc-monitor__item-cmd">
          {{ proc.command }}
        </p>

        <pre
          v-if="proc.stdout"
          class="sc-monitor__output"
        >{{ proc.stdout }}</pre>
        <pre
          v-if="proc.stderr"
          class="sc-monitor__output sc-monitor__output--err"
        >{{ proc.stderr }}</pre>
        <p
          v-if="!proc.stdout && !proc.stderr"
          class="sc-monitor__no-output"
        >
          {{ i18n.noProcessOutput || "（暂无输出）" }}
        </p>
        <p
          v-if="proc.status !== 'running' && proc.exitCode !== undefined && proc.exitCode !== null"
          class="sc-monitor__exit"
        >
          {{ i18n.exitCode || "退出码" }}: {{ proc.exitCode }}
        </p>

        <div class="sc-monitor__item-actions">
          <Button
            v-if="proc.status === 'running'"
            variant="danger"
            size="xsmall"
            icon="stop"
            @click="handleStop(proc.id)"
          >
            {{ i18n.stopProcess || "停止" }}
          </Button>
          <Button
            variant="ghost"
            size="xsmall"
            icon="close"
            @click="handleDismiss(proc.id)"
          >
            {{ i18n.close || "关闭" }}
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RunningProcess } from "../types"
import type { I18n } from "../types/index"
import { computed } from "vue"
import Badge from "@/components/Badge.vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  processes: RunningProcess[]
  expanded: boolean
  settingsEnabled: boolean
  i18n: I18n
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggle: []
  stop: [id: string]
  stopAll: []
  clearAll: []
  dismiss: [id: string]
}>()

const runningCount = computed(() => props.processes.filter((p) => p.status === "running").length)

const runningCountLabel = computed(() =>
  props.processes.length > 0 ? String(props.processes.length) : "0",
)

function statusLabel(status: RunningProcess["status"]): string {
  return {
    running: "运行中",
    exited: "已结束",
    killed: "已停止",
    error: "错误",
  }[status] || status
}

function statusVariant(status: RunningProcess["status"]): "success" | "warning" | "danger" | "info" | "default" {
  if (status === "running") return "success"
  if (status === "error") return "danger"
  if (status === "killed") return "warning"
  return "default"
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

function toggleExpanded() {
  emit("toggle")
}

function handleStop(id: string) {
  emit("stop", id)
}

function handleStopAll() {
  emit("stopAll")
}

function handleClearAll() {
  emit("clearAll")
}

function handleDismiss(id: string) {
  emit("dismiss", id)
}
</script>

<style lang="scss" scoped>
@use "../styles/RunningMonitor.scss";
</style>
