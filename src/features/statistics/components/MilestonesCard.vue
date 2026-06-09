<template>
  <div class="milestones-panel">
    <!-- ====== 0. Top Bar with Settings ====== -->
    <div class="milestones-top-bar">
      <button class="btn-settings" @click="showRuleEditor = true">
        <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M12.2 7a.4.4 0 01-.3-.46l.38-2.27a.5.5 0 00-.25-.54l-2-1.15a.5.5 0 00-.58.07l-1.66 1.35a.42.42 0 01-.54 0L5.61 2.65a.5.5 0 00-.59-.07l-1.99 1.15a.5.5 0 00-.25.54l.38 2.27a.42.42 0 01-.3.46l-2.21.64a.5.5 0 00-.33.49v2.3a.5.5 0 00.33.49l2.21.64a.45.45 0 01.3.46l-.38 2.27a.5.5 0 00.25.54l1.99 1.15a.5.5 0 00.59-.07l1.66-1.35a.4.4 0 01.54 0l1.64 1.35a.5.5 0 00.58-.07l2-1.15a.5.5 0 00.25-.54l-.38-2.27a.43.43 0 01.3-.46l2.21-.64a.5.5 0 00.33-.49v-2.3a.5.5 0 00-.33-.49l-2.21-.64z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
        <span>规则设置</span>
      </button>
    </div>

    <MilestoneRuleEditor
      :visible="showRuleEditor"
      :rules="customRules"
      :custom-achievements="customAchievements"
      @close="showRuleEditor = false"
      @save="onSaveRules"
      @add-achievement="onAddAchievement"
      @delete-achievement="onDeleteAchievement"
    />

    <!-- ====== 1. Hero Rank Banner ====== -->
    <div class="hero-banner">
      <div class="hero-icon-wrap">
        <span class="hero-icon">{{ currentLevel.icon }}</span>
      </div>
      <div class="hero-body">
        <div class="hero-level">Lv.{{ currentLevel.level }}</div>
        <div class="hero-title">{{ currentLevel.title }}</div>
        <div class="hero-meta">{{ totalPoints }} 成就点</div>
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
      <div v-if="nextLevel" class="hero-progress">
        <svg class="progress-ring" viewBox="0 0 64 64">
          <circle class="ring-bg" cx="32" cy="32" r="28" />
          <circle
            class="ring-fill"
            cx="32" cy="32" r="28"
            :stroke-dasharray="`${(levelProgress / 100) * 176} 176`"
          />
        </svg>
        <span class="ring-label">{{ levelProgress.toFixed(0) }}%</span>
      </div>
    </div>

    <div v-if="nextLevel" class="level-next-row">
      <span class="level-next-label">距 Lv.{{ nextLevel.level }} {{ nextLevel.title }}</span>
      <div class="level-bar">
        <div class="level-bar-fill" :style="{ width: `${levelProgress}%` }" />
      </div>
    </div>

    <!-- ====== 2. Next Goal ====== -->
    <div v-if="nextMilestone" class="next-goal-card">
      <div class="next-goal-top">
        <span class="next-goal-prefix">{{ i18n.nextGoal || '下一目标' }}</span>
        <span class="next-goal-percent">{{ nextMilestone.progress.toFixed(0) }}%</span>
      </div>
      <div class="next-goal-main">
        <span class="next-goal-icon">{{ nextMilestone.icon }}</span>
        <span class="next-goal-name">{{ nextMilestone.label }}</span>
      </div>
      <div class="next-goal-bar">
        <div class="next-goal-bar-fill" :style="{ width: `${nextMilestone.progress}%` }" />
      </div>
      <div class="next-goal-encourage">{{ encourageText }}</div>
    </div>

    <!-- ====== 3. Category Sections ====== -->
    <div class="categories-section">
      <div class="section-label">里程碑分类</div>
      <div
        v-for="category in categoryViews"
        :key="category.id"
        class="category-card"
      >
        <button
          class="category-header"
          @click="toggleCategory(category.id)"
        >
          <span class="category-icon">{{ category.icon }}</span>
          <span class="category-name">{{ category.name }}</span>
          <span class="category-count">{{ category.achievedCount }}/{{ category.totalCount }}</span>
          <span class="category-toggle" :class="{ expanded: category.expanded }">
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </button>
        <div v-if="category.expanded" class="category-body">
          <div class="milestone-grid">
            <MilestoneChip
              v-for="m in category.allItems"
              :key="m.id"
              :icon="m.icon"
              :label="m.label"
              :tier="m.tier"
              :achieved="m.achieved"
              :progress="m.progress"
              :is-next="m.isNext"
              :tier-label="tierLabels[m.tier]"
            />
          </div>
        </div>
        <!-- collapsed preview: show last 3 achieved + 1 next -->
        <div v-else class="category-preview">
          <MilestoneChip
            v-for="m in category.previewItems"
            :key="m.id"
            :icon="m.icon"
            :label="m.label"
            :tier="m.tier"
            :achieved="m.achieved"
            :progress="m.progress"
            :is-next="m.isNext"
            :tier-label="tierLabels[m.tier]"
          />
          <span v-if="category.hiddenCount > 0" class="more-hint">+{{ category.hiddenCount }} 更多</span>
        </div>
      </div>
    </div>

    <!-- ====== 4. Achievement Wall ====== -->
    <div v-if="unlockedAchievements.length > 0" class="achievement-section">
      <div class="section-label">成就</div>
      <div class="achievement-grid">
        <div
          v-for="ach in unlockedAchievements"
          :key="ach.id"
          class="achievement-card"
          :class="[`tier-${ach.tier}`, { 'custom-ach': ach._custom }]"
        >
          <button
            v-if="ach._custom"
            class="btn-del-ach"
            title="删除此成就"
            @click="deleteCustomAchievement(ach.id)"
          >×</button>
          <span class="ach-icon">{{ ach.icon }}</span>
          <span class="ach-title">{{ ach.title }}</span>
          <span class="ach-desc">{{ ach.description }}</span>
        </div>
      </div>

      <!-- locked toggle -->
      <button
        v-if="lockedAchievements.length > 0"
        class="locked-toggle"
        @click="showLocked = !showLocked"
      >
        <span>🔒 未获得 ({{ lockedAchievements.length }})</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          :class="{ rotated: showLocked }"
        ><path d="M2 3l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div v-if="showLocked" class="achievement-grid locked">
        <div
          v-for="ach in lockedAchievements"
          :key="ach.id"
          class="achievement-card locked-card"
          :class="[`tier-${ach.tier}`, { 'custom-ach': ach._custom }]"
        >
          <button
            v-if="ach._custom"
            class="btn-del-ach"
            title="删除此成就"
            @click="deleteCustomAchievement(ach.id)"
          >×</button>
          <span class="ach-icon">🔒</span>
          <span class="ach-title">{{ ach.title }}</span>
          <span class="ach-desc">{{ ach.description }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from "vue"
import type { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import MilestoneChip from "./MilestoneChip.vue"
import MilestoneRuleEditor from "./MilestoneRuleEditor.vue"
import {
  milestoneTargetOfWithRules,
} from "../utils/milestones"
import {
  MILESTONE_LABEL_FNS,
  MILESTONE_TYPES,
  STORAGE_KEY_CUSTOM_ACHIEVEMENTS,
  STORAGE_KEY_MILESTONE_RULES,
} from "../types/milestoneRules"
import type { CustomAchievement } from "../types/milestoneRules"

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

const showLocked = ref(false)
const showRuleEditor = ref(false)
const customRules = ref<Record<string, number[]>>({})

onMounted(async () => {
  if (props.plugin) {
    const storage = new PluginStorage(props.plugin)
    const data = await storage.load<Record<string, number[]>>(STORAGE_KEY_MILESTONE_RULES)
    if (data) customRules.value = data
    const achData = await storage.load<CustomAchievement[]>(STORAGE_KEY_CUSTOM_ACHIEVEMENTS)
    if (achData) customAchievements.value = achData
  }
})

async function onSaveRules(rules: Record<string, number[]>) {
  customRules.value = rules
  showRuleEditor.value = false
  if (props.plugin) {
    const storage = new PluginStorage(props.plugin)
    await storage.save(STORAGE_KEY_MILESTONE_RULES, rules)
  }
}

// ===== Custom Achievements =====
const customAchievements = ref<CustomAchievement[]>([])

function onAddAchievement(achievement: CustomAchievement) {
  customAchievements.value.push(achievement)
  saveCustomAchievements()
}

function onDeleteAchievement(id: string) {
  customAchievements.value = customAchievements.value.filter((a) => a.id !== id)
  saveCustomAchievements()
}

function deleteCustomAchievement(id: string) {
  onDeleteAchievement(id)
}

async function saveCustomAchievements() {
  if (props.plugin) {
    const storage = new PluginStorage(props.plugin)
    await storage.save(STORAGE_KEY_CUSTOM_ACHIEVEMENTS, customAchievements.value)
  }
}
const expandedCategories = ref<Set<string>>(new Set())

const tierLabels: Record<Tier, string> = {
  common: props.i18n.tierCommon || "普通",
  rare: props.i18n.tierRare || "稀有",
  epic: props.i18n.tierEpic || "史诗",
  legendary: props.i18n.tierLegendary || "传说",
}

const categories: CategoryDef[] = [
  {
    id: "writing",
    icon: "✍️",
    name: props.i18n.catWriting || "写作达人",
    types: ["notes", "words", "notebooks"],
  },
  {
    id: "knowledge",
    icon: "🧠",
    name: props.i18n.catKnowledge || "知识管理",
    types: ["tags", "backlinks"],
  },
  {
    id: "rich",
    icon: "📦",
    name: props.i18n.catRich || "内容丰富",
    types: ["blocks", "assets", "images", "code"],
  },
  {
    id: "persistence",
    icon: "🔥",
    name: props.i18n.catPersistence || "坚持不懈",
    types: ["streak", "activeDays"],
  },
]

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

// ===== 公式化无限里程碑（从 MILESTONE_TYPES 派生，消除数据源重复） =====
const TYPE_META = Object.fromEntries(
  MILESTONE_TYPES.map((t) => [
    t.key,
    { icon: t.icon, labelFn: MILESTONE_LABEL_FNS[t.key] ?? ((v: number) => `${v}`) },
  ]),
) as Record<string, { icon: string; labelFn: (v: number) => string }>

function tierOf(idx: number, total: number): Tier {
  const r = idx / total
  if (r < 0.4) return "common"
  if (r < 0.7) return "rare"
  if (r < 0.9) return "epic"
  return "legendary"
}

function generateMilestones(type: string, current: number, extra = 20): MilestoneDef[] {
  const meta = TYPE_META[type]
  if (!meta) return []
  const result: MilestoneDef[] = []
  const baseTarget = milestoneTargetOfWithRules(type, 1, customRules.value)
  if (!isFinite(baseTarget) || baseTarget <= 0) return result
  const upperBound = current + extra * baseTarget
  let n = 1
  while (n <= 200) {
    const target = milestoneTargetOfWithRules(type, n, customRules.value)
    if (!isFinite(target) || target > upperBound) break
    result.push({
      id: `${type}-${n}`,
      icon: meta.icon,
      label: meta.labelFn(target),
      target,
      type,
      tier: tierOf(n - 1, 50),
    })
    n++
  }
  return result
}

const allMilestones = computed((): MilestoneDef[] => {
  const result: MilestoneDef[] = []
  for (const type of Object.keys(TYPE_META)) {
    result.push(...generateMilestones(type, statCounts.value[type] ?? 0))
  }
  return result
})

// ===== 等级系统 =====
const TIER_POINTS: Record<Tier, number> = {
  common: 3,
  rare: 8,
  epic: 15,
  legendary: 30,
}

function pointsForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.floor(28 * (level - 1) * Math.sqrt(level - 1))
}

const TIER_SIZE = 20

const BASE_TITLES = [
  { icon: "✏️", title: "笔墨新秀" },
  { icon: "📝", title: "码字练手" },
  { icon: "📒", title: "日记录者" },
  { icon: "🖊️", title: "摘抄达人" },
  { icon: "📖", title: "读书笔记" },
  { icon: "📚", title: "知识收集" },
  { icon: "🗂️", title: "整理能手" },
  { icon: "🧩", title: "归档达人" },
  { icon: "🔗", title: "双链编织" },
  { icon: "🏷️", title: "标签管理" },
  { icon: "🧠", title: "思维导图" },
  { icon: "📐", title: "结构设计" },
  { icon: "🔍", title: "深度检索" },
  { icon: "💡", title: "灵感捕手" },
  { icon: "🎯", title: "精准表达" },
  { icon: "✨", title: "妙笔生花" },
  { icon: "📜", title: "长篇大论" },
  { icon: "🔥", title: "笔耕不辍" },
  { icon: "💎", title: "字字珠玑" },
  { icon: "🏆", title: "万字长城" },
]

const TIER_PREFIXES = [
  "初窥·", "入门·", "进阶·", "精通·", "熟手·",
  "高手·", "精英·", "大师·", "传说·", "神话·",
  "超凡·", "入圣·", "登峰·", "造极·", "通天·",
  "破界·", "无双·", "绝世·", "独步·", "万古·",
  "永恒·", "不朽·", "天道·", "轮回·", "混沌·",
  "鸿蒙·", "太初·", "无极·", "至尊·", "超越·",
]

function getLevelInfo(level: number) {
  const tierIdx = Math.min(Math.floor((level - 1) / TIER_SIZE), TIER_PREFIXES.length - 1)
  const stage = (level - 1) % TIER_SIZE
  const base = BASE_TITLES[stage % BASE_TITLES.length]
  return {
    icon: base.icon,
    title: TIER_PREFIXES[tierIdx] + base.title,
  }
}

// ===== 特殊成就卡片 =====
interface AchievementDef {
  id: string
  icon: string
  title: string
  description: string
  tier: Tier
  check: () => boolean
  _custom?: boolean
}

const milestonesWithState = computed(() => {
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
interface CategoryView {
  id: string
  icon: string
  name: string
  expanded: boolean
  achievedCount: number
  totalCount: number
  allItems: typeof milestonesWithState.value
  previewItems: typeof milestonesWithState.value
  hiddenCount: number
}

const categoryViews = computed<CategoryView[]>(() => {
  return categories.map((cat) => {
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
    .reduce((sum, m) => sum + TIER_POINTS[m.tier], 0)
})

const currentLevel = computed(() => {
  let level = 1
  while (pointsForLevel(level + 1) <= totalPoints.value) level++
  const info = getLevelInfo(level)
  return {
    level,
    ...info,
    pointsRequired: pointsForLevel(level),
  }
})

const nextLevel = computed(() => {
  const lv = currentLevel.value.level + 1
  const info = getLevelInfo(lv)
  return {
    level: lv,
    ...info,
    pointsRequired: pointsForLevel(lv),
  }
})

const levelProgress = computed(() => {
  const cur = currentLevel.value.pointsRequired
  const nxt = nextLevel.value.pointsRequired
  const range = nxt - cur
  if (range <= 0) return 100
  return Math.min(((totalPoints.value - cur) / range) * 100, 100)
})

// ===== 阈值型成就配置（数据驱动，替代 48 个硬编码对象） =====
interface ThresholdItem { v: number; icon: string; title: string; desc: string; tier: Tier }
interface ThresholdGroup { prefix: string; type: string; items: ThresholdItem[] }

const THRESHOLD_ACHIEVEMENTS: ThresholdGroup[] = [
  { prefix: "ach", type: "notes", items: [
    { v: 1, icon: "🌟", title: "破冰之旅", desc: "创建第一篇笔记", tier: "common" },
    { v: 30, icon: "🌿", title: "小有积累", desc: "累计30篇笔记", tier: "common" },
    { v: 100, icon: "🌳", title: "百篇大关", desc: "累计100篇笔记", tier: "rare" },
    { v: 300, icon: "🌲", title: "三百篇成集", desc: "累计300篇笔记", tier: "rare" },
    { v: 500, icon: "⛰️", title: "五百篇山丘", desc: "累计500篇笔记", tier: "epic" },
    { v: 1000, icon: "🏛️", title: "千篇一律", desc: "累计1000篇笔记", tier: "epic" },
    { v: 3000, icon: "🏰", title: "三千篇帝国", desc: "累计3000篇笔记", tier: "legendary" },
  ]},
  { prefix: "ach", type: "blocks", items: [
    { v: 100, icon: "🧱", title: "积累起步", desc: "累计100个内容块", tier: "common" },
    { v: 500, icon: "🧱", title: "五百块基石", desc: "累计500个内容块", tier: "common" },
    { v: 2000, icon: "🏗️", title: "内容大厦", desc: "累计2000个内容块", tier: "rare" },
    { v: 5000, icon: "🏭", title: "内容工厂", desc: "累计5000个内容块", tier: "rare" },
    { v: 10000, icon: "🌆", title: "万块之城", desc: "累计10000个内容块", tier: "epic" },
    { v: 30000, icon: "🏙️", title: "三万块都市", desc: "累计30000个内容块", tier: "legendary" },
  ]},
  { prefix: "ach", type: "words", items: [
    { v: 10000, icon: "✏️", title: "万字起步", desc: "累计写作1万字", tier: "common" },
    { v: 50000, icon: "📝", title: "五万字小成", desc: "累计写作5万字", tier: "common" },
    { v: 100000, icon: "📋", title: "十万字成书", desc: "累计写作10万字", tier: "rare" },
    { v: 300000, icon: "📚", title: "三十万字著述", desc: "累计写作30万字", tier: "rare" },
    { v: 1000000, icon: "🎓", title: "百万字巨著", desc: "累计写作100万字", tier: "epic" },
    { v: 3000000, icon: "🏆", title: "三百万字殿堂", desc: "累计写作300万字", tier: "epic" },
    { v: 10000000, icon: "👑", title: "千万字传说", desc: "累计写作1000万字", tier: "legendary" },
  ]},
  { prefix: "ach", type: "notebooks", items: [
    { v: 1, icon: "📓", title: "知识启航", desc: "创建第一个笔记本", tier: "common" },
    { v: 5, icon: "📔", title: "知识花园", desc: "拥有5个笔记本", tier: "common" },
    { v: 10, icon: "📚", title: "知识殿堂", desc: "拥有10个笔记本", tier: "rare" },
    { v: 20, icon: "🏛️", title: "知识帝国", desc: "拥有20个笔记本", tier: "epic" },
  ]},
  { prefix: "ach", type: "streak", items: [
    { v: 3, icon: "🔥", title: "三天打鱼", desc: "连续写作3天", tier: "common" },
    { v: 7, icon: "⚡", title: "一周坚持", desc: "连续写作7天", tier: "common" },
    { v: 14, icon: "💫", title: "两周不辍", desc: "连续写作14天", tier: "rare" },
    { v: 30, icon: "🌟", title: "月度坚持", desc: "连续写作30天", tier: "rare" },
    { v: 60, icon: "🚀", title: "双月毅力", desc: "连续写作60天", tier: "epic" },
    { v: 100, icon: "💎", title: "百日如一", desc: "连续写作100天", tier: "epic" },
    { v: 200, icon: "🌈", title: "两百日征程", desc: "连续写作200天", tier: "legendary" },
    { v: 365, icon: "👑", title: "年度传奇", desc: "连续写作365天", tier: "legendary" },
  ]},
  { prefix: "ach", type: "activeDays", items: [
    { v: 30, icon: "📅", title: "月度活跃", desc: "累计活跃30天", tier: "common" },
    { v: 100, icon: "📆", title: "百日活跃", desc: "累计活跃100天", tier: "rare" },
    { v: 365, icon: "🗓️", title: "年度活跃", desc: "累计活跃365天", tier: "epic" },
  ]},
  { prefix: "ach", type: "tags", items: [
    { v: 1, icon: "🏷️", title: "标签初体验", desc: "使用第一个标签", tier: "common" },
    { v: 10, icon: "🏷️", title: "标签入门", desc: "使用10个标签", tier: "common" },
    { v: 50, icon: "🔖", title: "标签达人", desc: "使用50个标签", tier: "rare" },
  ]},
  { prefix: "ach", type: "backlinks", items: [
    { v: 1, icon: "🔗", title: "链接世界", desc: "建立第一条双链", tier: "common" },
    { v: 100, icon: "🔗", title: "知识织网", desc: "建立100条双链", tier: "common" },
    { v: 500, icon: "⛓️", title: "知识网络", desc: "建立500条双链", tier: "rare" },
    { v: 1000, icon: "🌐", title: "知识图谱", desc: "建立1000条双链", tier: "epic" },
  ]},
  { prefix: "ach", type: "assets", items: [
    { v: 1, icon: "📁", title: "资源收集者", desc: "添加第一个附件", tier: "common" },
    { v: 30, icon: "📂", title: "资源小仓", desc: "积累30个附件", tier: "common" },
    { v: 100, icon: "💼", title: "资源宝库", desc: "积累100个附件", tier: "rare" },
  ]},
  { prefix: "ach", type: "images", items: [
    { v: 50, icon: "🖼️", title: "图片收藏家", desc: "积累50张图片", tier: "common" },
    { v: 200, icon: "📷", title: "影像达人", desc: "积累200张图片", tier: "rare" },
    { v: 1000, icon: "🎨", title: "万图之王", desc: "积累1000张图片", tier: "epic" },
  ]},
  { prefix: "ach", type: "code", items: [
    { v: 1, icon: "💻", title: "代码新秀", desc: "创建第一个代码块", tier: "common" },
    { v: 10, icon: "⌨️", title: "代码初试", desc: "创建10个代码块", tier: "common" },
    { v: 50, icon: "💻", title: "编程爱好者", desc: "创建50个代码块", tier: "rare" },
    { v: 200, icon: "🖥️", title: "代码工匠", desc: "创建200个代码块", tier: "epic" },
  ]},
]

/** 从阈值配置生成 AchievementDef 数组 */
function buildThresholdAchievements(): AchievementDef[] {
  const result: AchievementDef[] = []
  for (const group of THRESHOLD_ACHIEVEMENTS) {
    for (const item of group.items) {
      result.push({
        id: `${group.prefix}-${group.type}-${item.v}`,
        icon: item.icon,
        title: item.title,
        description: item.desc,
        tier: item.tier,
        check: () => (statCounts.value[group.type] ?? 0) >= item.v,
      })
    }
  }
  return result
}

// ===== 特殊（meta）成就 =====
const META_ACHIEVEMENTS: Omit<AchievementDef, "check">[] = [
  { id: "ach-all-common", icon: "⭐", title: "全面初成", description: "解锁全部普通里程碑", tier: "epic" },
  { id: "ach-half-all", icon: "🌟", title: "半程里程碑", description: "达成一半里程碑", tier: "epic" },
  { id: "ach-all-rare", icon: "💎", title: "稀有全解锁", description: "解锁全部稀有里程碑", tier: "legendary" },
  { id: "ach-level-10", icon: "🏆", title: "登峰造极", description: "达到 Lv.10", tier: "legendary" },
]

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
    _custom: true as any,
    check: () => (statCounts.value[a.type] ?? 0) >= a.threshold,
  }))
  const all: AchievementDef[] = [...buildThresholdAchievements(), ...metaDefs, ...customDefs]
  const unlocked: AchievementDef[] = []
  const locked: AchievementDef[] = []
  for (const a of all) {
    if (a.check()) unlocked.push(a)
    else locked.push(a)
  }
  return { unlocked, locked }
})

const unlockedAchievements = computed(() => achievementPartition.value.unlocked)
const lockedAchievements = computed(() => achievementPartition.value.locked)
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../styles/index.scss" as stats;

// ===== Panel =====
.milestones-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

// ===== 0. Top Bar =====
.milestones-top-bar {
  display: flex;
  justify-content: flex-end;
}

.btn-settings {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-family: stats.$font-mono;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: var(--b3-list-hover);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  svg {
    flex-shrink: 0;
    opacity: 0.7;
  }
}

// ===== 1. Hero Banner =====
.hero-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(var(--b3-theme-primary-rgb), 0.1) 0%, rgba(var(--b3-theme-primary-rgb), 0.03) 100%);
  border: 1px solid rgba(var(--b3-theme-primary-rgb), 0.15);
}

.hero-icon-wrap {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(var(--b3-theme-primary-rgb), 0.12);
  flex-shrink: 0;
}

.hero-icon {
  font-size: 28px;
  line-height: 1;
}

.hero-body {
  flex: 1;
  min-width: 0;
}

.hero-level {
  font-family: stats.$font-mono;
  font-size: 15px;
  font-weight: 800;
  color: var(--b3-theme-primary);
  letter-spacing: 0.02em;
}

.hero-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--b3-theme-on-surface);
  margin-top: 1px;
}

.hero-meta {
  font-family: stats.$font-mono;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  margin-top: 2px;
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.hero-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.hero-stat-num {
  font-family: stats.$font-mono;
  font-weight: 700;
  color: var(--b3-theme-primary);
}

.hero-stat-key {
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.hero-stat-divider {
  color: var(--b3-theme-on-surface);
  opacity: 0.2;
}

// Progress ring
.hero-progress {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}

.progress-ring {
  width: 56px;
  height: 56px;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: rgba(var(--b3-theme-on-surface-rgb), 0.08);
  stroke-width: 4;
}

.ring-fill {
  fill: none;
  stroke: var(--b3-theme-primary);
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dasharray 0.6s ease;
}

.ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: stats.$font-mono;
  font-size: 12px;
  font-weight: 700;
  color: var(--b3-theme-primary);
}

// ===== Level next row =====
.level-next-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
}

.level-next-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.45;
  white-space: nowrap;
  font-family: stats.$font-mono;
}

.level-bar {
  flex: 1;
  height: 3px;
  background: rgba(var(--b3-theme-on-surface-rgb), 0.06);
  border-radius: 4px;
  overflow: hidden;
}

.level-bar-fill {
  height: 100%;
  background: var(--b3-theme-primary);
  border-radius: 4px;
  transition: width 0.6s ease;
}

// ===== 2. Next Goal =====
.next-goal-card {
  padding: 12px;
  border-radius: 6px;
  background: rgba(var(--b3-theme-primary-rgb), 0.04);
  border: 1px dashed rgba(var(--b3-theme-primary-rgb), 0.2);
}

.next-goal-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.next-goal-prefix {
  font-family: stats.$font-mono;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--b3-theme-on-surface);
  opacity: 0.45;
}

.next-goal-percent {
  font-family: stats.$font-mono;
  font-size: 13px;
  font-weight: 700;
  color: var(--b3-theme-primary);
}

.next-goal-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.next-goal-icon {
  font-size: 20px;
}

.next-goal-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  font-family: stats.$font-mono;
}

.next-goal-bar {
  height: 6px;
  background: rgba(var(--b3-theme-primary-rgb), 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
}

.next-goal-bar-fill {
  height: 100%;
  background: var(--b3-theme-primary);
  border-radius: 4px;
  transition: width 0.6s ease;
}

.next-goal-encourage {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.55;
  font-style: italic;
}

// ===== 3. Categories =====
.categories-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-family: stats.$font-mono;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--b3-theme-on-surface);
  opacity: 0.45;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--b3-border-color);
}

.category-card {
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  overflow: hidden;
  background: var(--b3-theme-surface);

  &:hover {
    border-color: rgba(var(--b3-theme-primary-rgb), 0.3);
  }
}

.category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;

  &:hover {
    background: rgba(var(--b3-theme-on-surface-rgb), 0.03);
  }
}

.category-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.category-name {
  font-weight: 600;
  flex: 1;
  text-align: left;
}

.category-count {
  font-family: stats.$font-mono;
  font-size: 11px;
  color: var(--b3-theme-primary);
  opacity: 0.6;
}

.category-toggle {
  display: flex;
  align-items: center;
  color: var(--b3-theme-on-surface);
  opacity: 0.35;
  transition: transform 0.2s;

  &.expanded {
    transform: rotate(90deg);
  }
}

.category-body,
.category-preview {
  padding: 8px 12px 10px;
  border-top: 1px solid var(--b3-border-color);
}

// ===== Milestone chips grid =====
.milestone-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.category-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.more-hint {
  font-family: stats.$font-mono;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.35;
  padding: 4px 8px;
}

// ===== 4. Achievement Wall =====
.achievement-section {
  display: flex;
  flex-direction: column;
}

.achievement-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 6px;
  margin-top: 8px;

  &.locked {
    margin-top: 6px;
  }
}

.achievement-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  border-radius: 4px;
  text-align: center;
  position: relative;
  transition: transform 0.15s ease;

  &:hover {
    transform: translateY(-1px);
  }

  &.tier-common {
    background: rgba(stats.$color-success, 0.06);
    border: 1px solid rgba(stats.$color-success, 0.15);
  }

  &.tier-rare {
    background: rgba(var(--b3-theme-primary-rgb), 0.06);
    border: 1px solid rgba(var(--b3-theme-primary-rgb), 0.15);
  }

  &.tier-epic {
    background: linear-gradient(135deg, rgba(stats.$color-tier-epic, 0.08), rgba(var(--b3-theme-primary-rgb), 0.04));
    border: 1px solid rgba(stats.$color-tier-epic, 0.2);
  }

  &.tier-legendary {
    background: linear-gradient(135deg, rgba(stats.$color-tier-legendary, 0.1), rgba(234, 88, 12, 0.04));
    border: 1px solid rgba(stats.$color-tier-legendary, 0.3);
  }

  .ach-icon {
    font-size: 22px;
    margin-bottom: 4px;
  }

  .ach-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--b3-theme-on-surface);
    line-height: 1.3;
  }

  .ach-desc {
    font-size: 10px;
    color: var(--b3-theme-on-surface);
    opacity: 0.4;
    line-height: 1.3;
    margin-top: 2px;
  }

  &.locked-card {
    opacity: 0.35;
    filter: grayscale(0.5);

    .ach-icon { font-size: 18px; }
  }
}

.locked-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px;
  margin-top: 8px;
  border: 1px dashed var(--b3-border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 11px;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  svg {
    transition: transform 0.2s;

    &.rotated {
      transform: rotate(180deg);
    }
  }
}

// ===== Custom achievement card =====
.achievement-card.custom-ach {
  position: relative;
  padding-top: 14px;
}

.btn-del-ach {
  position: absolute;
  top: 2px;
  right: 4px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  opacity: 0.25;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  border-radius: 2px;
  padding: 0;

  &:hover {
    opacity: 1;
    color: var(--stat-color-danger, #cf222e);
    background: rgba(207, 34, 46, 0.08);
  }
}
</style>
