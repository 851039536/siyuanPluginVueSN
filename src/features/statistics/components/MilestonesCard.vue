<template>
  <div class="milestones-card">
    <div class="card-header">
      <span class="card-title">{{ i18n.milestones }}</span>
      <span class="header-badge">{{ achievedCount }}/{{ allMilestones.length }}</span>
    </div>
    <div class="card-body">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
} from "vue"

interface Props {
  totalNotes?: number
  totalWords?: number
  i18n?: {
    milestones?: string
    showAllMilestones?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  totalNotes: 0,
  totalWords: 0,
  i18n: () => ({
    milestones: "里程碑",
    showAllMilestones: "显示全部 {count} 个里程碑",
  }),
})

const showAllMilestones = ref(false)

const showAllText = computed(() =>
  (props.i18n.showAllMilestones || "显示全部 {count} 个里程碑")
    .replace("{count}", String(allMilestones.length)),
)

const allMilestones = [
  { id: "notes-500", icon: "🌱", label: "500篇笔记", target: 500, type: "notes" },
  { id: "notes-1500", icon: "🌿", label: "1500篇笔记", target: 1500, type: "notes" },
  { id: "notes-3000", icon: "🌳", label: "3000篇笔记", target: 3000, type: "notes" },
  { id: "notes-3500", icon: "🌲", label: "3500篇笔记", target: 3500, type: "notes" },
  { id: "notes-4000", icon: "🏔️", label: "4000篇笔记", target: 4000, type: "notes" },
  { id: "notes-5000", icon: "⛰️", label: "5000篇笔记", target: 5000, type: "notes" },
  { id: "notes-7500", icon: "🗻", label: "7500篇笔记", target: 7500, type: "notes" },
  { id: "notes-10000", icon: "🏔️", label: "1万篇笔记", target: 10000, type: "notes" },
  { id: "words-50w", icon: "📚", label: "50万字", target: 500000, type: "words" },
  { id: "words-100w", icon: "🎓", label: "100万字", target: 1000000, type: "words" },
  { id: "words-200w", icon: "📖", label: "200万字", target: 2000000, type: "words" },
  { id: "words-300w", icon: "📜", label: "300万字", target: 3000000, type: "words" },
  { id: "words-500w", icon: "🏆", label: "500万字", target: 5000000, type: "words" },
  { id: "words-1000w", icon: "👑", label: "1000万字", target: 10000000, type: "words" },
  { id: "words-5000w", icon: "💎", label: "5000万字", target: 50000000, type: "words" },
  { id: "words-1yi", icon: "🌟", label: "1亿字", target: 100000000, type: "words" },
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
    return { ...m, achieved, progress, isNext: false as boolean }
  })

  if (showAllMilestones.value) {
    return milestonesWithState
  }

  const achieved = milestonesWithState.filter((m) => m.achieved)
  const nextOnes = milestonesWithState.filter((m) => !m.achieved)
  const recentAchieved = achieved.slice(-3)
  const nextTarget = nextOnes.length > 0 ? [nextOnes[0]] : []
  const visible = [...recentAchieved, ...nextTarget]

  return visible.map((m) => ({
    ...m,
    isNext: !m.achieved && nextOnes.length > 0 && m.id === nextOnes[0].id,
  }))
})

const hasHiddenMilestones = computed(() => {
  return achievedCount.value > 3 || allMilestones.length > visibleMilestones.value.length + 1
})
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as stats;

.milestones-card {
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

    .header-badge {
      margin-left: auto;
      font-size: 9px;
      font-weight: 600;
      color: var(--b3-theme-primary);
      opacity: 0.6;
    }
  }

  .card-body { padding: 10px 12px; }
}

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
