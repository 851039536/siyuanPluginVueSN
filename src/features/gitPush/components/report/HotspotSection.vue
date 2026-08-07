<!-- gitPush 代码统计报告：代码热点分区（热点文件列表 + 热度分类汇总 + 优化建议） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："代码热点分析" + 文件数徽章 -->
    <div class="gpr-section-title">
      {{ i18n.reportHeatTitle }}
      <span class="gpr-section-count">{{ report.analyzedFiles }}</span>
    </div>

    <!-- 空状态：范围内无文件 -->
    <EmptyState
      v-if="report.hotspots.length === 0"
      icon="mdi:fire"
      :text="i18n.reportNoData"
    />

    <template v-else>
      <!-- 热点/温热文件列表（热度徽章 + 指标 + 建议） -->
      <div class="gpr-hot-list">
        <div
          v-for="h in report.hotspots"
          :key="h.path"
          class="gpr-hot-item"
        >
          <div class="gpr-hot-head">
            <!-- 热度徽章：热度值 + 等级 -->
            <span
              class="gpr-heat-chip"
              :class="`gpr-heat-chip--${h.level}`"
            >{{ h.heat }}/100 [{{ i18n[HOTSPOT_LEVEL_META[h.level].labelKey] }}]</span>
            <span
              class="gpr-cell gpr-cell--file"
              :title="h.path"
            >{{ h.path }}</span>
          </div>
          <div class="gpr-hot-meta">
            <span>{{ i18n.reportModsCol }}: {{ h.modCount }}</span>
            <span>{{ i18n.reportAuthorsCol }}: {{ h.authorCount }}</span>
            <span
              :title="h.lastModified"
            >{{ i18n.reportLastModifiedCol }}: {{ h.lastModified ? relativeTime(h.lastModified, i18n) : "-" }}</span>
          </div>
          <!-- 建议文案（按等级模板拼接） -->
          <div
            v-if="h.advice"
            class="gpr-hot-advice"
          >{{ h.advice }}</div>
        </div>
      </div>

      <!-- 统计摘要：四类热度汇总表（文件数 + 占比） -->
      <div class="gpr-subsection">
        <div class="gpr-section-title">
          {{ i18n.reportHeatSummaryTitle }}
        </div>
        <div class="gpr-table-wrap">
          <div class="gpr-row gpr-row--head">
            <span class="gpr-cell gpr-cell--name">{{ i18n.reportCategoryCol }}</span>
            <span class="gpr-cell gpr-cell--num">{{ i18n.reportFilesCol }}</span>
            <span class="gpr-cell gpr-cell--pct">{{ i18n.reportPctCol }}</span>
          </div>
          <div
            v-for="s in report.hotspotSummary"
            :key="s.level"
            class="gpr-row"
          >
            <span class="gpr-cell gpr-cell--name">
              <span
                class="gpr-heat-dot"
                :style="{ background: HOTSPOT_LEVEL_META[s.level].color }"
              />
              {{ i18n[HOTSPOT_LEVEL_META[s.level].labelKey] }}
            </span>
            <span class="gpr-cell gpr-cell--num">{{ s.count }}</span>
            <span class="gpr-cell gpr-cell--pct">{{ s.pct }}%</span>
          </div>
        </div>
      </div>

      <!-- 优化建议 -->
      <div
        v-if="report.suggestion"
        class="gpr-suggestion"
      >
        <Icon
          icon="mdi:lightbulb-outline"
          height="12"
        />
        <span>{{ report.suggestion }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// 代码热点分区：热点文件列表（热度/指标/建议）+ 四类汇总表 + 优化建议
import type { CodeReportData } from "../../types"
import { Icon } from "@iconify/vue"
import { HOTSPOT_LEVEL_META } from "../../types"
import { relativeTime } from "../../utils"
import EmptyState from "../common/EmptyState.vue"

defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 hotspots / hotspotSummary / suggestion） */
  report: CodeReportData
}>()
</script>

<style lang="scss">
@use "../../styles/HotspotSection.scss";
@use "../../styles/index.scss";
</style>
