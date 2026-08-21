<!-- gitPush 操作日志详情弹窗：展示完整摘要、逐平台结果与元信息 -->
<template>
  <Teleport to="body">
    <Transition name="gp-dialog-fade">
      <div
        v-if="entry"
        ref="rootRef"
        tabindex="-1"
        class="gp-logd-overlay"
        @keydown.escape="$emit('close')"
        @click.self="$emit('close')"
      >
        <div class="gp-logd-dialog">
          <!-- 头部：徽章 + 项目名 + 状态 + 关闭 -->
          <div class="gp-logd-header">
            <div class="gp-logd-title">
              <!-- 操作类型徽章（"推送"/"拉取"/"提交"） -->
              <span
                class="gp-logd-badge"
                :class="`gp-logd-badge--${entry.action}`"
              >{{ logActionLabel(entry.action, i18n) }}</span>
              <!-- 项目名（点击跳转列表视图） -->
              <span
              class="gp-logd-project"
              :title="i18n.viewProject"
              @click="handleViewProject"
              >{{ entry.projectName }}</span>
              <!-- 整体状态徽章（"成功"/"失败"） -->
              <span
                class="gp-logd-status"
                :class="entry.ok ? 'gp-logd-status--ok' : 'gp-logd-status--fail'"
              >{{ entry.ok ? i18n.logStatusSuccess : i18n.logStatusFailed }}</span>
            </div>
            <!-- 关闭按钮（tooltip："关闭"） -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :title="i18n.close"
              @click="$emit('close')"
            >
              <Icon
                icon="mdi:close"
                height="12"
              />
            </button>
          </div>

          <!-- 内容区 -->
          <div class="gp-logd-body">
            <!-- 元信息区（操作类型 / 时间 / 状态） -->
            <div class="gp-logd-meta">
              <!-- "操作类型" -->
              <div class="gp-logd-meta-item">
                <span class="gp-logd-meta-label">{{ i18n.logDetailAction }}</span>
                <span class="gp-logd-meta-value">{{ logActionLabel(entry.action, i18n) }}</span>
              </div>
              <!-- "时间" -->
              <div class="gp-logd-meta-item">
                <span class="gp-logd-meta-label">{{ i18n.logDetailTime }}</span>
                <span class="gp-logd-meta-value">{{ formatLogTime(entry.time) }}</span>
              </div>
              <!-- "状态" -->
              <div class="gp-logd-meta-item">
                <span class="gp-logd-meta-label">{{ i18n.logDetailStatus }}</span>
                <span
                  class="gp-logd-meta-value"
                  :class="entry.ok ? 'gp-logd-text-ok' : 'gp-logd-text-fail'"
                >{{ entry.ok ? i18n.logStatusSuccess : i18n.logStatusFailed }}</span>
              </div>
            </div>

            <!-- 摘要区："摘要"（完整展示，可换行） -->
            <div class="gp-logd-section">
              <div class="gp-logd-section-title">{{ i18n.logDetailSummary }}</div>
              <div class="gp-logd-summary">{{ entry.summary }}</div>
            </div>

            <!-- 平台明细区（push/pull）："平台明细" -->
            <div
              v-if="hasLogPlatforms(entry)"
              class="gp-logd-section"
            >
              <div class="gp-logd-section-title">{{ i18n.logDetailPlatforms }}</div>
              <div class="gp-logd-platforms">
                <div
                  v-for="p in entry.platforms!"
                  :key="p.key"
                  class="gp-logd-platform"
                >
                  <span
                    class="gp-logd-platform-ok"
                    :class="p.ok ? 'gp-logd-text-ok' : p.skipped ? 'gp-logd-text-skip' : 'gp-logd-text-fail'"
                  >{{ p.ok ? '✓' : p.skipped ? '—' : '✗' }}</span>
                  <span class="gp-logd-platform-label">{{ p.label }}</span>
                  <span
                    v-if="p.skipped"
                    class="gp-logd-platform-skip"
                  >{{ i18n.opSkipped }}</span>
                  <span class="gp-logd-platform-summary">{{ p.summary }}</span>
                </div>
              </div>
            </div>

            <!-- 提交信息区（commit）："提交信息"（完整 message） -->
            <div
              v-if="entry.action === 'commit' && entry.message"
              class="gp-logd-section"
            >
              <div class="gp-logd-section-title">{{ i18n.logDetailCommitMsg }}</div>
              <div class="gp-logd-message">{{ entry.message }}</div>
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div class="gp-logd-footer">
            <!-- 复制条目（tooltip："复制条目"，成功后勾选 2s） -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :title="i18n.logCopyEntry"
              @click="handleCopy"
            >
              <Icon
                :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
                height="12"
              />
              <span>{{ i18n.logCopyEntry }}</span>
            </button>
            <div class="gp-grow" />
            <!-- 查看项目（主操作，点击跳转列表视图） -->
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              @click="handleViewProject"
            >
              <span>{{ i18n.viewProject }}</span>
            </button>
            <!-- 关闭 -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              @click="$emit('close')"
            >
              <span>{{ i18n.close }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { GitOpLogEntry } from "../../types"
import { Icon } from "@iconify/vue"
import {
  computed,
  onUnmounted,
  ref,
} from "vue"
import { copyToClipboard } from "@/utils/domUtils"
import { formatLogTime, hasLogPlatforms, logActionLabel } from "../../utils"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"

const props = defineProps<{
  i18n: Record<string, any>
  /** 当前选中的日志条目（null 时隐藏弹窗） */
  entry: GitOpLogEntry | null
}>()

const emit = defineEmits<{
  close: []
  viewProject: [projectId: string]
}>()

/** 复制反馈（成功 2s 后还原） */
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

/** 键盘聚焦辅助：entry 变为非空时自动聚焦根节点，使 Esc 关闭可被捕获 */
const { rootRef } = useDialogKeyboard(computed(() => !!props.entry))

/** 复制条目（commit 含完整提交信息，其余为 "[时间] 项目名 — 摘要"） */
async function handleCopy() {
  if (!props.entry) return
  const text = props.entry.message
    ? `[${formatLogTime(props.entry.time)}] ${props.entry.projectName}\n${props.entry.message}`
    : `[${formatLogTime(props.entry.time)}] ${props.entry.projectName} — ${props.entry.summary}`
  const ok = await copyToClipboard(text)
  if (ok) {
    if (copiedTimer) clearTimeout(copiedTimer)
    copied.value = true
    copiedTimer = setTimeout(() => { copied.value = false }, 2000)
  }
}

/** 跳转列表视图（由 LogPanel 转发给主面板） */
function handleViewProject() {
  if (!props.entry) return
  emit("viewProject", props.entry.projectId)
}

onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "@/variables.scss" as *;
@use "../../styles/mixins" as *;
@use "../../styles/LogDetailDialog.scss";
</style>
