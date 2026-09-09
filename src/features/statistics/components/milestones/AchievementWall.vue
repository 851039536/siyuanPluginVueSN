<!-- 成就墙：分类/稀有度筛选 Tab + 已解锁网格 + 未获得折叠区，内部管理筛选状态 -->
<template>
  <div class="achievement-section">
    <!-- 区块标题："成就" -->
    <div class="section-label">
      {{ i18n.achievementsLabel }}
    </div>

    <!-- 成就分类 Tab -->
    <div class="ach-category-bar">
      <button
        v-for="cat in achCategories"
        :key="cat.id"
        class="ach-category-tab"
        :class="{ active: activeAchCategory === cat.id }"
        @click="activeAchCategory = cat.id"
      >
        <IconWrapper
          class="ach-cat-icon"
          :name="cat.icon as IconKey"
        />
        <span class="ach-cat-name">{{ cat.name }}</span>
        <span class="ach-cat-count">{{ getCategoryCount(cat.id) }}</span>
      </button>
    </div>

    <!-- 稀有度筛选 Tab -->
    <div class="ach-category-bar ach-tier-bar">
      <button
        v-for="tier in achTiers"
        :key="tier.id"
        class="ach-category-tab ach-tier-tab"
        :class="{
          active: activeAchTier === tier.id,
          [`tier-active-${tier.id}`]: activeAchTier === tier.id,
        }"
        @click="activeAchTier = tier.id"
      >
        <IconWrapper
          class="ach-cat-icon"
          :name="tier.icon as IconKey"
        />
        <span class="ach-cat-name">{{ tier.name }}</span>
        <span class="ach-cat-count">{{ getTierCount(tier.id) }}</span>
      </button>
    </div>

    <!-- 已解锁网格 -->
    <div class="achievement-grid">
      <AchievementCard
        v-for="ach in filteredUnlocked"
        :key="ach.id"
        :ach="ach"
        :i18n="i18n"
        @delete="onDeleteCustom"
      />
    </div>

    <!-- 未获得折叠开关 -->
    <button
      v-if="filteredLocked.length > 0"
      class="locked-toggle"
      @click="showLocked = !showLocked"
    >
      <!-- 折叠按钮："未获得 (N)" -->
      <span><IconWrapper
        name="pageLock"
        :size="12"
      /> {{ i18n.lockedLabel }} ({{ filteredLocked.length }})</span>
      <IconWrapper
        name="chevronDown"
        :size="10"
        :class="{ rotated: showLocked }"
      />
    </button>
    <!-- 未获得折叠网格（locked 态由 AchievementCard 统一渲染） -->
    <div
      v-if="showLocked && filteredLocked.length > 0"
      class="achievement-grid locked"
    >
      <AchievementCard
        v-for="ach in filteredLocked"
        :key="ach.id"
        :ach="ach"
        locked
        :i18n="i18n"
        @delete="onDeleteCustom"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// 成就墙：分类/稀有度双 Tab 筛选 + 解锁/未获得网格（卡片复用 AchievementCard 子组件）
import type { AchievementDef, Tier } from "../../types/milestoneData"
import type { IconKey } from "@/config/icons"
import { computed, ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import AchievementCard from "./AchievementCard.vue"
import { ACH_CATEGORIES } from "../../types/milestoneData"
import { matchCategory, matchTier } from "../../utils/achievements"

interface Props {
  unlocked: AchievementDef[]
  locked: AchievementDef[]
  tierLabels: Record<Tier, string>
  i18n: Record<string, any>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  deleteCustom: [id: string]
}>()

const showLocked = ref(false)
const activeAchCategory = ref("all")
const activeAchTier = ref("all")

// 分类 Tab：i18nKey → 文案（catAll/catMeta 等键）
const achCategories = computed(() =>
  ACH_CATEGORIES.map((cat) => ({
    ...cat,
    name: props.i18n[cat.i18nKey] ?? cat.i18nKey,
  })),
)

// 稀有度筛选 Tab："全部" + 由 tierLabels 派生的四级稀有度（避免重复枚举 tier id）
const achTiers = computed(() => [
  // Tab 名："全部"
  { id: "all", icon: "star", name: props.i18n.tierAll },
  ...Object.entries(props.tierLabels).map(([id, name]) => ({
    id,
    icon: "star",
    name,
  })),
])

function matchFilters(ach: AchievementDef): boolean {
  return matchCategory(ach, activeAchCategory.value) && matchTier(ach, activeAchTier.value)
}

const filteredUnlocked = computed(() => props.unlocked.filter(matchFilters))
const filteredLocked = computed(() => props.locked.filter(matchFilters))

/** 分类 Tab 角标：该分类下（叠加当前稀有度筛选）的已解锁数 */
function getCategoryCount(catId: string): number {
  return props.unlocked.filter((a) => matchCategory(a, catId) && matchTier(a, activeAchTier.value)).length
}

/** 稀有度 Tab 角标：该稀有度下（叠加当前分类筛选）的已解锁数 */
function getTierCount(tierId: string): number {
  return props.unlocked.filter((a) => matchTier(a, tierId) && matchCategory(a, activeAchCategory.value)).length
}

function onDeleteCustom(id: string) {
  // 删除不可撤销，先经原生确认（与自定义成就管理删除行为一致）
  if (!window.confirm(props.i18n.confirmDeleteAchievement)) return
  emit("deleteCustom", id)
}
</script>

<style scoped lang="scss">
@use "../../styles/MilestonesCard.scss";
@use '../../styles/index.scss' as stats;
</style>
