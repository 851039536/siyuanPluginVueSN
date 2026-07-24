<!-- 成就墙：分类/稀有度筛选 Tab + 已解锁网格 + 未获得折叠区，内部管理筛选状态 -->
<template>
  <div class="achievement-section">
    <div class="section-label">
      成就
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

    <div class="achievement-grid">
      <div
        v-for="ach in filteredUnlocked"
        :key="ach.id"
        class="achievement-card"
        :class="[`tier-${ach.tier}`, { 'custom-ach': ach._custom }]"
      >
        <button
          v-if="ach._custom"
          class="btn-del-ach"
          title="删除此成就"
          @click="emit('deleteCustom', ach.id)"
        >
          <IconWrapper
            name="close"
            :size="12"
          />
        </button>
        <IconWrapper
          class="ach-icon"
          :name="ach.icon as IconKey"
        />
        <span class="ach-title">{{ ach.title }}</span>
        <span class="ach-desc">{{ ach.description }}</span>
      </div>
    </div>

    <!-- locked toggle -->
    <button
      v-if="filteredLocked.length > 0"
      class="locked-toggle"
      @click="showLocked = !showLocked"
    >
      <span><IconWrapper
        name="pageLock"
        :size="12"
      /> 未获得 ({{ filteredLocked.length }})</span>
      <IconWrapper
        name="chevronDown"
        :size="10"
        :class="{ rotated: showLocked }"
      />
    </button>
    <div
      v-if="showLocked"
      class="achievement-grid locked"
    >
      <div
        v-for="ach in filteredLocked"
        :key="ach.id"
        class="achievement-card locked-card"
        :class="[`tier-${ach.tier}`, { 'custom-ach': ach._custom }]"
      >
        <button
          v-if="ach._custom"
          class="btn-del-ach"
          title="删除此成就"
          @click="emit('deleteCustom', ach.id)"
        >
          <IconWrapper
            name="close"
            :size="12"
          />
        </button>
        <IconWrapper
          class="ach-icon"
          name="pageLock"
          :size="18"
        />
        <span class="ach-title">{{ ach.title }}</span>
        <span class="ach-desc">{{ ach.description }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AchievementDef, Tier } from "../types/milestoneData"
import type { IconKey } from "@/config/icons"
import { computed, ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { ACH_CATEGORIES } from "../types/milestoneData"
import { getAchType, matchCategory, matchTier } from "../utils/achievements"

interface Props {
  unlocked: AchievementDef[]
  locked: AchievementDef[]
  tierLabels: Record<Tier, string>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  deleteCustom: [id: string]
}>()

const showLocked = ref(false)
const activeAchCategory = ref("all")
const activeAchTier = ref("all")

const achCategories = ACH_CATEGORIES

const achTiers = computed(() => [
  { id: "all", icon: "star", name: "全部" },
  { id: "common", icon: "star", name: props.tierLabels.common },
  { id: "rare", icon: "star", name: props.tierLabels.rare },
  { id: "epic", icon: "star", name: props.tierLabels.epic },
  { id: "legendary", icon: "star", name: props.tierLabels.legendary },
])

function matchFilters(ach: AchievementDef): boolean {
  return matchCategory(ach, activeAchCategory.value) && matchTier(ach, activeAchTier.value)
}

const filteredUnlocked = computed(() => props.unlocked.filter(matchFilters))
const filteredLocked = computed(() => props.locked.filter(matchFilters))

function getCategoryCount(catId: string): number {
  if (catId === "all") return props.unlocked.filter((a) => matchTier(a, activeAchTier.value)).length
  const cat = achCategories.find((c) => c.id === catId)
  if (!cat || !cat.types) return 0
  return props.unlocked.filter((a) => cat.types!.includes(getAchType(a)) && matchTier(a, activeAchTier.value)).length
}

function getTierCount(tierId: string): number {
  if (tierId === "all") return props.unlocked.filter((a) => matchCategory(a, activeAchCategory.value)).length
  return props.unlocked.filter((a) => a.tier === tierId && matchCategory(a, activeAchCategory.value)).length
}
</script>

<style scoped lang="scss">
@use "../styles/MilestonesCard.scss";
</style>
