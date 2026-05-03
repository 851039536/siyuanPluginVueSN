<template>
  <div class="insight-cards">
    <div class="insight-card">
      <div class="card-header">
        <span class="card-icon">📊</span>
        <span class="card-title">{{ i18n.activityHeatmap }}</span>
        <span class="header-sep">·</span>
        <span class="card-icon">🏆</span>
        <span class="card-title">{{ i18n.milestones }}</span>
        <span class="achieved-count">{{ achievedCount }}/{{ allMilestones.length }}</span>
      </div>
      <div class="card-body">
        <!-- 热力图区域 -->
        <div class="heatmap-section">
          <div class="heatmap-grid">
            <div v-for="(cell, idx) in heatmapCells" :key="idx" :class="cell.level" :title="cell.tooltip"><span v-if="cell.activity > 0">{{ cell.activity }}</span></div>
          </div>
          <div class="heatmap-footer">
            <span class="heatmap-summary">{{ i18n.last30Days }}: {{ activeDaysInMonth }} {{ i18n.activeDaysCount }}</span>
            <div class="heatmap-legend">
              <span>{{ i18n.less }}</span>
              <span class="level-0"></span><span class="level-1"></span><span class="level-2"></span><span
                class="level-3"></span><span class="level-4"></span>
              <span>{{ i18n.more }}</span>
            </div>
          </div>
        </div>

        <!-- 分隔线 -->
        <div class="section-divider">
          <span class="divider-label">🏆 {{ i18n.milestones }}</span>
        </div>

        <!-- 里程碑区域 -->
        <div class="milestones-section">
          <div class="milestones-grid">
            <div v-for="m in visibleMilestones" :key="m.id" class="milestone-item" :class="{ achieved: m.achieved }">
              <span class="milestone-icon">{{ m.achieved ? m.icon : '🔒' }}</span>
              <span class="milestone-text">{{ m.label }}</span>
              <div v-if="!m.achieved" class="mini-progress">
                <div class="mini-fill" :style="{ width: m.progress + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface HistoricalDataItem {
  date: string;
  dateLabel: string;
  totalNotes: number;
  totalWords: number;
  todayCreated: number;
  todayModified: number;
}

interface Props {
  historicalData?: HistoricalDataItem[];
  totalNotes?: number;
  totalWords?: number;
  i18n?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  totalNotes: 0,
  totalWords: 0,
  i18n: () => ({
    activityHeatmap: "活跃热力图",
    less: "少",
    more: "多",
    last30Days: "近30天",
    activeDaysCount: "天活跃",
    milestones: "里程碑",
    notes: "笔记",
    words: "字数",
    notesUnit: "篇",
    wordsUnit: "字",
  }),
});

// ============ 热力日历 ============
const LEVEL_THRESHOLDS = [0, 1, 6, 16, 31] as const;

const heatmapCells = computed(() => {
  const cells = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);
    const dayData = props.historicalData.find((d) => d.date === dateStr);

    const activity = dayData ? dayData.todayCreated + dayData.todayModified : 0;
    let levelIdx = 0;
    for (let t = LEVEL_THRESHOLDS.length - 1; t >= 0; t--) {
      if (activity >= LEVEL_THRESHOLDS[t]) { levelIdx = t; break; }
    }

    cells.push({
      activity,
      date: dateStr,
      level: `level-${levelIdx}`,
      tooltip: `${dateStr}: ${activity}次操作`,
    });
  }

  return cells;
});

const activeDaysInMonth = computed(() => {
  return heatmapCells.value.filter((c) => c.level !== "level-0").length;
});

// ============ 里程碑 ============
const allMilestones = [
  // 笔记里程碑：500篇起
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
  // 字数里程碑：50万字起
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
];

const achievedCount = computed(() => {
  return allMilestones.filter((m) => {
    const current = m.type === "notes" ? props.totalNotes : props.totalWords;
    return current >= m.target;
  }).length;
});

const visibleMilestones = computed(() => {
  return allMilestones.map((m) => {
    const current = m.type === "notes" ? props.totalNotes : props.totalWords;
    const achieved = current >= m.target;
    const progress = achieved ? 100 : Math.min((current / m.target) * 100, 100);
    return { ...m, achieved, progress };
  });
});

// ============ 工具函数 ============
function formatDate(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
}

function padZero(num: number): string {
  return num < 10 ? "0" + num : String(num);
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as stats;

.insight-cards {
  margin-bottom: 8px;

  .insight-card {
    @include stats.stats-card-base;

    .card-header {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 8px 12px;
      background: rgba(var(--b3-theme-primary-rgb), 0.06);
      border-bottom: 1px solid var(--b3-border-color);

      .card-icon {
        font-size: 13px;
      }

      .card-title {
        font-size: 11px;
        font-weight: 700;
        color: var(--b3-theme-primary);
      }

      .header-sep {
        opacity: 0.3;
        margin: 0 2px;
      }

      .achieved-count {
        margin-left: auto;
        font-size: 10px;
        opacity: 0.6;
      }
    }

    .card-body {
      padding: 10px 12px;
    }
  }
}

// 热力图区域
.heatmap-section {
  margin-bottom: 10px;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  gap: 2px;
  margin-bottom: 6px;

  div {
    aspect-ratio: 1;
    border-radius: 2px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    span {
      font-size: 8px;
      line-height: 1;
      color: inherit;
    }

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

  .level-0,
  .level-1,
  .level-2,
  .level-3,
  .level-4 {
    width: 8px;
    height: 8px;
    border-radius: 1px;
  }

  @include stats.heatmap-level-colors;
}

// 分隔线
.section-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--b3-border-color);
  }

  .divider-label {
    font-size: 9px;
    font-weight: 600;
    color: var(--b3-theme-primary);
    opacity: 0.7;
    white-space: nowrap;
  }
}

// 里程碑区域
.milestones-section {
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--b3-border-color);
    border-radius: 2px;
  }
}

.milestones-grid {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
}

.milestone-item {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 8px;
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

  &:not(.achieved) {
    opacity: 0.5;
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
</style>
