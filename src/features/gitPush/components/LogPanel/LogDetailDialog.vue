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
            <Button
              variant="ghost"
              size="xsmall"
              icon="close"
              :title="i18n.close"
              :aria-label="i18n.close"
              @click="$emit('close')"
            />
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
              <LogPlatformList
                :i18n="i18n"
                :platforms="entry.platforms!"
              />
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
            <Button
              variant="ghost"
              size="xsmall"
              :icon="copied ? 'check' : 'contentCopy'"
              :title="i18n.logCopyEntry"
              @click="handleCopy"
            >{{ i18n.logCopyEntry }}</Button>
            <div class="gp-grow" />
            <!-- 查看项目（主操作，点击跳转列表视图） -->
            <Button
              size="xsmall"
              variant="ghost"
              severity="primary"
              @click="handleViewProject"
            >{{ i18n.viewProject }}</Button>
            <!-- 关闭 -->
            <Button
              variant="ghost"
              size="xsmall"
              @click="$emit('close')"
            >{{ i18n.close }}</Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { GitOpLogEntry } from "../../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { useCopyFeedback } from "../../composables/useCopyFeedback"
import { formatLogEntryText, formatLogTime, hasLogPlatforms, logActionLabel } from "../../utils"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"
import LogPlatformList from "./LogPlatformList.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 当前选中的日志条目（null 时隐藏弹窗） */
  entry: GitOpLogEntry | null
}>()

const emit = defineEmits<{
  close: []
  viewProject: [projectId: string]
}>()

/** 复制成功反馈（2s 自动还原；定时器清理由 composable 承担） */
const { copied, notifyCopied } = useCopyFeedback()

/** 键盘聚焦辅助：entry 变为非空时自动聚焦根节点，使 Esc 关闭可被捕获 */
// ⚠️ `rootRef` 必须保留为本地绑定：模板 `ref="rootRef"` 依赖它把根节点交给 composable 聚焦。
// TS 看不到「模板里的使用」，故以 void 显式消费，避免 noUnusedLocals 误判（下同各弹窗）。
const { rootRef } = useDialogKeyboard(computed(() => !!props.entry))
void rootRef

/** 复制条目（文本构造走 utils.formatLogEntryText 单一真源，与表格行口径一致） */
async function handleCopy() {
  if (!props.entry) return
  const ok = await copyToClipboard(formatLogEntryText(props.entry))
  if (ok) notifyCopied()
}

/** 跳转列表视图（由 LogPanel 转发给主面板） */
function handleViewProject() {
  if (!props.entry) return
  emit("viewProject", props.entry.projectId)
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "@/variables.scss" as *;
@use "../../styles/mixins" as *;
@use "../../styles/LogDetailDialog.scss";
</style>
