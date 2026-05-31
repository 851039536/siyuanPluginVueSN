<template>
  <div class="heatmap-card">
    <div class="card-header">
      <span class="card-title">{{ i18n.activityHeatmap }}</span>
      <span class="header-summary">{{ i18n.last30Days }}: {{ activeDaysInMonth }} {{ i18n.activeDaysCount }}</span>
    </div>
    <div class="card-body">
      <div class="heatmap-scroll">
        <div class="heatmap-grid">
          <div
            v-for="(cell, idx) in heatmapCells"
            :key="idx"
            :class="cell.level"
            :title="cell.tooltip"
          ></div>
        </div>
      </div>
      <div class="heatmap-footer">
        <span class="heatmap-summary">{{ i18n.last30Days }}: {{ activeDaysInMonth }} {{ i18n.activeDaysCount }}</span>
        <div class="heatmap-legend">
          <span>{{ i18n.less }}</span>
          <span class="level-0"></span><span class="level-1"></span><span class="level-2"></span><span
            class="level-3"
          ></span><span class="level-4"></span>
          <span>{{ i18n.more }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { formatDate } from "../utils"

interface HistoricalDataItem {
  date: string
  dateLabel: string
  totalNotes: number
  totalWords: number
  todayCreated: number
  todayModified: number
}

interface Props {
  historicalData?: HistoricalDataItem[]
  i18n?: {
    activityHeatmap?: string
    less?: string
    more?: string
    last30Days?: string
    activeDaysCount?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  i18n: () => ({
    activityHeatmap: "活跃热力图",
    less: "少",
    more: "多",
    last30Days: "近30天",
    activeDaysCount: "天活跃",
  }),
})

const LEVEL_THRESHOLDS = [0, 1, 6, 16, 31] as const

const heatmapCells = computed(() => {
  const cells = []
  const now = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = formatDate(date)
    const dayData = props.historicalData.find((d) => d.date === dateStr)

    const activity = dayData ? dayData.todayCreated + dayData.todayModified : 0
    let levelIdx = 0
    for (let t = LEVEL_THRESHOLDS.length - 1; t >= 0; t--) {
      if (activity >= LEVEL_THRESHOLDS[t]) { levelIdx = t; break }
    }

    cells.push({
      activity,
      date: dateStr,
      level: `level-${levelIdx}`,
      tooltip: `${dateStr}: ${activity}次操作`,
    })
  }

  return cells
})

const activeDaysInMonth = computed(() => {
  return heatmapCells.value.filter((c) => c.level !== "level-0").length
})
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as stats;

.heatmap-card {
  @include stats.stats-card-base;

  .card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(var(--b3-theme-primary-rgb), 0.06);
    border-bottom: 1px solid var(--b3-border-color);

    .card-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--b3-theme-primary);
    }

    .header-summary {
      margin-left: auto;
      font-size: 9px;
      opacity: 0.5;
    }
  }

  .card-body { padding: 10px 12px; }
}

.heatmap-scroll {
  overflow-x: auto;
  margin-bottom: 6px;

  &::-webkit-scrollbar {
    height: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--b3-border-color);
    border-radius: 2px;
  }
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(30, 1fr);
  gap: 3px;
  min-width: 300px;

  div {
    aspect-ratio: 1;
    border-radius: 3px;
    cursor: pointer;
    min-width: 8px;

    @include stats.heatmap-level-colors;
  }
}

.heatmap-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.heatmap-summary {
  font-size: 9px;
  opacity: 0.5;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 8px;
  opacity: 0.45;

  .level-0, .level-1, .level-2, .level-3, .level-4 {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  @include stats.heatmap-level-colors;
}
</style>
