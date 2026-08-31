<!-- 里程碑卡片：Hero 等级横幅 + 下一目标 + 分类里程碑 + 成就墙 -->
<template>
  <div class="milestones-panel">
    <!-- ====== 0. Top Bar with Settings ====== -->
    <div class="milestones-top-bar">
      <button
        class="btn-settings"
        @click="showRuleEditor = true"
      >
        <IconWrapper
          name="settings"
          :size="14"
        />
        <span>
          <!-- 按钮："规则设置" -->
          {{ i18n.ruleSettings }}
        </span>
      </button>
    </div>

    <MilestoneRuleEditor
      :visible="showRuleEditor"
      :i18n="i18n"
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
          <!-- 成就点："{n} 成就点" -->
          {{ pointsLine }}
        </div>
        <div class="hero-stats">
          <span class="hero-stat">
            <span class="hero-stat-num">{{ achievedCount }}</span>
            <!-- 统计标签："里程碑" -->
            <span class="hero-stat-key">{{ i18n.milestones }}</span>
          </span>
          <span class="hero-stat-divider">·</span>
          <span class="hero-stat">
            <span class="hero-stat-num">{{ unlockedAchievements.length }}</span>
            <!-- 统计标签："成就" -->
            <span class="hero-stat-key">{{ i18n.achievementsLabel }}</span>
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
      <!-- 升级提示："距 Lv.N 称号" -->
      <span class="level-next-label">{{ nextLevelHint }}</span>
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
        <!-- 卡片前缀："下一目标" -->
        <span class="next-goal-prefix">{{ i18n.nextGoal }}</span>
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
      :i18n="i18n"
      @delete-custom="deleteAchievement"
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
} from "../../types/milestoneData"
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
} from "../../types/milestoneData"
import {
  buildThresholdAchievements,
  getLevelInfo,
  pointsForLevel,
} from "../../utils/achievements"
import {
  generateMilestones,
  TYPE_META,
} from "../../utils/milestones"
import { useMilestoneStorage } from "../../composables/useMilestoneStorage"
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
  i18n: () => ({}),
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

const expandedCategories = ref<Set<string>>(new Set())

// 稀有度标签（普通/稀有/史诗/传说）
const tierLabels: Record<Tier, string> = {
  common: props.i18n.tierCommon,
  rare: props.i18n.tierRare,
  epic: props.i18n.tierEpic,
  legendary: props.i18n.tierLegendary,
}

const categories = computed<CategoryDef[]>(() =>
  CATEGORY_DEFS.map((c) => ({
    id: c.id,
    icon: c.icon,
    name: props.i18n[c.i18nKey],
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
    result.push(...generateMilestones(type, statCounts.value[type] ?? 0, customRules.value, props.i18n))
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

// 鼓励文案：按进度分档（只差一点点/已过半/千里之行）
const encourageText = computed(() => {
  if (!nextMilestone.value) return ""
  const p = nextMilestone.value.progress
  if (p >= 80) return props.i18n.encourageAlmost
  if (p >= 40) return props.i18n.encourageHalfway
  return props.i18n.encourageStart
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

/** 称号本地化：阶级前缀键 + 基础称号键（中文前缀自带「·」、英文前缀自带空格） */
function levelTitle(info: { prefixKey: string, titleKey: string }): string {
  return `${props.i18n[info.prefixKey] ?? ""}${props.i18n[info.titleKey] ?? ""}`
}

const currentLevel = computed(() => {
  let level = 1
  while (pointsForLevel(level + 1, levelConfig.value.curveMultiplier) <= totalPoints.value) level++
  const info = getLevelInfo(level)
  return {
    level,
    icon: info.icon,
    title: levelTitle(info),
    pointsRequired: pointsForLevel(level, levelConfig.value.curveMultiplier),
  }
})

const nextLevel = computed(() => {
  const lv = currentLevel.value.level + 1
  const info = getLevelInfo(lv)
  return {
    level: lv,
    icon: info.icon,
    title: levelTitle(info),
    pointsRequired: pointsForLevel(lv, levelConfig.value.curveMultiplier),
  }
})

// 成就点行文案（{n} 占位符）
const pointsLine = computed(() =>
  String(props.i18n.achievementPoints ?? "").replace("{n}", String(totalPoints.value)),
)

// 距下一级提示（{level}/{title} 占位符）
const nextLevelHint = computed(() =>
  String(props.i18n.nextLevelHint ?? "")
    .replace("{level}", String(nextLevel.value.level))
    .replace("{title}", nextLevel.value.title),
)

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
  // 按 meta 成就 id 显式映射 check，避免与 META_ACHIEVEMENTS 数组长度隐式耦合
  const metaChecks: Record<string, () => boolean> = {
    "ach-all-common": () => allMilestones.value.filter((m) => m.tier === "common").every((m) => (statCounts.value[m.type] ?? 0) >= m.target),
    "ach-half-all": () => achievedCount.value >= allMilestones.value.length / 2,
    "ach-all-rare": () => allMilestones.value.filter((m) => m.tier === "rare").every((m) => (statCounts.value[m.type] ?? 0) >= m.target),
    "ach-level-10": () => currentLevel.value.level >= 10,
  }
  const metaDefs: AchievementDef[] = META_ACHIEVEMENTS.map((meta) => ({
    ...meta,
    check: metaChecks[meta.id] ?? (() => false),
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
@use "../../styles/MilestonesCard.scss";
@use '../../styles/index.scss' as stats;
</style>
