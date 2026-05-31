<template>
  <div class="milestones-card">
    <div class="card-header">
      <span class="card-title">{{ i18n.milestones }}</span>
      <span class="header-badge">{{ achievedCount }}/{{ allMilestones.length }}</span>
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

const allMilestones: MilestoneDef[] = [
  // 笔记数
  { id: "n-100", icon: "🌱", label: "100篇", target: 100, type: "notes", tier: "common" },
  { id: "n-500", icon: "🌿", label: "500篇", target: 500, type: "notes", tier: "common" },
  { id: "n-1k", icon: "🌳", label: "1000篇", target: 1000, type: "notes", tier: "rare" },
  { id: "n-3k", icon: "🌲", label: "3000篇", target: 3000, type: "notes", tier: "rare" },
  { id: "n-5k", icon: "⛰️", label: "5000篇", target: 5000, type: "notes", tier: "epic" },
  { id: "n-10k", icon: "🏔️", label: "1万篇", target: 10000, type: "notes", tier: "legendary" },
  // 笔记本
  { id: "nb-3", icon: "📓", label: "3个笔记本", target: 3, type: "notebooks", tier: "common" },
  { id: "nb-5", icon: "📔", label: "5个笔记本", target: 5, type: "notebooks", tier: "common" },
  { id: "nb-10", icon: "📚", label: "10个笔记本", target: 10, type: "notebooks", tier: "rare" },
  { id: "nb-20", icon: "🏛️", label: "20个笔记本", target: 20, type: "notebooks", tier: "epic" },
  // 字数
  { id: "w-10w", icon: "📝", label: "10万字", target: 100000, type: "words", tier: "common" },
  { id: "w-50w", icon: "📚", label: "50万字", target: 500000, type: "words", tier: "common" },
  { id: "w-100w", icon: "🎓", label: "100万字", target: 1000000, type: "words", tier: "rare" },
  { id: "w-300w", icon: "📖", label: "300万字", target: 3000000, type: "words", tier: "rare" },
  { id: "w-500w", icon: "🏆", label: "500万字", target: 5000000, type: "words", tier: "epic" },
  { id: "w-1000w", icon: "👑", label: "1000万字", target: 10000000, type: "words", tier: "legendary" },
  // 代码块
  { id: "c-50", icon: "💻", label: "50个代码块", target: 50, type: "code", tier: "common" },
  { id: "c-200", icon: "⌨️", label: "200个代码块", target: 200, type: "code", tier: "rare" },
  { id: "c-1k", icon: "🖥️", label: "1000个代码块", target: 1000, type: "code", tier: "epic" },
  { id: "c-5k", icon: "🤖", label: "5000个代码块", target: 5000, type: "code", tier: "legendary" },
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
  // 连续写作天数
  { id: "s-3", icon: "🔥", label: "连续3天", target: 3, type: "streak", tier: "common" },
  { id: "s-7", icon: "⚡", label: "连续7天", target: 7, type: "streak", tier: "common" },
  { id: "s-14", icon: "💫", label: "连续14天", target: 14, type: "streak", tier: "rare" },
  { id: "s-30", icon: "🌟", label: "连续30天", target: 30, type: "streak", tier: "rare" },
  { id: "s-60", icon: "🚀", label: "连续60天", target: 60, type: "streak", tier: "epic" },
  { id: "s-100", icon: "💎", label: "连续100天", target: 100, type: "streak", tier: "epic" },
  { id: "s-365", icon: "👑", label: "连续1年", target: 365, type: "streak", tier: "legendary" },
  // 活跃天数
  { id: "d-30", icon: "📅", label: "活跃30天", target: 30, type: "activeDays", tier: "common" },
  { id: "d-100", icon: "📆", label: "活跃100天", target: 100, type: "activeDays", tier: "rare" },
  { id: "d-365", icon: "🗓️", label: "活跃1年", target: 365, type: "activeDays", tier: "epic" },
  { id: "d-730", icon: "🏅", label: "活跃2年", target: 730, type: "activeDays", tier: "legendary" },
]

// ===== 等级系统 =====
const TIER_POINTS: Record<Tier, number> = {
  common: 1,
  rare: 3,
  epic: 5,
  legendary: 10,
}

interface LevelDef {
  level: number
  title: string
  icon: string
  pointsRequired: number
}

const LEVEL_DEFS: LevelDef[] = [
  { level: 1, title: "新手写手", icon: "✏️", pointsRequired: 0 },
  { level: 2, title: "初露锋芒", icon: "📝", pointsRequired: 5 },
  { level: 3, title: "笔耕不辍", icon: "✍️", pointsRequired: 15 },
  { level: 4, title: "妙笔生花", icon: "🖊️", pointsRequired: 30 },
  { level: 5, title: "知识工匠", icon: "🔧", pointsRequired: 50 },
  { level: 6, title: "资深作者", icon: "📖", pointsRequired: 80 },
  { level: 7, title: "内容大师", icon: "🎓", pointsRequired: 120 },
  { level: 8, title: "知识大师", icon: "🧠", pointsRequired: 170 },
  { level: 9, title: "传奇学者", icon: "👑", pointsRequired: 230 },
  { level: 10, title: "思源之巅", icon: "🏆", pointsRequired: 300 },
]

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

// ===== 等级计算 =====
const totalPoints = computed(() => {
  return milestonesWithState.value
    .filter((m) => m.achieved)
    .reduce((sum, m) => sum + TIER_POINTS[m.tier], 0)
})

const currentLevel = computed(() => {
  let lvl = LEVEL_DEFS[0]
  for (const def of LEVEL_DEFS) {
    if (totalPoints.value >= def.pointsRequired) {
      lvl = def
    } else {
      break
    }
  }
  return lvl
})

const nextLevel = computed(() => {
  const idx = LEVEL_DEFS.findIndex((d) => d.level === currentLevel.value.level)
  return idx < LEVEL_DEFS.length - 1 ? LEVEL_DEFS[idx + 1] : null
})

const levelProgress = computed(() => {
  if (!nextLevel.value) return 100
  const cur = currentLevel.value.pointsRequired
  const nxt = nextLevel.value.pointsRequired
  const range = nxt - cur
  if (range <= 0) return 100
  return Math.min(((totalPoints.value - cur) / range) * 100, 100)
})

// ===== 特殊成就卡片 =====
const achievementDefs = computed<AchievementDef[]>(() => [
  {
    id: "ach-first-note",
    icon: "🌟",
    title: "破冰之旅",
    description: "创建第一篇笔记",
    tier: "common",
    check: () => props.totalNotes >= 1,
  },
  {
    id: "ach-100-notes",
    icon: "📚",
    title: "百篇大关",
    description: "累计100篇笔记",
    tier: "rare",
    check: () => props.totalNotes >= 100,
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
    id: "ach-first-notebook",
    icon: "📓",
    title: "知识启航",
    description: "创建第一个笔记本",
    tier: "common",
    check: () => props.notebookCount >= 1,
  },
  {
    id: "ach-10-notebooks",
    icon: "📚",
    title: "知识花园",
    description: "拥有10个笔记本",
    tier: "rare",
    check: () => props.notebookCount >= 10,
  },
  {
    id: "ach-10w-words",
    icon: "📝",
    title: "十万字成书",
    description: "累计写作10万字",
    tier: "common",
    check: () => props.totalWords >= 100000,
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
    id: "ach-1000w-words",
    icon: "👑",
    title: "千万字传说",
    description: "累计写作1000万字",
    tier: "legendary",
    check: () => props.totalWords >= 10000000,
  },
  {
    id: "ach-streak-7",
    icon: "🔥",
    title: "一周坚持",
    description: "连续写作7天",
    tier: "common",
    check: () => props.writingStreak >= 7,
  },
  {
    id: "ach-streak-30",
    icon: "⚡",
    title: "月度坚持",
    description: "连续写作30天",
    tier: "rare",
    check: () => props.writingStreak >= 30,
  },
  {
    id: "ach-streak-365",
    icon: "👑",
    title: "年度传奇",
    description: "连续写作365天",
    tier: "legendary",
    check: () => props.writingStreak >= 365,
  },
  {
    id: "ach-50-tags",
    icon: "🏷️",
    title: "标签达人",
    description: "使用50个标签",
    tier: "common",
    check: () => props.totalTags >= 50,
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
    id: "ach-100-assets",
    icon: "📁",
    title: "资源宝库",
    description: "积累100个附件",
    tier: "common",
    check: () => props.totalAssets >= 100,
  },
  {
    id: "ach-50-code",
    icon: "💻",
    title: "代码新秀",
    description: "创建50个代码块",
    tier: "common",
    check: () => props.codeBlocks >= 50,
  },
  {
    id: "ach-all-common",
    icon: "⭐",
    title: "全面初成",
    description: "解锁全部普通里程碑",
    tier: "epic",
    check: () => {
      const commonMilestones = allMilestones.filter((m) => m.tier === "common")
      return commonMilestones.every((m) => getCurrent(m.type) >= m.target)
    },
  },
  {
    id: "ach-half-all",
    icon: "🌟",
    title: "半程里程碑",
    description: "达成一半里程碑",
    tier: "epic",
    check: () => achievedCount.value >= allMilestones.length / 2,
  },
  {
    id: "ach-max-level",
    icon: "🏆",
    title: "登峰造极",
    description: "达到最高等级",
    tier: "legendary",
    check: () => currentLevel.value.level >= LEVEL_DEFS.length,
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
</style>
