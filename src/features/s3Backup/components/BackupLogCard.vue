<!-- 备份日志列表卡片 — 显示操作记录，条目可展开查看结构化文件清单详情（上传/删除/失败分组）并复制 -->
<template>
  <section class="card-section">
    <div class="section-header">
      <!-- 卡片标题："操作日志" -->
      <h4>{{ i18n.backupLogs }}</h4>
      <Button
        v-if="logs.length > 0"
        variant="ghost"
        size="xsmall"
        @click="confirmClear"
      >
        <!-- 清空按钮："清空" -->
        {{ i18n.clearAll }}
      </Button>
    </div>
    <!-- 日志列表 -->
    <div v-if="logs.length > 0" class="log-list">
      <div
        v-for="log in logs"
        :key="log.id"
        class="log-item"
        :class="{ 'log-fail': !log.success }"
      >
        <!-- 头部行：类型徽章 / 文件名 / 元信息 / 状态徽章 / 消息预览 / 展开箭头 -->
        <div
          class="log-row"
          :class="{ 'log-row-expandable': hasDetail(log) }"
          @click="hasDetail(log) && toggleExpand(log.id)"
        >
          <!-- 类型徽章（i18n："压缩/上传/下载/删除/增量/自动"） -->
          <span class="log-type" :class="`log-type-${log.type}`">{{ typeLabel(log.type) }}</span>
          <span class="log-filename">{{ log.fileName }}</span>
          <span class="log-meta">
            <span v-if="log.fileSize" class="log-size">{{ formatFileSize(log.fileSize) }}</span>
            <span class="log-sep" v-if="log.fileSize">·</span>
            <span class="log-time">{{ formatTime(log.time) }}</span>
            <span v-if="log.hostname" class="log-sep">·</span>
            <span v-if="log.hostname" class="log-hostname">{{ log.hostname }}</span>
          </span>
          <span
            class="log-status"
            :class="log.success ? 'status-ok' : 'status-fail'"
          >
            <!-- 状态徽章："成功" / "失败" -->
            {{ log.success ? i18n.success : i18n.failed }}
          </span>
          <!-- 消息预览（单行省略，悬停可见全文，展开详情区可见完整内容） -->
          <span v-if="log.message" class="log-msg" :title="log.message">{{ log.message }}</span>
          <!-- 展开/收起箭头 -->
          <span v-if="hasDetail(log)" class="log-chevron" :class="{ 'log-chevron-open': expandedIds.has(log.id) }">
            <IconWrapper name="chevronRight" :size="10" />
          </span>
        </div>
        <!-- 详情区（v-if 懒渲染，防止 200 条日志一次性生成大量 DOM） -->
        <div v-if="expandedIds.has(log.id)" class="log-detail">
          <div class="log-detail-toolbar">
            <Button
              variant="ghost"
              size="xsmall"
              @click.stop="copyDetail(log)"
            >
              <!-- 复制详情按钮："复制详情" -->
              {{ i18n.logCopyDetail }}
            </Button>
          </div>
          <!-- 结构化文件清单：按 上传/删除/失败 分组 -->
          <template v-if="log.detail">
            <div
              v-for="group in detailGroups(log)"
              :key="group.key"
              class="log-detail-group"
            >
              <!-- 分组标题（i18n："上传文件/删除文件/失败文件"）+ 总数 -->
              <div class="log-detail-title" :class="`log-detail-title-${group.key}`">
                {{ group.label }} ({{ group.files.length + group.omitted }})
              </div>
              <div class="log-detail-files">
                <div v-for="f in group.files" :key="f" class="log-detail-file">{{ f }}</div>
                <!-- 超出存储上限的省略提示："+N 更多" -->
                <div v-if="group.omitted > 0" class="log-detail-more">
                  {{ i18n.logMoreFiles.replace("{count}", String(group.omitted)) }}
                </div>
              </div>
            </div>
          </template>
          <!-- 旧日志（无结构化清单）：完整 message 折行显示 -->
          <div v-else-if="log.message" class="log-detail-message">{{ log.message }}</div>
        </div>
      </div>
    </div>
    <div v-else class="empty-state">
      <!-- 空状态："暂无操作记录" -->
      <p>{{ i18n.noLogs }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive } from "vue"
import { showMessage } from "siyuan"
import { formatFileSize, formatTime } from "@/utils/format"
import { copyToClipboard } from "@/utils/domUtils"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type { BackupLog } from "../types"

const props = defineProps<{
  logs: BackupLog[]
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  (e: "clear"): void
}>()

/** 已展开详情的日志 id 集合（状态组件内聚，父组件无感知） */
const expandedIds = reactive(new Set<string>())

function toggleExpand(id: string): void {
  if (expandedIds.has(id)) {
    expandedIds.delete(id)
  } else {
    expandedIds.add(id)
  }
}

/** 条目是否有可展开的详情（结构化清单或任意 message，旧日志兼容） */
function hasDetail(log: BackupLog): boolean {
  return Boolean(log.detail || log.message)
}

function confirmClear(): void {
  // 清空确认："确定要清空全部日志吗？"
  const confirmed = confirm(props.i18n.confirmClearLogs)
  if (!confirmed) { return }
  emit("clear")
}

/** 操作类型 → 徽章文案 i18n 键映射 */
const TYPE_LABEL_KEYS: Record<BackupLog["type"], string> = {
  localZip: "logTypeLocalZip",
  s3Upload: "logTypeS3Upload",
  s3Download: "logTypeS3Download",
  s3Delete: "logTypeS3Delete",
  s3Incremental: "logTypeS3Incremental",
  autoBackup: "logTypeAutoBackup",
}

function typeLabel(type: BackupLog["type"]): string {
  return props.i18n[TYPE_LABEL_KEYS[type]]
}

/** 详情区分组视图模型 */
interface DetailGroup {
  key: "uploaded" | "deleted" | "failed"
  label: string
  files: string[]
  omitted: number
}

/** 将 log.detail 转为有序分组列表（空组不产出） */
function detailGroups(log: BackupLog): DetailGroup[] {
  const d = log.detail
  if (!d) { return [] }
  const groups: DetailGroup[] = []
  if (d.uploaded?.length) {
    groups.push({ key: "uploaded", label: props.i18n.logUploadedFiles, files: d.uploaded, omitted: d.omitted?.uploaded ?? 0 })
  }
  if (d.deleted?.length) {
    groups.push({ key: "deleted", label: props.i18n.logDeletedFiles, files: d.deleted, omitted: d.omitted?.deleted ?? 0 })
  }
  if (d.failed?.length) {
    groups.push({ key: "failed", label: props.i18n.logFailedFiles, files: d.failed, omitted: d.omitted?.failed ?? 0 })
  }
  return groups
}

/** 复制详情：摘要 + 各分组清单的纯文本拼接 */
async function copyDetail(log: BackupLog): Promise<void> {
  const parts: string[] = []
  if (log.message) { parts.push(log.message) }
  for (const group of detailGroups(log)) {
    const omittedSuffix = group.omitted > 0 ? `\n+${group.omitted}` : ""
    parts.push(`${group.label}:\n${group.files.join("\n")}${omittedSuffix}`)
  }
  const ok = await copyToClipboard(parts.join("\n"))
  if (ok) {
    // 复制成功提示："已复制"
    showMessage(props.i18n.logCopied, 2000, "info")
  }
}
</script>

<style scoped lang="scss">
@use "../styles/BackupLogCard.scss";
@use "../styles/index.scss";
</style>
