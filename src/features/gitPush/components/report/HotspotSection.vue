<!-- gitPush 代码统计报告：代码热点分区（热点文件列表 + 热度分类汇总 + 优化建议） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："代码热点分析" + 文件数徽章（悬浮说明统计口径） -->
    <div class="gpr-section-title">
      {{ i18n.reportHeatTitle }}
      <!-- 文件数徽章（title 提示口径："分析范围内涉及的文件数（不含 .md 文档）"） -->
      <span
        class="gpr-section-count"
        :title="i18n.reportAnalyzedFilesTip"
      >{{ report.analyzedFiles }}</span>
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
            <!-- 热度徽章：仅热度值（颜色编码等级，悬浮提示等级名，去掉 /100 与等级文字避免三重冗余） -->
            <span
              class="gpr-heat-chip"
              :class="`gpr-heat-chip--${h.level}`"
              :title="i18n[HOTSPOT_LEVEL_META[h.level].labelKey]"
            >{{ h.heat }}</span>
            <!-- 文件路径（目录弱化 + 文件名强调，悬浮显示完整路径） -->
            <span
              class="gpr-hot-path"
              :title="h.path"
            >
              <span class="gpr-path-dir">{{ splitPath(h.path).dir }}</span>
              <span class="gpr-path-base">{{ splitPath(h.path).base }}</span>
            </span>
          </div>
          <!-- 指标行：修改次数 / 参与人数 / 代码行数 / 最后修改 -->
          <div class="gpr-hot-meta">
            <span>{{ i18n.reportModsCol }}: {{ h.modCount }}</span>
            <span>{{ i18n.reportAuthorsCol }}: {{ h.authorCount }}</span>
            <span>LOC: {{ h.loc ?? "-" }}</span>
            <span
              :title="h.lastModified"
            >{{ i18n.reportLastModifiedCol }}: {{ h.lastModified ? relativeTime(h.lastModified, i18n) : "-" }}</span>
          </div>
          <!-- 建议文案（按等级 i18n 键解析，如"考虑重构或拆分此文件"） -->
          <div
            v-if="h.adviceKey"
            class="gpr-hot-advice"
          >{{ i18n[h.adviceKey] }}</div>
        </div>
      </div>

      <!-- 统计摘要：四类热度汇总表（文件数 + 占比） -->
      <div class="gpr-subsection">
        <!-- 子区块标题："热度分布汇总" -->
        <div class="gpr-section-title">
          {{ i18n.reportHeatSummaryTitle }}
        </div>
        <div class="gpr-table-wrap">
          <!-- 表头：类别 / 文件数 / 占比 -->
          <div class="gpr-row gpr-row--head">
            <span class="gpr-cell gpr-cell--name">{{ i18n.reportCategoryCol }}</span>
            <span class="gpr-cell gpr-cell--num">{{ i18n.reportFilesCol }}</span>
            <span class="gpr-cell gpr-cell--pct">{{ i18n.reportPctCol }}</span>
          </div>
          <!-- 表体：四类热度等级行 -->
          <div
            v-for="s in report.hotspotSummary"
            :key="s.level"
            class="gpr-row"
          >
            <span class="gpr-cell gpr-cell--name">
              <!-- 等级色点 -->
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

      <!-- 优化建议（按热点分布 i18n 键解析，如"项目代码热点分布相对健康"） -->
      <div
        v-if="report.suggestionKey"
        class="gpr-suggestion"
      >
        <Icon
          icon="mdi:lightbulb-outline"
          height="12"
        />
        <span>{{ i18n[report.suggestionKey] }}</span>
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

/** 拆分文件路径为目录 + 文件名（dirname 弱化 / basename 强调，便于快速扫描定位文件） */
function splitPath(path: string): { dir: string, base: string } {
  const idx = path.lastIndexOf("/")
  if (idx < 0) {
    return { dir: "", base: path }
  }
  return { dir: path.slice(0, idx + 1), base: path.slice(idx + 1) }
}

defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 hotspots / hotspotSummary / suggestionKey） */
  report: CodeReportData
}>()
</script>

<style lang="scss">
@use "../../styles/HotspotSection.scss";
@use "../../styles/index.scss";
</style>
