<!-- gitPush 代码统计报告：提交节奏迷你图（星期分布 7 柱 + 时段热力条 + streak/peak 徽章） -->
<template>
  <div class="gpc-rhythm">
    <!-- 星期分布卡片 -->
    <div class="gpc-rhythm-card">
      <!-- 卡片标题："星期分布" + 最长连续提交徽章（悬浮说明统计口径） -->
      <div class="gpc-rhythm-title">
        {{ i18n.reportWeekdayTitle }}
        <span
          class="gpc-rhythm-badge"
          :title="i18n.reportStreakTip"
        >{{ i18n.reportStreak }}: {{ rhythm.maxStreak }}</span>
      </div>
      <!-- 7 根迷你柱（高度按提交数占比，最活跃星期高亮主题色） -->
      <div class="gpc-weekdays">
        <div
          v-for="w in weekdayBars"
          :key="w.dow"
          class="gpc-weekday"
          :title="`${w.label}: ${w.count}`"
        >
          <div class="gpc-weekday-track">
            <div
              class="gpc-weekday-bar"
              :class="{ 'gpc-weekday-bar--peak': w.isPeak }"
              :style="{ height: w.heightPct + '%' }"
            />
          </div>
          <span class="gpc-weekday-label">{{ w.label }}</span>
          <span class="gpc-weekday-count">{{ w.count }}</span>
        </div>
      </div>
    </div>

    <!-- 时段热力卡片 -->
    <div class="gpc-rhythm-card">
      <!-- 卡片标题："时段分布" + 高峰时段徽章 -->
      <div class="gpc-rhythm-title">
        {{ i18n.reportHourlyTitle }}
        <span class="gpc-rhythm-badge gpc-rhythm-badge--accent">
          {{ i18n.reportPeakHours }}: {{ peakHoursText }}
        </span>
      </div>
      <!-- 24h 热力色条（每格 2 小时，颜色深浅=提交频率，hover 显示具体时段；当前小时格描边定位） -->
      <div class="gpc-hourly">
        <div
          v-for="h in hourlyHeat"
          :key="h.start"
          class="gpc-hour-cell"
          :class="{ 'gpc-hour-cell--peak': h.isPeak, 'gpc-hour-cell--now': h.isNow }"
          :style="{ background: h.color }"
          :title="`${h.startLabel}-${h.endLabel}: ${h.count}`"
        />
      </div>
      <!-- 时间轴刻度（0/6/12/18/24 时） -->
      <div class="gpc-hourly-scale">
        <span>0</span><span>6</span><span>12</span><span>18</span><span>24</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 提交节奏迷你图：星期分布（7 根柱）+ 时段热力条（24h 色块）+ streak/peak 徽章
// （从 CandlestickSection.vue 拆出：与 K 线渲染无关的独立子面板）
import { computed } from "vue"
import type { CommitRhythmStats } from "../../types/report"
import { WEEKDAY_LABEL_KEYS } from "../../types/report"
import { formatHour } from "../../reportChart"
import { maxOf } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 提交节奏聚合（weekday/hourly/topWeekday/peakHours/maxStreak） */
  rhythm: CommitRhythmStats
}>()

/** 星期迷你柱（7 根，高度按该周提交数占比；isPeak 标记最活跃星期） */
const weekdayBars = computed(() => {
  const rhythm = props.rhythm
  const max = maxOf(rhythm.weekday.map((w) => w.count), 1)
  return rhythm.weekday.map((w) => ({
    dow: w.dow,
    count: w.count,
    label: props.i18n[WEEKDAY_LABEL_KEYS[w.dow]] ?? "",
    // 高度与数值严格成正比：零值星期 0%（仅保留 2px 基线），非零值至少 4% 保证可见
    heightPct: w.count === 0 ? 0 : Math.max(4, Math.round((w.count / max) * 100)),
    isPeak: w.dow === rhythm.topWeekday.dow && rhythm.topWeekday.count > 0,
  }))
})

/** 时段热力格（12 格，每格 2 小时；颜色透明度按提交频率，isPeak 标记高峰桶，isNow 标记当前小时所在桶） */
const hourlyHeat = computed(() => {
  const rhythm = props.rhythm
  const max = maxOf(rhythm.hourly.map((h) => h.count), 1)
  const nowHour = new Date().getHours()
  return rhythm.hourly.map((h) => ({
    start: h.start,
    count: h.count,
    startLabel: formatHour(h.start),
    endLabel: formatHour(h.end),
    color: h.count === 0 ? "transparent" : `rgba(16, 185, 129, ${0.12 + 0.88 * (h.count / max)})`,
    isPeak: h.start === rhythm.peakHours.start && rhythm.peakHours.count > 0,
    isNow: nowHour >= h.start && nowHour < h.end,
  }))
})

/** 高峰时段文本（如 "14:00-16:00"） */
const peakHoursText = computed(() => {
  const p = props.rhythm.peakHours
  return `${formatHour(p.start)}-${formatHour(p.end)}`
})

/** 供父组件摘要卡片复用的高峰时段文本（与卡片渲染同一口径） */
defineExpose({ peakHoursText })
</script>

<style lang="scss">
@use "../../styles/RhythmSection.scss";
@use "../../styles/index.scss";
</style>
