<template>
  <div class="insight-cards">
    <!-- 热力图卡片 -->
    <div class="insight-card">
      <div class="card-header">
        <span class="card-icon">📊</span>
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

    <!-- 里程碑卡片 -->
    <CollapsibleSection
      :title="`🏆 ${i18n.milestones}`"
      :badge="`${achievedCount}/${allMilestones.length}`"
      :default-expanded="true"
    >
      <div class="milestones-grid">
        <div
          v-for="m in visibleMilestones"
          :key="m.id"
          class="milestone-item"
          :class="{
            achieved: m.achieved,
            locked: !m.achieved && !m.isNext,
          }"
        >
          <span class="milestone-icon">{{ m.achieved ? m.icon : (m.isNext ? '🎯' : '🔒') }}</span>
          <span class="milestone-text">{{ m.label }}</span>
          <div
            v-if="!m.achieved"
            class="mini-progress"
          >
            <div
              class="mini-fill"
              :style="{ width: `${m.progress}%` }"
            ></div>
          </div>
        </div>
      </div>
      <button
        v-if="!showAllMilestones && hasHiddenMilestones"
        class="show-all-btn"
        @click="showAllMilestones = true"
      >
        {{ showAllText }}
      </button>
    </CollapsibleSection>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
} from "vue"
import { formatDate } from "../utils"
import CollapsibleSection from "./CollapsibleSection.vue"

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
  totalNotes?: number
  totalWords?: number
  totalBacklinks?: number
  i18n?: {
    activityHeatmap?: string
    less?: string
    more?: string
    last30Days?: string
    activeDaysCount?: string
    milestones?: string
    showAllMilestones?: string
    notes?: string
    words?: string
    notesUnit?: string
    wordsUnit?: string
    backlinks?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  totalNotes: 0,
  totalWords: 0,
  totalBacklinks: 0,
  i18n: () => ({
    activityHeatmap: "活跃热力图",
    less: "少",
    more: "多",
    last30Days: "近30天",
    activeDaysCount: "天活跃",
    milestones: "里程碑",
    showAllMilestones: "显示全部 {count} 个里程碑",
    notes: "笔记",
    words: "字数",
    notesUnit: "篇",
    wordsUnit: "字",
    backlinks: "双链",
  }),
})

const showAllMilestones = ref(false)

const showAllText = computed(() =>
  (props.i18n.showAllMilestones || "显示全部 {count} 个里程碑")
    .replace("{count}", String(allMilestones.length)),
)

// ============ 热力日历 ============
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

// ============ 里程碑 ============
const allMilestones = [
  {
    id: "notes-500",
    icon: "🌱",
    label: "500篇笔记",
    target: 500,
    type: "notes",
  },
  {
    id: "notes-1500",
    icon: "🌿",
    label: "1500篇笔记",
    target: 1500,
    type: "notes",
  },
  {
    id: "notes-3000",
    icon: "🌳",
    label: "3000篇笔记",
    target: 3000,
    type: "notes",
  },
  {
    id: "notes-3500",
    icon: "🌲",
    label: "3500篇笔记",
    target: 3500,
    type: "notes",
  },
  {
    id: "notes-4000",
    icon: "🏔️",
    label: "4000篇笔记",
    target: 4000,
    type: "notes",
  },
  {
    id: "notes-5000",
    icon: "⛰️",
    label: "5000篇笔记",
    target: 5000,
    type: "notes",
  },
  {
    id: "notes-7500",
    icon: "🗻",
    label: "7500篇笔记",
    target: 7500,
    type: "notes",
  },
  {
    id: "notes-10000",
    icon: "🏔️",
    label: "1万篇笔记",
    target: 10000,
    type: "notes",
  },
  {
    id: "words-50w",
    icon: "📚",
    label: "50万字",
    target: 500000,
    type: "words",
  },
  {
    id: "words-100w",
    icon: "🎓",
    label: "100万字",
    target: 1000000,
    type: "words",
  },
  {
    id: "words-200w",
    icon: "📖",
    label: "200万字",
    target: 2000000,
    type: "words",
  },
  {
    id: "words-300w",
    icon: "📜",
    label: "300万字",
    target: 3000000,
    type: "words",
  },
  {
    id: "words-500w",
    icon: "🏆",
    label: "500万字",
    target: 5000000,
    type: "words",
  },
  {
    id: "words-1000w",
    icon: "👑",
    label: "1000万字",
    target: 10000000,
    type: "words",
  },
  {
    id: "words-5000w",
    icon: "💎",
    label: "5000万字",
    target: 50000000,
    type: "words",
  },
  {
    id: "words-1yi",
    icon: "🌟",
    label: "1亿字",
    target: 100000000,
    type: "words",
  },
]

const achievedCount = computed(() => {
  return allMilestones.filter((m) => {
    const current = m.type === "notes" ? props.totalNotes : props.totalWords
    return current >= m.target
  }).length
})

const visibleMilestones = computed(() => {
  const milestonesWithState = allMilestones.map((m) => {
    const current = m.type === "notes" ? props.totalNotes : props.totalWords
    const achieved = current >= m.target
    const progress = achieved ? 100 : Math.min((current / m.target) * 100, 100)
    return {
      ...m,
      achieved,
      progress,
      isNext: false as boolean,
    }
  })

  if (showAllMilestones.value) {
    return milestonesWithState
  }

  // 找到最近已完成的和下一个待完成的
  const achieved = milestonesWithState.filter((m) => m.achieved)
  const nextOnes = milestonesWithState.filter((m) => !m.achieved)

  // 最多显示最近3个已完成 + 下1个待完成
  const recentAchieved = achieved.slice(-3)
  const nextTarget = nextOnes.length > 0 ? [nextOnes[0]] : []

  const visible = [...recentAchieved, ...nextTarget]

  // 标记下一个
  return visible.map((m) => ({
    ...m,
    isNext: !m.achieved && nextOnes.length > 0 && m.id === nextOnes[0].id,
  }))
})

const hasHiddenMilestones = computed(() => {
  return achievedCount.value > 3 || allMilestones.length > visibleMilestones.value.length + 1
})

// ============ 工具函数 ==========
// formatDate 和 padZero 从 ../utils 导入
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as stats;

.insight-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .insight-card {
    @include stats.stats-card-base;

    .card-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(var(--b3-theme-primary-rgb), 0.06);
      border-bottom: 1px solid var(--b3-border-color);

      .card-icon { font-size: 13px; }

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
}

// 热力图区域
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

// 里程碑区域
.milestones-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.milestone-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  min-width: 56px;
  background: rgba(var(--b3-theme-primary-rgb), 0.03);
  border-radius: 6px;

  &.achieved {
    background: rgba(stats.$color-success, 0.1);

    .milestone-text {
      color: stats.$color-success;
      font-weight: 600;
    }
  }

  &.locked {
    opacity: 0.4;
  }

  &:not(.achieved):not(.locked) {
    // 下一个目标
    background: rgba(var(--b3-theme-primary-rgb), 0.08);
    border: 1px dashed var(--b3-theme-primary);
    opacity: 1;

    .milestone-text {
      color: var(--b3-theme-primary);
      font-weight: 600;
    }
  }

  .milestone-icon {
    font-size: 14px;
    margin-bottom: 2px;
  }

  .milestone-text {
    font-size: 8px;
    text-align: center;
    white-space: nowrap;
  }

  .mini-progress {
    width: 100%;
    height: 2px;
    background: rgba(var(--b3-theme-primary-rgb), 0.1);
    border-radius: 1px;
    margin-top: 3px;
    overflow: hidden;

    .mini-fill {
      height: 100%;
      background: var(--b3-theme-primary);
      border-radius: 1px;
    }
  }
}

.show-all-btn {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 6px;
  border: 1px dashed var(--b3-border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 10px;
  opacity: 0.5;
  cursor: pointer;
  text-align: center;

  &:hover {
    opacity: 0.8;
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }
}
</style>
