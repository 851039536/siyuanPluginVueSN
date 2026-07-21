<!-- 技能学习 - 学习统计视图（练习覆盖/正确率/分布） -->
<template>
  <div class="stats-view">
    <!-- 概览卡片 -->
    <div class="stats-view__summary">
      <div class="stats-view__stat">
        <div class="stats-view__stat-value">
          {{ cards.length }}
        </div>
        <div class="stats-view__stat-label">
          {{ t.totalCards }}
        </div>
      </div>
      <div class="stats-view__stat">
        <div class="stats-view__stat-value">
          {{ practicedCount }}
        </div>
        <div class="stats-view__stat-label">
          {{ t.practicedCards }}
        </div>
      </div>
      <div class="stats-view__stat">
        <div class="stats-view__stat-value stats-view__stat-value--accent">
          {{ dueCount }}
        </div>
        <div class="stats-view__stat-label">
          {{ t.dueForReview || '待复习' }}
        </div>
      </div>
    </div>

    <!-- 练习进度环 + 正确率环 -->
    <div
      v-if="cards.length > 0"
      class="stats-view__rings-row"
    >
      <ProgressRing
        :title="t.practiceProgress || '练习覆盖'"
        :pct="practicedPct"
        :current="practicedCount"
        :total="cards.length"
        stroke-color="var(--b3-theme-primary)"
      />
      <ProgressRing
        v-if="practicedCount > 0"
        :title="t.accuracyRate || '正确率'"
        :pct="accuracyPct"
        :current="totalCorrect"
        :total="totalAttempts"
        :stroke-color="accuracyColor"
      />
    </div>

    <!-- 对错分布条 -->
    <div
      v-if="practicedCount > 0"
      class="stats-view__section"
    >
      <div class="stats-view__section-title">
        {{ t.accuracyRate || '正确率' }} {{ t.difficulty || '分布' }}
      </div>
      <div class="stats-view__bars">
        <div class="stats-view__bar-row">
          <span class="stats-view__bar-label">{{ t.correctCountLabel || '正确' }}</span>
          <div class="stats-view__bar-track">
            <div
              class="stats-view__bar-fill"
              :style="{
                width: `${accuracyPct}%`,
                background: '#22c55e',
              }"
            />
          </div>
          <span class="stats-view__bar-count">{{ totalCorrect }}</span>
        </div>
        <div class="stats-view__bar-row">
          <span class="stats-view__bar-label">{{ t.wrongCountLabel || '错误' }}</span>
          <div class="stats-view__bar-track">
            <div
              class="stats-view__bar-fill"
              :style="{
                width: `${wrongPct}%`,
                background: '#ef4444',
              }"
            />
          </div>
          <span class="stats-view__bar-count">{{ totalWrong }}</span>
        </div>
      </div>
    </div>

    <!-- 语言分布 -->
    <div
      v-if="langStats.length > 0"
      class="stats-view__section"
    >
      <div class="stats-view__section-title">
        {{ t.language || '语言' }}
      </div>
      <div class="stats-view__bars">
        <div
          v-for="item in langStats"
          :key="item.label"
          class="stats-view__bar-row"
        >
          <span class="stats-view__bar-label">{{ item.label }}</span>
          <div class="stats-view__bar-track">
            <div
              class="stats-view__bar-fill"
              :style="{
                width: `${item.pct}%`,
                background: item.color,
              }"
            />
          </div>
          <span class="stats-view__bar-count">{{ item.count }}</span>
        </div>
      </div>
    </div>

    <!-- 难度分布 -->
    <div
      v-if="diffStats.length > 0"
      class="stats-view__section"
    >
      <div class="stats-view__section-title">
        {{ t.difficulty || '难度' }}
      </div>
      <div class="stats-view__bars">
        <div
          v-for="item in diffStats"
          :key="item.label"
          class="stats-view__bar-row"
        >
          <span class="stats-view__bar-label">{{ item.label }}</span>
          <div class="stats-view__bar-track">
            <div
              class="stats-view__bar-fill"
              :style="{
                width: `${item.pct}%`,
                background: item.color,
              }"
            />
          </div>
          <span class="stats-view__bar-count">{{ item.count }}</span>
        </div>
      </div>
    </div>

    <!-- 分类列表 -->
    <div
      v-if="categoryStats.length > 0"
      class="stats-view__section"
    >
      <div class="stats-view__section-title">
        {{ t.category || '分类' }}
      </div>
      <div class="stats-view__tags">
        <span
          v-for="item in categoryStats"
          :key="item.label"
          class="stats-view__tag"
        >
          {{ item.label }}
          <span class="stats-view__tag-count">{{ item.count }}</span>
        </span>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="cards.length === 0"
      class="stats-view__empty"
    >
      {{ t.noCards }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  SkillCard,
  SkillI18n,
} from "../types"
import { computed } from "vue"
import {
  LANG_COLORS,
  langLabel,
} from "../composables/useLangLabel"
import { useCardStats } from "../composables/useCardStats"
import { DIFFICULTY_CHINESE, DIFFICULTY_COLORS } from "../types"
import ProgressRing from "./ProgressRing.vue"

const props = defineProps<{
  cards: SkillCard[]
  i18n: SkillI18n
}>()

const t = computed(() => props.i18n)
const cardsRef = computed(() => props.cards)
const {
  practicedCount,
  dueCount,
  practicedPct,
  totalCorrect,
  totalWrong,
  totalAttempts,
  accuracyPct,
} = useCardStats(cardsRef)

const wrongPct = computed(() => 100 - accuracyPct.value)

const accuracyColor = computed(() => {
  if (accuracyPct.value >= 80) return "#22c55e"
  if (accuracyPct.value >= 50) return "#f59e0b"
  return "#ef4444"
})

// 语言分布
const langStats = computed(() => {
  const map = new Map<string, number>()
  props.cards.forEach((c) => map.set(c.language, (map.get(c.language) || 0) + 1))
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => ({
      label: langLabel(lang),
      count,
      pct: Math.round((count / props.cards.length) * 100),
      color: LANG_COLORS[lang] || "#94a3b8",
    }))
})

// 难度分布
const diffStats = computed(() => {
  const map = new Map<string, number>()
  props.cards.forEach((c) => map.set(c.difficulty, (map.get(c.difficulty) || 0) + 1))
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([diff, count]) => ({
      label: (t.value as any)[diff] || DIFFICULTY_CHINESE[diff as keyof typeof DIFFICULTY_CHINESE] || diff,
      count,
      pct: Math.round((count / props.cards.length) * 100),
      color: DIFFICULTY_COLORS[diff as keyof typeof DIFFICULTY_COLORS] || "#94a3b8",
    }))
})

// 分类
const categoryStats = computed(() => {
  const map = new Map<string, number>()
  props.cards.forEach((c) => map.set(c.category, (map.get(c.category) || 0) + 1))
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([cat, count]) => ({
      label: cat,
      count,
    }))
})
</script>

<style lang="scss" scoped>
@use "../styles/StatsView.scss";
</style>
