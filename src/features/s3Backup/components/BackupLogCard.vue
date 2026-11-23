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
          :class="{ 'log-row-expandable': expandableIds.has(log.id) }"
          @click="expandableIds.has(log.id) && toggleExpand(log.id)"
        >
          <!-- 类型徽章（i18n："压缩/上传/下载/删除/增量/自动"） -->
          <Tag class="log-type" :variant="TYPE_VARIANTS[log.type]" size="xsmall">
            {{ typeLabel(log.type) }}
          </Tag>
          <span class="log-filename">{{ log.fileName }}</span>
          <span class="log-meta">
            <span v-if="log.fileSize" class="log-size">{{ formatFileSize(log.fileSize) }}</span>
            <span v-if="log.fileSize" class="log-sep">·</span>
            <span class="log-time">{{ formatTime(log.time) }}</span>
            <!-- 相对时间（如"5分钟前"） -->
            <span class="log-relative">{{ formatRelativeTime(log.time) }}</span>
            <span v-if="log.hostname" class="log-sep">·</span>
            <span v-if="log.hostname" class="log-hostname">{{ log.hostname }}</span>
          </span>
          <Tag
            class="log-status"
            :variant="log.success ? 'success' : 'danger'"
            size="xsmall"
          >
            <!-- 状态徽章："成功" / "失败" -->
            {{ log.success ? i18n.success : i18n.failed }}
          </Tag>
          <!-- 消息预览（单行省略，悬停可见全文，展开详情区可见完整内容） -->
          <span v-if="log.message" class="log-msg" :title="log.message">{{ log.message }}</span>
          <!-- 展开/收起箭头 -->
          <span v-if="expandableIds.has(log.id)" class="log-chevron" :class="{ 'log-chevron-open': expandedIds.has(log.id) }">
            <IconWrapper name="chevronRight" :size="10" />
          </span>
        </div>
        <!-- 详情区（v-if 懒渲染，防止 200 条日志一次性生成大量 DOM） -->
        <div v-if="expandedIds.has(log.id)" class="log-detail">
          <div class="log-detail-toolbar">
            <Button
              variant="ghost"
              size="xsmall"
              @click.stop="copyMessage(log)"
            >
              <!-- 复制详情按钮："复制详情" -->
              {{ i18n.logCopyDetail }}
            </Button>
          </div>
          <!-- 完整 message 折行显示（列表行内为单行省略） -->
          <div v-if="log.message" class="log-detail-message">{{ log.message }}</div>
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
import { computed, reactive, watch } from "vue"
import { showMessage } from "siyuan"
import { formatFileSize, formatRelativeTime, formatTime } from "@/utils/format"
import { copyToClipboard } from "@/utils/domUtils"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Tag from "@/components/Tag.vue"
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

/** 条目是否有可展开的详情（有 message 即可展开查看完整内容） */
function isExpandable(log: BackupLog): boolean {
  return Boolean(log.message)
}

/** 可展开日志 id 集合（一次遍历产出，避免模板内每条日志重复调用 isExpandable） */
const expandableIds = computed(() => new Set(props.logs.filter(isExpandable).map((log) => log.id)))

// 日志被截断/清空时剔除已不存在的 id，避免展开集合随会话无界增长（长期运行的内存泄漏）
watch(() => props.logs, (logs) => {
  if (expandedIds.size === 0) { return }
  const alive = new Set(logs.map((log) => log.id))
  for (const id of expandedIds) {
    if (!alive.has(id)) { expandedIds.delete(id) }
  }
})

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
  autoBackup: "logTypeAutoBackup",
}

function typeLabel(type: BackupLog["type"]): string {
  return props.i18n[TYPE_LABEL_KEYS[type]]
}

/** 操作类型 → 共享 Tag 配色（5 种类型全覆盖，避免出现无配色的裸徽章） */
const TYPE_VARIANTS = {
  localZip: "primary",
  s3Upload: "info",
  s3Download: "info",
  s3Delete: "danger",
  autoBackup: "default",
} as const

/** 复制日志详情（完整 message） */
async function copyMessage(log: BackupLog): Promise<void> {
  const ok = await copyToClipboard(log.message ?? "")
  if (ok) {
    // 复制成功提示："已复制"
    showMessage(props.i18n.logCopied, 2000, "info")
  }
}
</script>

<style scoped lang="scss">
@use "../styles/BackupLogCard.scss";
@use "../styles/cards.scss";
</style>
