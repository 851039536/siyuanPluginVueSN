<!-- 里程碑卡片：Hero 等级横幅 + 下一目标 + 分类里程碑 + 成就墙 -->
<template>
  <div class="milestones-panel">
    <!-- ====== 0. Top Bar with Settings ====== -->
    <div class="milestones-top-bar">
      <button
        class="btn-settings"
        @click="showRuleEditor = true"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
        ><path
          d="M7 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
        /><path
          d="M12.2 7a.4.4 0 01-.3-.46l.38-2.27a.5.5 0 00-.25-.54l-2-1.15a.5.5 0 00-.58.07l-1.66 1.35a.42.42 0 01-.54 0L5.61 2.65a.5.5 0 00-.59-.07l-1.99 1.15a.5.5 0 00-.25.54l.38 2.27a.42.42 0 01-.3.46l-2.21.64a.5.5 0 00-.33.49v2.3a.5.5 0 00.33.49l2.21.64a.45.45 0 01.3.46l-.38 2.27a.5.5 0 00.25.54l1.99 1.15a.5.5 0 00.59-.07l1.66-1.35a.4.4 0 01.54 0l1.64 1.35a.5.5 0 00.58-.07l2-1.15a.5.5 0 00.25-.54l-.38-2.27a.43.43 0 01.3-.46l2.21-.64a.5.5 0 00.33-.49v-2.3a.5.5 0 00-.33-.49l-2.21-.64z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
        /></svg>
        <span>规则设置</span>
      </button>
    </div>

    <MilestoneRuleEditor
      :visible="showRuleEditor"
      @close="showRuleEditor = false"
    />

    <!-- ====== 1. Hero Rank Banner ====== -->
    <div class="hero-banner">
      <div class="hero-icon-wrap">
        <IconWrapper
          class="hero-icon"
          :name="currentLevel.icon as IconKey"
        />
      </div>
      <div class="hero-body">
        <div class="hero-level">
          Lv.{{ currentLevel.level }}
        </div>
        <div class="hero-title">
          {{ currentLevel.title }}
        </div>
        <div class="hero-meta">
          {{ totalPoints }} 成就点
        </div>
        <div class="hero-stats">
          <span class="hero-stat">
            <span class="hero-stat-num">{{ achievedCount }}</span>
            <span class="hero-stat-key">里程碑</span>
          </span>
          <span class="hero-stat-divider">·</span>
          <span class="hero-stat">
            <span class="hero-stat-num">{{ unlockedAchievements.length }}</span>
            <span class="hero-stat-key">成就</span>
          </span>
        </div>
      </div>
      <!-- level progress ring -->
      <div
        v-if="nextLevel"
        class="hero-progress"
      >
        <svg
          class="progress-ring"
          viewBox="0 0 64 64"
        >
          <circle
            class="ring-bg"
            cx="32"
            cy="32"
            r="28"
          />
          <circle
            class="ring-fill"
            cx="32"
            cy="32"
            r="28"
            :stroke-dasharray="`${(levelProgress / 100) * 176} 176`"
          />
        </svg>
        <span class="ring-label">{{ levelProgress.toFixed(0) }}%</span>
      </div>
    </div>

    <div
      v-if="nextLevel"
      class="level-next-row"
    >
      <span class="level-next-label">距 Lv.{{ nextLevel.level }} {{ nextLevel.title }}</span>
      <div class="level-bar">
        <div
          class="level-bar-fill"
          :style="{ width: `${levelProgress}%` }"
        />
      </div>
    </div>

    <!-- ====== 2. Next Goal ====== -->
    <div
      v-if="nextMilestone"
      class="next-goal-card"
    >
      <div class="next-goal-top">
        <span class="next-goal-prefix">{{ i18n.nextGoal || '下一目标' }}</span>
        <span class="next-goal-percent">{{ nextMilestone.progress.toFixed(0) }}%</span>
      </div>
      <div class="next-goal-main">
        <IconWrapper
          class="next-goal-icon"
          :name="nextMilestone.icon as IconKey"
        />
        <span class="next-goal-name">{{ nextMilestone.label }}</span>
      </div>
      <div class="next-goal-bar">
        <div
          class="next-goal-bar-fill"
          :style="{ width: `${nextMilestone.progress}%` }"
        />
      </div>
      <div class="next-goal-encourage">
        {{ encourageText }}
      </div>
    </div>

    <!-- ====== 3. Category Sections ====== -->
    <MilestoneCategoryList
      :category-views="categoryViews"
      :tier-labels="tierLabels"
      @toggle="toggleCategory"
    />

    <!-- ====== 4. Achievement Wall ====== -->
    <AchievementWall
      :unlocked="unlockedAchievements"
      :locked="lockedAchievements"
      :tier-labels="tierLabels"
      @delete-custom="deleteCustomAchievement"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  AchievementDef,
  CategoryDef,
  CategoryView,
  MilestoneDef,
  MilestoneState,
  Tier,
} from "../types/milestoneData"
import type { IconKey } from "@/config/icons"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  CATEGORY_DEFS,
  META_ACHIEVEMENTS,
} from "../types/milestoneData"
import {
  buildThresholdAchievements,
  getLevelInfo,
  pointsForLevel,
} from "../utils/achievements"
import {
  generateMilestones,
  TYPE_META,
} from "../utils/milestones"
import { useMilestoneStorage } from "../composables/useMilestoneStorage"
import AchievementWall from "./AchievementWall.vue"
import MilestoneCategoryList from "./MilestoneCategoryList.vue"
import MilestoneRuleEditor from "./MilestoneRuleEditor.vue"

interface Props {
  plugin?: Plugin
  totalNotes?: number
  totalWords?: number
  totalTags?: number
  totalBacklinks?: number
  totalAssets?: number
  totalImages?: number
  totalBlocks?: number
  notebookCount?: number
  codeBlocks?: number
  writingStreak?: number
  activeDays?: number
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  plugin: undefined,
  totalNotes: 0,
  totalWords: 0,
  totalTags: 0,
  totalBacklinks: 0,
  totalAssets: 0,
  totalImages: 0,
  totalBlocks: 0,
  notebookCount: 0,
  codeBlocks: 0,
  writingStreak: 0,
  activeDays: 0,
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
    catPersistence: "坚持不懈",
  }),
})

const showRuleEditor = ref(false)

const {
  customRules,
  customAchievements,
  levelConfig,
  initMilestoneStorage,
  deleteAchievement,
} = useMilestoneStorage()

onMounted(() => {
  initMilestoneStorage(props.plugin)
})

function deleteCustomAchievement(id: string) {
  deleteAchievement(id)
}

const expandedCategories = ref<Set<string>>(new Set())

const tierLabels: Record<Tier, string> = {
  common: props.i18n.tierCommon || "普通",
  rare: props.i18n.tierRare || "稀有",
  epic: props.i18n.tierEpic || "史诗",
  legendary: props.i18n.tierLegendary || "传说",
}

const categories = computed<CategoryDef[]>(() =>
  CATEGORY_DEFS.map((c) => ({
    id: c.id,
    icon: c.icon,
    name: props.i18n[c.i18nKey] || c.fallback,
    types: c.types,
  })),
)

// ===== 统一统计值 =====
const statCounts = computed<Record<string, number>>(() => ({
  notes: props.totalNotes,
  notebooks: props.notebookCount,
  words: props.totalWords,
  code: props.codeBlocks,
  tags: props.totalTags,
  backlinks: props.totalBacklinks,
  assets: props.totalAssets,
  images: props.totalImages,
  blocks: props.totalBlocks,
  streak: props.writingStreak,
  activeDays: props.activeDays,
}))

// ===== 公式化无限里程碑（TYPE_META / generateMilestones 见 utils/milestones） =====
const allMilestones = computed((): MilestoneDef[] => {
  const result: MilestoneDef[] = []
  for (const type of Object.keys(TYPE_META)) {
    result.push(...generateMilestones(type, statCounts.value[type] ?? 0, customRules.value))
  }
  return result
})

// ===== 等级系统（pointsForLevel / getLevelInfo 见 utils/achievements） =====
const tierPoints = computed(() => levelConfig.value.tierPoints)

const milestonesWithState = computed<MilestoneState[]>(() => {
  return allMilestones.value.map((m) => {
    const current = statCounts.value[m.type] ?? 0
    const achieved = current >= m.target
    const progress = achieved ? 100 : Math.min((current / m.target) * 100, 100)
    return {
      ...m,
      achieved,
      progress,
      current,
      isNext: false,
    }
  })
})

const achievedCount = computed(() =>
  milestonesWithState.value.filter((m) => m.achieved).length,
)

const nextMilestone = computed(() => {
  return milestonesWithState.value.find((m) => !m.achieved) ?? null
})

const encourageText = computed(() => {
  if (!nextMilestone.value) return ""
  const p = nextMilestone.value.progress
  if (p >= 80) return props.i18n.encourageAlmost || "只差一点点，加油！"
  if (p >= 40) return props.i18n.encourageHalfway || "已完成过半，继续努力！"
  return props.i18n.encourageStart || "千里之行，始于足下"
})

function toggleCategory(catId: string) {
  const next = new Set(expandedCategories.value)
  if (next.has(catId)) {
    next.delete(catId)
  } else {
    next.add(catId)
  }
  expandedCategories.value = next
}

// Per-category views with independent expansion
const categoryViews = computed<CategoryView[]>(() => {
  return categories.value.map((cat) => {
    const catItems = milestonesWithState.value.filter((m) =>
      cat.types.includes(m.type),
    )
    const achieved = catItems.filter((m) => m.achieved)
    const pending = catItems.filter((m) => !m.achieved)
    const nextId = pending.length > 0 ? pending[0].id : null

    const allMarked = catItems.map((m) => ({
      ...m,
      isNext: m.id === nextId,
    }))

    // collapsed preview: last 3 achieved + 1 next
    const recentAchieved = achieved.slice(-3)
    const nextOne = pending.length > 0 ? [pending[0]] : []
    const preview = [...recentAchieved, ...nextOne]
    const previewMarked = preview.map((m) => ({
      ...m,
      isNext: m.id === nextId,
    }))

    return {
      id: cat.id,
      icon: cat.icon,
      name: cat.name,
      expanded: expandedCategories.value.has(cat.id),
      achievedCount: achieved.length,
      totalCount: catItems.length,
      allItems: allMarked,
      previewItems: previewMarked,
      hiddenCount: Math.max(0, catItems.length - preview.length),
    }
  })
})

// ===== 等级计算 =====
const totalPoints = computed(() => {
  return milestonesWithState.value
    .filter((m) => m.achieved)
    .reduce((sum, m) => sum + (tierPoints.value[m.tier] ?? 0), 0)
})

const currentLevel = computed(() => {
  let level = 1
  while (pointsForLevel(level + 1, levelConfig.value.curveMultiplier) <= totalPoints.value) level++
  const info = getLevelInfo(level)
  return {
    level,
    ...info,
    pointsRequired: pointsForLevel(level, levelConfig.value.curveMultiplier),
  }
})

const nextLevel = computed(() => {
  const lv = currentLevel.value.level + 1
  const info = getLevelInfo(lv)
  return {
    level: lv,
    ...info,
    pointsRequired: pointsForLevel(lv, levelConfig.value.curveMultiplier),
  }
})

const levelProgress = computed(() => {
  const cur = currentLevel.value.pointsRequired
  const nxt = nextLevel.value.pointsRequired
  const range = nxt - cur
  if (range <= 0) return 100
  return Math.min(((totalPoints.value - cur) / range) * 100, 100)
})

// ===== 阈值成就构建见 utils/achievements（数据见 types/milestoneData） =====

// ===== 成就 partition（数据见 milestoneData，构建见 achievements） =====
/** 一次性 partition：避免 unlocked/locked 双重遍历 */
const achievementPartition = computed(() => {
  const metaChecks: (() => boolean)[] = [
    () => allMilestones.value.filter((m) => m.tier === "common").every((m) => (statCounts.value[m.type] ?? 0) >= m.target),
    () => achievedCount.value >= allMilestones.value.length / 2,
    () => allMilestones.value.filter((m) => m.tier === "rare").every((m) => (statCounts.value[m.type] ?? 0) >= m.target),
    () => currentLevel.value.level >= 10,
  ]
  const metaDefs: AchievementDef[] = META_ACHIEVEMENTS.map((meta, i) => ({
    ...meta,
    check: metaChecks[i],
  }))
  const customDefs: AchievementDef[] = customAchievements.value.map((a) => ({
    id: a.id,
    icon: a.icon,
    title: a.title,
    description: a.description,
    tier: a.tier,
    // Mark as custom so template can show delete button
    _custom: true,
    check: () => (statCounts.value[a.type] ?? 0) >= a.threshold,
  }))
  const all: AchievementDef[] = [...buildThresholdAchievements(statCounts.value), ...metaDefs, ...customDefs]
  const unlocked: AchievementDef[] = []
  const locked: AchievementDef[] = []
  for (const a of all) {
    if (a.check()) unlocked.push(a)
    else locked.push(a)
  }
  return {
    unlocked,
    locked,
  }
})

const unlockedAchievements = computed(() => achievementPartition.value.unlocked)
const lockedAchievements = computed(() => achievementPartition.value.locked)
</script>

<style scoped lang="scss">
@use "../styles/MilestonesCard.scss";
</style>
