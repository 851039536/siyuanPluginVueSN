<template>
  <div class="milestones-card">
    <div class="card-header">
      <span class="card-title">{{ i18n.milestones }}</span>
      <span class="header-badge">{{ achievedCount }}</span>
    </div>
    <div class="card-body">
      <!-- 等级显示 -->
      <div class="level-section">
        <div class="level-main">
          <span class="level-icon">{{ currentLevel.icon }}</span>
          <div class="level-info">
            <span class="level-title">Lv.{{ currentLevel.level }} {{ currentLevel.title }}</span>
            <span class="level-points">{{ totalPoints }} 成就点</span>
          </div>
          <span class="level-badge">{{ unlockedAchievements.length }}/{{ achievementDefs.length }}</span>
        </div>
        <div
          v-if="nextLevel"
          class="level-progress-wrap"
        >
          <div class="level-progress-bar">
            <div
              class="level-progress-fill"
              :style="{ width: `${levelProgress}%` }"
            ></div>
          </div>
          <span class="level-progress-label">距 Lv.{{ nextLevel.level }} {{ nextLevel.title }} {{ levelProgress.toFixed(0) }}%</span>
        </div>

        <!-- 等级之路 -->
        <button
          class="level-road-toggle"
          @click="showLevelRoad = !showLevelRoad"
        >
          <span>🗺️ 等级之路</span>
          <span class="toggle-arrow">{{ showLevelRoad ? '▲' : '▼' }}</span>
        </button>
        <div
          v-if="showLevelRoad"
          class="level-road"
        >
          <div
            v-for="tier in tierRoad"
            :key="tier.idx"
            :class="['road-item', tier.status]"
          >
            <span class="road-icon">{{ tier.status === 'completed' ? '✅' : tier.status === 'current' ? '📍' : '🔒' }}</span>
            <span class="road-prefix">{{ tier.prefix }}</span>
            <span class="road-range">Lv.{{ tier.startLv }}-{{ tier.endLv }}</span>
            <div class="road-bar-track">
              <div
                class="road-bar-fill"
                :style="{ width: `${tier.progress}%` }"
              ></div>
            </div>
            <span class="road-percent">{{ tier.progress }}%</span>
          </div>
        </div>
      </div>

      <!-- 特殊成就卡片 -->
      <div
        v-if="unlockedAchievements.length > 0"
        class="achievements-section"
      >
        <div class="achievements-header">
          <span class="achievements-title">🎖️ 成就</span>
          <span class="achievements-count">{{ unlockedAchievements.length }}</span>
        </div>
        <div class="achievements-grid">
          <div
            v-for="ach in unlockedAchievements"
            :key="ach.id"
            class="achievement-card"
            :class="[`tier-${ach.tier}`]"
          >
            <span class="ach-icon">{{ ach.icon }}</span>
            <span class="ach-title">{{ ach.title }}</span>
            <span class="ach-desc">{{ ach.description }}</span>
            <span class="ach-tier-badge">{{ tierLabels[ach.tier] }}</span>
          </div>
        </div>

        <!-- 未获得成就 -->
        <div
          v-if="lockedAchievements.length > 0"
          class="locked-section"
        >
          <button
            class="locked-toggle"
            @click="showLocked = !showLocked"
          >
            <span>🔒 未获得 ({{ lockedAchievements.length }})</span>
            <span class="toggle-arrow">{{ showLocked ? '▲' : '▼' }}</span>
          </button>
          <div
            v-if="showLocked"
            class="achievements-grid locked-grid"
          >
            <div
              v-for="ach in lockedAchievements"
              :key="ach.id"
              class="achievement-card locked"
              :class="[`tier-${ach.tier}`]"
            >
              <span class="ach-icon">🔒</span>
              <span class="ach-title">{{ ach.title }}</span>
              <span class="ach-desc">{{ ach.description }}</span>
            </div>
          </div>
        </div>
      </div>

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
  notebookCount?: number
  codeBlocks?: number
  writingStreak?: number
  activeDays?: number
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
    catPersistence?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  totalNotes: 0,
  totalWords: 0,
  totalTags: 0,
  totalBacklinks: 0,
  totalAssets: 0,
  totalImages: 0,
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

const showAll = ref(false)
const showLocked = ref(false)

const tierLabels: Record<Tier, string> = {
  common: props.i18n.tierCommon || "普通",
  rare: props.i18n.tierRare || "稀有",
  epic: props.i18n.tierEpic || "史诗",
  legendary: props.i18n.tierLegendary || "传说",
}

const categories: CategoryDef[] = [
  { id: "writing", icon: "✍️", name: props.i18n.catWriting || "写作达人", types: ["notes", "notebooks"] },
  { id: "knowledge", icon: "🧠", name: props.i18n.catKnowledge || "知识管理", types: ["tags", "backlinks"] },
  { id: "rich", icon: "📦", name: props.i18n.catRich || "内容丰富", types: ["words", "assets", "images", "code"] },
  { id: "persistence", icon: "🔥", name: props.i18n.catPersistence || "坚持不懈", types: ["streak", "activeDays"] },
]

// ===== 公式化无限里程碑 =====
const TYPE_META: Record<string, { icon: string, labelFn: (v: number) => string }> = {
  notes: { icon: "📝", labelFn: v => v >= 10000 ? `${v / 10000}万篇` : `${v}篇` },
  notebooks: { icon: "📓", labelFn: v => `${v}个笔记本` },
  words: { icon: "✍️", labelFn: v => v >= 10000 ? `${v / 10000}万字` : `${v}字` },
  code: { icon: "💻", labelFn: v => `${v}个代码块` },
  tags: { icon: "🏷️", labelFn: v => `${v}个标签` },
  backlinks: { icon: "🔗", labelFn: v => `${v}条双链` },
  assets: { icon: "📁", labelFn: v => `${v}个附件` },
  images: { icon: "🖼️", labelFn: v => `${v}张图片` },
  streak: { icon: "🔥", labelFn: v => v >= 365 ? `${Math.floor(v / 365)}年` : `连续${v}天` },
  activeDays: { icon: "📅", labelFn: v => v >= 365 ? `活跃${Math.floor(v / 365)}年` : `活跃${v}天` },
}

// 公式：第 n 个里程碑的目标值（n 从 1 开始）
function targetOf(type: string, n: number): number {
  const g = Math.floor((n - 1) / 3) // 每 3 个为一档
  const r = (n - 1) % 3 // 档内序号 0,1,2
  switch (type) {
    case "notes": return 10 + g * 30 + r * 10
    case "notebooks": return n * 5
    case "words": return (g * 2 + r + 1) * 10000
    case "code": return 10 + (n - 1) * 30
    case "tags": return 10 + (n - 1) * 30
    case "backlinks": return 10 + g * 50 + r * 20
    case "assets": return 10 + g * 20 + r * 10
    case "images": return 10 + (n - 1) * 30
    case "streak": return Math.round(3 * Math.pow(1.5, n - 1))
    case "activeDays": return Math.round(10 * Math.pow(1.5, n - 1))
    default: return n * 10
  }
}

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
  let n = 1
  while (true) {
    const target = targetOf(type, n)
    if (target > current + extra * targetOf(type, 1)) break
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
  const counts: Record<string, number> = {
    notes: props.totalNotes,
    notebooks: props.notebookCount,
    words: props.totalWords,
    code: props.codeBlocks,
    tags: props.totalTags,
    backlinks: props.totalBacklinks,
    assets: props.totalAssets,
    images: props.totalImages,
    streak: props.writingStreak,
    activeDays: props.activeDays,
  }
  const result: MilestoneDef[] = []
  for (const type of Object.keys(TYPE_META)) {
    result.push(...generateMilestones(type, counts[type] ?? 0))
  }
  return result
})

// ===== 等级系统（公式化，无上限） =====
const TIER_POINTS: Record<Tier, number> = {
  common: 3,
  rare: 8,
  epic: 15,
  legendary: 30,
}

// 公式：第 n 级所需累计点数（n 从 1 开始，1 级 = 0 点）
function pointsForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.floor(28 * (level - 1) * Math.sqrt(level - 1))
}

// 公式化称号：每 20 级一个境界，每个境界内 20 个笔记称号循环，无限扩展
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
  "初窥·",
  "入门·",
  "进阶·",
  "精通·",
  "熟手·",
  "高手·",
  "精英·",
  "大师·",
  "传说·",
  "神话·",
  "超凡·",
  "入圣·",
  "登峰·",
  "造极·",
  "通天·",
  "破界·",
  "无双·",
  "绝世·",
  "独步·",
  "万古·",
  "永恒·",
  "不朽·",
  "天道·",
  "轮回·",
  "混沌·",
  "鸿蒙·",
  "太初·",
  "无极·",
  "至尊·",
  "超越·",
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
}

function getCurrent(type: string): number {
  const map: Record<string, number> = {
    notes: props.totalNotes,
    words: props.totalWords,
    tags: props.totalTags,
    backlinks: props.totalBacklinks,
    notebooks: props.notebookCount,
    code: props.codeBlocks,
    streak: props.writingStreak,
    activeDays: props.activeDays,
    assets: props.totalAssets,
    images: props.totalImages,
  }
  return map[type] ?? 0
}

const milestonesWithState = computed(() => {
  return allMilestones.value.map((m) => {
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
    || allMilestones.value.length > visibleCategories.value.reduce((s, c) => s + c.items.length, 0) + 3
})

const showAllText = computed(() =>
  (props.i18n.showAllMilestones || "显示全部 {count} 个里程碑")
    .replace("{count}", String(allMilestones.value.length)),
)

// ===== 等级计算（公式化，无上限） =====
const totalPoints = computed(() => {
  return milestonesWithState.value
    .filter((m) => m.achieved)
    .reduce((sum, m) => sum + TIER_POINTS[m.tier], 0)
})

const currentLevel = computed(() => {
  let level = 1
  while (pointsForLevel(level + 1) <= totalPoints.value) level++
  const info = getLevelInfo(level)
  return { level, ...info, pointsRequired: pointsForLevel(level) }
})

const nextLevel = computed(() => {
  const lv = currentLevel.value.level + 1
  const info = getLevelInfo(lv)
  return { level: lv, ...info, pointsRequired: pointsForLevel(lv) }
})

const levelProgress = computed(() => {
  const cur = currentLevel.value.pointsRequired
  const nxt = nextLevel.value.pointsRequired
  const range = nxt - cur
  if (range <= 0) return 100
  return Math.min(((totalPoints.value - cur) / range) * 100, 100)
})

// 等级之路：30 个境界的进度列表
const showLevelRoad = ref(false)

interface TierItem {
  idx: number
  prefix: string
  startLv: number
  endLv: number
  progress: number
  status: "completed" | "current" | "locked"
}

const tierRoad = computed<TierItem[]>(() => {
  const curLv = currentLevel.value.level
  return TIER_PREFIXES.map((prefix, idx) => {
    const startLv = idx * TIER_SIZE + 1
    const endLv = (idx + 1) * TIER_SIZE
    let progress: number
    let status: "completed" | "current" | "locked"
    if (curLv > endLv) {
      progress = 100
      status = "completed"
    } else if (curLv >= startLv) {
      progress = Math.round(((curLv - startLv + 1) / TIER_SIZE) * 100)
      status = "current"
    } else {
      progress = 0
      status = "locked"
    }
    return { idx, prefix: prefix.replace("·", ""), startLv, endLv, progress, status }
  })
})

// ===== 特殊成就卡片 =====
const achievementDefs = computed<AchievementDef[]>(() => [
  // ===== 起步 =====
  {
    id: "ach-first-note",
    icon: "🌟",
    title: "破冰之旅",
    description: "创建第一篇笔记",
    tier: "common",
    check: () => props.totalNotes >= 1,
  },
  {
    id: "ach-first-notebook",
    icon: "📓",
    title: "知识启航",
    description: "创建第一个笔记本",
    tier: "common",
    check: () => props.notebookCount >= 1,
  },
  {
    id: "ach-first-tag",
    icon: "🏷️",
    title: "标签初体验",
    description: "使用第一个标签",
    tier: "common",
    check: () => props.totalTags >= 1,
  },
  {
    id: "ach-first-link",
    icon: "🔗",
    title: "链接世界",
    description: "建立第一条双链",
    tier: "common",
    check: () => props.totalBacklinks >= 1,
  },
  {
    id: "ach-first-code",
    icon: "💻",
    title: "代码新秀",
    description: "创建第一个代码块",
    tier: "common",
    check: () => props.codeBlocks >= 1,
  },
  {
    id: "ach-first-asset",
    icon: "📁",
    title: "资源收集者",
    description: "添加第一个附件",
    tier: "common",
    check: () => props.totalAssets >= 1,
  },
  // ===== 笔记里程碑 =====
  {
    id: "ach-30-notes",
    icon: "🌿",
    title: "小有积累",
    description: "累计30篇笔记",
    tier: "common",
    check: () => props.totalNotes >= 30,
  },
  {
    id: "ach-100-notes",
    icon: "🌳",
    title: "百篇大关",
    description: "累计100篇笔记",
    tier: "rare",
    check: () => props.totalNotes >= 100,
  },
  {
    id: "ach-300-notes",
    icon: "🌲",
    title: "三百篇成集",
    description: "累计300篇笔记",
    tier: "rare",
    check: () => props.totalNotes >= 300,
  },
  {
    id: "ach-500-notes",
    icon: "⛰️",
    title: "五百篇山丘",
    description: "累计500篇笔记",
    tier: "epic",
    check: () => props.totalNotes >= 500,
  },
  {
    id: "ach-1000-notes",
    icon: "🏛️",
    title: "千篇一律",
    description: "累计1000篇笔记",
    tier: "epic",
    check: () => props.totalNotes >= 1000,
  },
  {
    id: "ach-3000-notes",
    icon: "🏰",
    title: "三千篇帝国",
    description: "累计3000篇笔记",
    tier: "legendary",
    check: () => props.totalNotes >= 3000,
  },
  // ===== 字数里程碑 =====
  {
    id: "ach-1w-words",
    icon: "✏️",
    title: "万字起步",
    description: "累计写作1万字",
    tier: "common",
    check: () => props.totalWords >= 10000,
  },
  {
    id: "ach-5w-words",
    icon: "📝",
    title: "五万字小成",
    description: "累计写作5万字",
    tier: "common",
    check: () => props.totalWords >= 50000,
  },
  {
    id: "ach-10w-words",
    icon: "📋",
    title: "十万字成书",
    description: "累计写作10万字",
    tier: "rare",
    check: () => props.totalWords >= 100000,
  },
  {
    id: "ach-30w-words",
    icon: "📚",
    title: "三十万字著述",
    description: "累计写作30万字",
    tier: "rare",
    check: () => props.totalWords >= 300000,
  },
  {
    id: "ach-100w-words",
    icon: "🎓",
    title: "百万字巨著",
    description: "累计写作100万字",
    tier: "epic",
    check: () => props.totalWords >= 1000000,
  },
  {
    id: "ach-300w-words",
    icon: "🏆",
    title: "三百万字殿堂",
    description: "累计写作300万字",
    tier: "epic",
    check: () => props.totalWords >= 3000000,
  },
  {
    id: "ach-1000w-words",
    icon: "👑",
    title: "千万字传说",
    description: "累计写作1000万字",
    tier: "legendary",
    check: () => props.totalWords >= 10000000,
  },
  // ===== 笔记本里程碑 =====
  {
    id: "ach-5-notebooks",
    icon: "📔",
    title: "知识花园",
    description: "拥有5个笔记本",
    tier: "common",
    check: () => props.notebookCount >= 5,
  },
  {
    id: "ach-10-notebooks",
    icon: "📚",
    title: "知识殿堂",
    description: "拥有10个笔记本",
    tier: "rare",
    check: () => props.notebookCount >= 10,
  },
  {
    id: "ach-20-notebooks",
    icon: "🏛️",
    title: "知识帝国",
    description: "拥有20个笔记本",
    tier: "epic",
    check: () => props.notebookCount >= 20,
  },
  // ===== 连续写作 =====
  {
    id: "ach-streak-3",
    icon: "🔥",
    title: "三天打鱼",
    description: "连续写作3天",
    tier: "common",
    check: () => props.writingStreak >= 3,
  },
  {
    id: "ach-streak-7",
    icon: "⚡",
    title: "一周坚持",
    description: "连续写作7天",
    tier: "common",
    check: () => props.writingStreak >= 7,
  },
  {
    id: "ach-streak-14",
    icon: "💫",
    title: "两周不辍",
    description: "连续写作14天",
    tier: "rare",
    check: () => props.writingStreak >= 14,
  },
  {
    id: "ach-streak-30",
    icon: "🌟",
    title: "月度坚持",
    description: "连续写作30天",
    tier: "rare",
    check: () => props.writingStreak >= 30,
  },
  {
    id: "ach-streak-60",
    icon: "🚀",
    title: "双月毅力",
    description: "连续写作60天",
    tier: "epic",
    check: () => props.writingStreak >= 60,
  },
  {
    id: "ach-streak-100",
    icon: "💎",
    title: "百日如一",
    description: "连续写作100天",
    tier: "epic",
    check: () => props.writingStreak >= 100,
  },
  {
    id: "ach-streak-200",
    icon: "🌈",
    title: "两百日征程",
    description: "连续写作200天",
    tier: "legendary",
    check: () => props.writingStreak >= 200,
  },
  {
    id: "ach-streak-365",
    icon: "👑",
    title: "年度传奇",
    description: "连续写作365天",
    tier: "legendary",
    check: () => props.writingStreak >= 365,
  },
  // ===== 活跃天数 =====
  {
    id: "ach-active-30",
    icon: "📅",
    title: "月度活跃",
    description: "累计活跃30天",
    tier: "common",
    check: () => props.activeDays >= 30,
  },
  {
    id: "ach-active-100",
    icon: "📆",
    title: "百日活跃",
    description: "累计活跃100天",
    tier: "rare",
    check: () => props.activeDays >= 100,
  },
  {
    id: "ach-active-365",
    icon: "🗓️",
    title: "年度活跃",
    description: "累计活跃365天",
    tier: "epic",
    check: () => props.activeDays >= 365,
  },
  // ===== 标签 & 双链 =====
  {
    id: "ach-10-tags",
    icon: "🏷️",
    title: "标签入门",
    description: "使用10个标签",
    tier: "common",
    check: () => props.totalTags >= 10,
  },
  {
    id: "ach-50-tags",
    icon: "🔖",
    title: "标签达人",
    description: "使用50个标签",
    tier: "rare",
    check: () => props.totalTags >= 50,
  },
  {
    id: "ach-100-backlinks",
    icon: "🔗",
    title: "知识织网",
    description: "建立100条双链",
    tier: "common",
    check: () => props.totalBacklinks >= 100,
  },
  {
    id: "ach-500-backlinks",
    icon: "⛓️",
    title: "知识网络",
    description: "建立500条双链",
    tier: "rare",
    check: () => props.totalBacklinks >= 500,
  },
  {
    id: "ach-1k-backlinks",
    icon: "🌐",
    title: "知识图谱",
    description: "建立1000条双链",
    tier: "epic",
    check: () => props.totalBacklinks >= 1000,
  },
  // ===== 附件 & 图片 =====
  {
    id: "ach-30-assets",
    icon: "📂",
    title: "资源小仓",
    description: "积累30个附件",
    tier: "common",
    check: () => props.totalAssets >= 30,
  },
  {
    id: "ach-100-assets",
    icon: "💼",
    title: "资源宝库",
    description: "积累100个附件",
    tier: "rare",
    check: () => props.totalAssets >= 100,
  },
  {
    id: "ach-50-images",
    icon: "🖼️",
    title: "图片收藏家",
    description: "积累50张图片",
    tier: "common",
    check: () => props.totalImages >= 50,
  },
  {
    id: "ach-200-images",
    icon: "📷",
    title: "影像达人",
    description: "积累200张图片",
    tier: "rare",
    check: () => props.totalImages >= 200,
  },
  {
    id: "ach-1k-images",
    icon: "🎨",
    title: "万图之王",
    description: "积累1000张图片",
    tier: "epic",
    check: () => props.totalImages >= 1000,
  },
  // ===== 代码块 =====
  {
    id: "ach-10-code",
    icon: "⌨️",
    title: "代码初试",
    description: "创建10个代码块",
    tier: "common",
    check: () => props.codeBlocks >= 10,
  },
  {
    id: "ach-50-code",
    icon: "💻",
    title: "编程爱好者",
    description: "创建50个代码块",
    tier: "rare",
    check: () => props.codeBlocks >= 50,
  },
  {
    id: "ach-200-code",
    icon: "🖥️",
    title: "代码工匠",
    description: "创建200个代码块",
    tier: "epic",
    check: () => props.codeBlocks >= 200,
  },
  // ===== 综合成就 =====
  {
    id: "ach-all-common",
    icon: "⭐",
    title: "全面初成",
    description: "解锁全部普通里程碑",
    tier: "epic",
    check: () => {
      const commonMilestones = allMilestones.value.filter((m) => m.tier === "common")
      return commonMilestones.every((m) => getCurrent(m.type) >= m.target)
    },
  },
  {
    id: "ach-half-all",
    icon: "🌟",
    title: "半程里程碑",
    description: "达成一半里程碑",
    tier: "epic",
    check: () => achievedCount.value >= allMilestones.value.length / 2,
  },
  {
    id: "ach-all-rare",
    icon: "💎",
    title: "稀有全解锁",
    description: "解锁全部稀有里程碑",
    tier: "legendary",
    check: () => {
      const rareMilestones = allMilestones.value.filter((m) => m.tier === "rare")
      return rareMilestones.every((m) => getCurrent(m.type) >= m.target)
    },
  },
  {
    id: "ach-level-10",
    icon: "🏆",
    title: "登峰造极",
    description: "达到 Lv.10",
    tier: "legendary",
    check: () => currentLevel.value.level >= 10,
  },
])

const unlockedAchievements = computed(() =>
  achievementDefs.value.filter((a) => a.check()),
)

const lockedAchievements = computed(() =>
  achievementDefs.value.filter((a) => !a.check()),
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

// ===== 等级系统 =====
.level-section {
  padding: 10px 12px;
  margin-bottom: 10px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(var(--b3-theme-primary-rgb), 0.08) 0%, rgba(var(--b3-theme-primary-rgb), 0.03) 100%);
  border: 1px solid rgba(var(--b3-theme-primary-rgb), 0.12);
}

.level-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.level-icon {
  font-size: 24px;
}

.level-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.level-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--b3-theme-primary);
  font-family: $font-heading;
}

.level-points {
  font-size: 9px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.level-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--b3-theme-primary);
  opacity: 0.6;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(var(--b3-theme-primary-rgb), 0.08);
}

.level-progress-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.level-progress-bar {
  flex: 1;
  height: 3px;
  background: rgba(var(--b3-theme-primary-rgb), 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.level-progress-fill {
  height: 100%;
  background: var(--b3-theme-primary);
  border-radius: 2px;
  transition: width 0.6s ease;
}

.level-progress-label {
  font-size: 8px;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  white-space: nowrap;
}

// ===== 特殊成就卡片 =====
.achievements-section {
  margin-bottom: 10px;
}

.achievements-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px dashed var(--b3-border-color);

  .achievements-title {
    font-size: 10px;
    font-weight: 700;
    color: var(--b3-theme-on-surface);
    opacity: 0.65;
  }

  .achievements-count {
    margin-left: auto;
    font-size: 9px;
    color: var(--b3-theme-primary);
    opacity: 0.5;
  }
}

.achievements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 6px;
}

.achievement-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 6px;
  border-radius: 8px;
  text-align: center;
  position: relative;
  transition: transform 0.15s ease;

  &:hover { transform: translateY(-1px); }

  &.tier-common {
    background: rgba(stats.$color-success, 0.06);
    border: 1px solid rgba(stats.$color-success, 0.15);
  }

  &.tier-rare {
    background: rgba(var(--b3-theme-primary-rgb), 0.08);
    border: 1px solid rgba(var(--b3-theme-primary-rgb), 0.15);
  }

  &.tier-epic {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(var(--b3-theme-primary-rgb), 0.06));
    border: 1px solid rgba(168, 85, 247, 0.2);
  }

  &.tier-legendary {
    background: linear-gradient(135deg, rgba(234, 179, 8, 0.12), rgba(234, 88, 12, 0.06));
    border: 1px solid rgba(234, 179, 8, 0.3);
  }

  .ach-icon {
    font-size: 20px;
    margin-bottom: 3px;
  }

  .ach-title {
    font-size: 10px;
    font-weight: 700;
    color: var(--b3-theme-on-surface);
    line-height: 1.3;
  }

  .ach-desc {
    font-size: 8px;
    color: var(--b3-theme-on-surface);
    opacity: 0.45;
    line-height: 1.3;
    margin-top: 1px;
  }

  .ach-tier-badge {
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

  &.tier-common .ach-tier-badge {
    background: rgba(stats.$color-success, 0.2);
    color: stats.$color-success;
  }

  &.tier-rare .ach-tier-badge {
    background: rgba(var(--b3-theme-primary-rgb), 0.2);
    color: var(--b3-theme-primary);
  }

  &.tier-epic .ach-tier-badge {
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
  }

  &.tier-legendary .ach-tier-badge {
    background: rgba(234, 179, 8, 0.25);
    color: #ca8a04;
  }

  &.locked {
    opacity: 0.4;
    filter: grayscale(0.6);

    .ach-icon { font-size: 16px; }
  }
}

.locked-section {
  margin-top: 8px;
}

.locked-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 5px 8px;
  border: 1px dashed var(--b3-border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 9px;
  opacity: 0.5;
  cursor: pointer;
  text-align: left;

  &:hover {
    opacity: 0.8;
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  .toggle-arrow {
    font-size: 8px;
  }
}

.locked-grid {
  margin-top: 6px;
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

// ========== 等级之路 ==========
.level-road-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  margin-top: 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--b3-theme-primary);
  }
}

.toggle-arrow {
  font-size: 10px;
  opacity: 0.5;
}

.level-road {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.road-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  transition: background 0.15s;

  &.current {
    background: rgba(var(--b3-theme-primary-rgb), 0.08);
    font-weight: 600;
    color: var(--b3-theme-primary);
  }

  &.completed {
    opacity: 0.55;
  }

  &.locked {
    opacity: 0.3;
  }
}

.road-icon {
  flex-shrink: 0;
  font-size: 10px;
}

.road-prefix {
  width: 36px;
  flex-shrink: 0;
  font-weight: 600;
}

.road-range {
  width: 70px;
  flex-shrink: 0;
  font-size: 10px;
  opacity: 0.5;
  font-family: monospace;
}

.road-bar-track {
  flex: 1;
  height: 4px;
  background: rgba(var(--b3-theme-on-surface-rgb), 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.road-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--b3-theme-primary);
  transition: width 0.3s ease;
}

.road-percent {
  width: 32px;
  text-align: right;
  font-size: 10px;
  opacity: 0.5;
  flex-shrink: 0;
}
</style>
