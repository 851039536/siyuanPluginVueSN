<template>
  <div class="milestones-card">
    <div class="card-header">
      <span class="card-title">{{ i18n.milestones }}</span>
      <span class="header-badge">{{ achievedCount }}/{{ allMilestones.length }}</span>
    </div>
    <div class="card-body">
      <!-- 下一目标聚焦卡 -->
      <div
        v-if="nextMilestone"
        class="next-goal-card"
      >
        <div class="next-goal-top">
          <span class="next-goal-icon">{{ nextMilestone.icon }}</span>
          <div class="next-goal-info">
            <span class="next-goal-label">{{ nextGoalLabel }}</span>
            <span class="next-goal-target">{{ nextMilestone.label }}</span>
          </div>
          <span class="next-goal-percent">{{ nextMilestone.progress.toFixed(0) }}%</span>
        </div>
        <div class="next-goal-progress">
          <div
            class="next-goal-fill"
            :style="{ width: `${nextMilestone.progress}%` }"
          ></div>
        </div>
        <span class="next-goal-encourage">{{ encourageText }}</span>
      </div>

      <!-- 分类展示 -->
      <div
        v-for="category in visibleCategories"
        :key="category.id"
        class="milestone-category"
      >
        <div class="category-header">
          <span class="category-icon">{{ category.icon }}</span>
          <span class="category-name">{{ category.name }}</span>
          <span class="category-count">{{ category.achievedCount }}/{{ category.items.length }}</span>
        </div>
        <div class="milestones-grid">
          <div
            v-for="m in category.items"
            :key="m.id"
            class="milestone-item"
            :class="[`tier-${m.tier}`, {
              achieved: m.achieved,
              locked: !m.achieved && !m.isNext,
            }]"
          >
            <span class="milestone-icon">{{ m.achieved ? m.icon : (m.isNext ? '🎯' : '🔒') }}</span>
            <span class="milestone-label">{{ m.label }}</span>
            <span
              v-if="m.achieved"
              class="milestone-tier-badge"
            >{{ tierLabels[m.tier] }}</span>
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
      </div>

      <button
        v-if="!showAll && hasHidden"
        class="show-all-btn"
        @click="showAll = true"
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

type Tier = "common" | "rare" | "epic" | "legendary"

interface MilestoneDef {
  id: string
  icon: string
  label: string
  target: number
  type: string
  tier: Tier
}

interface CategoryDef {
  id: string
  icon: string
  name: string
  types: string[]
}

interface Props {
  totalNotes?: number
  totalWords?: number
  totalTags?: number
  totalBacklinks?: number
  totalAssets?: number
  totalImages?: number
  i18n?: {
    milestones?: string
    showAllMilestones?: string
    nextGoal?: string
    encourageAlmost?: string
    encourageHalfway?: string
    encourageStart?: string
    tierCommon?: string
    tierRare?: string
    tierEpic?: string
    tierLegendary?: string
    catWriting?: string
    catKnowledge?: string
    catRich?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  totalNotes: 0,
  totalWords: 0,
  totalTags: 0,
  totalBacklinks: 0,
  totalAssets: 0,
  totalImages: 0,
  i18n: () => ({
    milestones: "里程碑",
    showAllMilestones: "显示全部 {count} 个里程碑",
    nextGoal: "下一目标",
    encourageAlmost: "只差一点点，加油！",
    encourageHalfway: "已完成过半，继续努力！",
    encourageStart: "千里之行，始于足下",
    tierCommon: "普通",
    tierRare: "稀有",
    tierEpic: "史诗",
    tierLegendary: "传说",
    catWriting: "写作达人",
    catKnowledge: "知识管理",
    catRich: "内容丰富",
  }),
})

const showAll = ref(false)

const tierLabels: Record<Tier, string> = {
  common: props.i18n.tierCommon || "普通",
  rare: props.i18n.tierRare || "稀有",
  epic: props.i18n.tierEpic || "史诗",
  legendary: props.i18n.tierLegendary || "传说",
}

const categories: CategoryDef[] = [
  { id: "writing", icon: "✍️", name: props.i18n.catWriting || "写作达人", types: ["notes"] },
  { id: "knowledge", icon: "🧠", name: props.i18n.catKnowledge || "知识管理", types: ["tags", "backlinks"] },
  { id: "rich", icon: "📦", name: props.i18n.catRich || "内容丰富", types: ["words", "assets", "images"] },
]

const allMilestones: MilestoneDef[] = [
  // 笔记数
  { id: "n-100", icon: "🌱", label: "100篇", target: 100, type: "notes", tier: "common" },
  { id: "n-500", icon: "🌿", label: "500篇", target: 500, type: "notes", tier: "common" },
  { id: "n-1k", icon: "🌳", label: "1000篇", target: 1000, type: "notes", tier: "rare" },
  { id: "n-3k", icon: "🌲", label: "3000篇", target: 3000, type: "notes", tier: "rare" },
  { id: "n-5k", icon: "⛰️", label: "5000篇", target: 5000, type: "notes", tier: "epic" },
  { id: "n-10k", icon: "🏔️", label: "1万篇", target: 10000, type: "notes", tier: "legendary" },
  // 字数
  { id: "w-10w", icon: "📝", label: "10万字", target: 100000, type: "words", tier: "common" },
  { id: "w-50w", icon: "📚", label: "50万字", target: 500000, type: "words", tier: "common" },
  { id: "w-100w", icon: "🎓", label: "100万字", target: 1000000, type: "words", tier: "rare" },
  { id: "w-300w", icon: "📖", label: "300万字", target: 3000000, type: "words", tier: "rare" },
  { id: "w-500w", icon: "🏆", label: "500万字", target: 5000000, type: "words", tier: "epic" },
  { id: "w-1000w", icon: "👑", label: "1000万字", target: 10000000, type: "words", tier: "legendary" },
  // 标签
  { id: "t-50", icon: "🏷️", label: "50个标签", target: 50, type: "tags", tier: "common" },
  { id: "t-200", icon: "🔖", label: "200个标签", target: 200, type: "tags", tier: "rare" },
  { id: "t-500", icon: "📎", label: "500个标签", target: 500, type: "tags", tier: "epic" },
  // 双链
  { id: "b-100", icon: "🔗", label: "100条双链", target: 100, type: "backlinks", tier: "common" },
  { id: "b-500", icon: "⛓️", label: "500条双链", target: 500, type: "backlinks", tier: "rare" },
  { id: "b-2k", icon: "🌐", label: "2000条双链", target: 2000, type: "backlinks", tier: "epic" },
  { id: "b-5k", icon: "🕸️", label: "5000条双链", target: 5000, type: "backlinks", tier: "legendary" },
  // 附件
  { id: "a-100", icon: "📁", label: "100个附件", target: 100, type: "assets", tier: "common" },
  { id: "a-500", icon: "💼", label: "500个附件", target: 500, type: "assets", tier: "rare" },
  { id: "a-1k", icon: "🗄️", label: "1000个附件", target: 1000, type: "assets", tier: "epic" },
  // 图片
  { id: "i-200", icon: "🖼️", label: "200张图片", target: 200, type: "images", tier: "common" },
  { id: "i-1k", icon: "📷", label: "1000张图片", target: 1000, type: "images", tier: "rare" },
  { id: "i-5k", icon: "🎨", label: "5000张图片", target: 5000, type: "images", tier: "epic" },
]

function getCurrent(type: string): number {
  const map: Record<string, number> = {
    notes: props.totalNotes,
    words: props.totalWords,
    tags: props.totalTags,
    backlinks: props.totalBacklinks,
    assets: props.totalAssets,
    images: props.totalImages,
  }
  return map[type] ?? 0
}

const milestonesWithState = computed(() => {
  return allMilestones.map((m) => {
    const current = getCurrent(m.type)
    const achieved = current >= m.target
    const progress = achieved ? 100 : Math.min((current / m.target) * 100, 100)
    return { ...m, achieved, progress, current, isNext: false }
  })
})

const achievedCount = computed(() =>
  milestonesWithState.value.filter((m) => m.achieved).length,
)

// 下一个未完成的里程碑（按进度排序）
const nextMilestone = computed(() => {
  const pending = milestonesWithState.value
    .filter((m) => !m.achieved)
    .sort((a, b) => b.progress - a.progress)
  return pending.length > 0 ? pending[0] : null
})

const nextGoalLabel = computed(() => props.i18n.nextGoal || "下一目标")

const encourageText = computed(() => {
  if (!nextMilestone.value) return ""
  const p = nextMilestone.value.progress
  if (p >= 80) return props.i18n.encourageAlmost || "只差一点点，加油！"
  if (p >= 50) return props.i18n.encourageHalfway || "已完成过半，继续努力！"
  return props.i18n.encourageStart || "千里之行，始于足下"
})

// 分类 + 可见性逻辑
const visibleCategories = computed(() => {
  const result: Array<{
    id: string
    icon: string
    name: string
    achievedCount: number
    items: typeof milestonesWithState.value
  }> = []

  for (const cat of categories) {
    const catItems = milestonesWithState.value.filter((m) => cat.types.includes(m.type))
    const achieved = catItems.filter((m) => m.achieved)

    if (showAll.value) {
      // 展开全部：标记 next
      const pending = catItems.filter((m) => !m.achieved)
      const nextId = pending.length > 0 ? pending[0].id : null
      result.push({
        id: cat.id,
        icon: cat.icon,
        name: cat.name,
        achievedCount: achieved.length,
        items: catItems.map((m) => ({
          ...m,
          isNext: m.id === nextId,
        })),
      })
    } else {
      // 折叠：最近3个已完成 + 下1个待完成
      const recentAchieved = achieved.slice(-3)
      const pending = catItems.filter((m) => !m.achieved)
      const nextOne = pending.length > 0 ? [pending[0]] : []
      const visible = [...recentAchieved, ...nextOne]
      const nextId = nextOne.length > 0 ? nextOne[0].id : null

      result.push({
        id: cat.id,
        icon: cat.icon,
        name: cat.name,
        achievedCount: achieved.length,
        items: visible.map((m) => ({
          ...m,
          isNext: m.id === nextId,
        })),
      })
    }
  }

  return result
})

const hasHidden = computed(() => {
  return milestonesWithState.value.filter((m) => m.achieved).length > 3
    || allMilestones.length > visibleCategories.value.reduce((s, c) => s + c.items.length, 0) + 3
})

const showAllText = computed(() =>
  (props.i18n.showAllMilestones || "显示全部 {count} 个里程碑")
    .replace("{count}", String(allMilestones.length)),
)
</script>

<style scoped lang="scss">
@use "@/variables" as *;
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

// ===== 下一目标聚焦卡 =====
.next-goal-card {
  padding: 10px 12px;
  margin-bottom: 10px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(var(--b3-theme-primary-rgb), 0.06) 0%, rgba(var(--b3-theme-primary-rgb), 0.02) 100%);
  border: 1px solid rgba(var(--b3-theme-primary-rgb), 0.15);
}

.next-goal-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.next-goal-icon {
  font-size: 20px;
}

.next-goal-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.next-goal-label {
  font-size: 9px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.next-goal-target {
  font-size: 13px;
  font-weight: 700;
  color: var(--b3-theme-primary);
}

.next-goal-percent {
  font-size: 18px;
  font-weight: 800;
  font-family: $font-heading;
  color: var(--b3-theme-primary);
  opacity: 0.8;
}

.next-goal-progress {
  height: 4px;
  background: rgba(var(--b3-theme-primary-rgb), 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 6px;
}

.next-goal-fill {
  height: 100%;
  background: var(--b3-theme-primary);
  border-radius: 2px;
  transition: width 0.6s ease;
}

.next-goal-encourage {
  font-size: 9px;
  color: var(--b3-theme-on-surface);
  opacity: 0.45;
  font-style: italic;
}

// ===== 分类 =====
.milestone-category {
  margin-bottom: 10px;

  &:last-child { margin-bottom: 0; }
}

.category-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px dashed var(--b3-border-color);

  .category-icon { font-size: 11px; }

  .category-name {
    font-size: 10px;
    font-weight: 700;
    color: var(--b3-theme-on-surface);
    opacity: 0.65;
  }

  .category-count {
    margin-left: auto;
    font-size: 9px;
    color: var(--b3-theme-primary);
    opacity: 0.5;
  }
}

.milestones-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.milestone-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5px 8px;
  min-width: 52px;
  background: rgba(var(--b3-theme-primary-rgb), 0.03);
  border-radius: 6px;
  position: relative;

  &.achieved {
    &.tier-common {
      background: rgba(stats.$color-success, 0.08);
      .milestone-label { color: stats.$color-success; }
    }
    &.tier-rare {
      background: rgba(var(--b3-theme-primary-rgb), 0.1);
      .milestone-label { color: var(--b3-theme-primary); }
    }
    &.tier-epic {
      background: linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(var(--b3-theme-primary-rgb), 0.08));
      .milestone-label { color: #a855f7; }
    }
    &.tier-legendary {
      background: linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(234, 88, 12, 0.08));
      border: 1px solid rgba(234, 179, 8, 0.25);
      .milestone-label { color: #ca8a04; font-weight: 700; }
    }
  }

  &.locked {
    opacity: 0.35;
  }

  &:not(.achieved):not(.locked) {
    background: rgba(var(--b3-theme-primary-rgb), 0.06);
    border: 1px dashed rgba(var(--b3-theme-primary-rgb), 0.3);
    opacity: 1;

    .milestone-label {
      color: var(--b3-theme-primary);
      font-weight: 600;
    }
  }

  .milestone-icon {
    font-size: 13px;
    margin-bottom: 1px;
  }

  .milestone-label {
    font-size: 8px;
    text-align: center;
    white-space: nowrap;
    line-height: 1.3;
  }

  .milestone-tier-badge {
    position: absolute;
    top: -3px;
    right: -3px;
    font-size: 6px;
    padding: 0 3px;
    border-radius: 3px;
    font-weight: 700;
    line-height: 1.5;
    pointer-events: none;
  }

  &.tier-common .milestone-tier-badge {
    background: rgba(stats.$color-success, 0.2);
    color: stats.$color-success;
  }

  &.tier-rare .milestone-tier-badge {
    background: rgba(var(--b3-theme-primary-rgb), 0.2);
    color: var(--b3-theme-primary);
  }

  &.tier-epic .milestone-tier-badge {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
  }

  &.tier-legendary .milestone-tier-badge {
    background: rgba(234, 179, 8, 0.25);
    color: #ca8a04;
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
