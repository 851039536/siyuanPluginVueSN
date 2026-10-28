<!-- 缓存清理历史：累计统计行 + 最近记录折叠列表（纯展示，数据由 useCleanHistory 提供） -->
<template>
  <div class="cc-history">
    <!-- 累计统计行 -->
    <div
      v-if="stats && stats.count > 0"
      class="cc-history__stats"
    >{{ statsText }}</div>

    <!-- 最近记录列表（默认折叠，用户可展开） -->
    <Panel
      :header="i18n.cacheHistoryTitle"
      toggleable
      v-model:collapsed="listCollapsed"
    >
      <div
        v-if="records.length === 0"
        class="cc-history__empty"
      >{{ i18n.cacheHistoryEmpty }}</div>
      <ul
        v-else
        class="cc-history__list"
      >
        <li
          v-for="record in records"
          :key="record.cleanedAt"
          class="cc-history__row"
        >
          <span class="cc-history__time">{{ formatModifiedTime(record.cleanedAt) }}</span>
          <!-- 清理方式："移入回收站" / "永久删除" -->
          <span class="cc-history__mode">{{ modeLabel(record.mode) }}</span>
          <span class="cc-history__count">{{ record.entries }}</span>
          <span class="cc-history__size">{{ formatSize(record.freed) }}</span>
          <span
            v-if="record.failed > 0"
            class="cc-history__failed"
          >{{ failedText(record.failed) }}</span>
        </li>
      </ul>
    </Panel>
  </div>
</template>

<script setup lang="ts">
import type {
  CleanHistoryRecord,
  CleanHistoryStats,
} from "../../types"
import Panel from "@/components/Panel.vue"
import { computed, ref } from "vue"
import {
  fillTemplate,
  formatModifiedTime,
  formatSize,
} from "./format"

interface Props {
  /** 累计统计（null = 存储未就绪，整节由父层隐藏） */
  stats: CleanHistoryStats | null
  /** 最近清理记录（时间降序，条数由 composable 侧限制） */
  records: CleanHistoryRecord[]
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

const props = defineProps<Props>()

/** 列表折叠态（本地自持，默认收起避免占用面板空间） */
const listCollapsed = ref(true)

/** 累计统计文案："累计清理 N 次 · X 个条目 · 释放 Y" */
const statsText = computed(() => {
  if (!props.stats) return ""
  return fillTemplate(props.i18n.cacheStatsTotal, {
    count: props.stats.count,
    entries: props.stats.entries,
    size: formatSize(props.stats.freed),
  })
})

/** 清理方式文案（复用偏好设置区的既有键） */
const modeLabel = (mode: CleanHistoryRecord["mode"]): string =>
  mode === "permanent" ? props.i18n.cacheModePermanent : props.i18n.cacheModeRecycle

/** 失败条目后缀："N 项失败" */
const failedText = (failed: number): string =>
  fillTemplate(props.i18n.cacheHistoryItemFailed, { failed })
</script>

<style scoped lang="scss">
@use "../../styles/CacheCleanHistory.scss";
</style>
