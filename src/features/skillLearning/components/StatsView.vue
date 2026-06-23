<template>
  <div class="stats-view">
    <!-- 概览卡片 -->
    <div class="stats-view__summary">
      <div class="stats-view__stat">
        <div class="stats-view__stat-value">{{ cards.length }}</div>
        <div class="stats-view__stat-label">{{ t.totalCards }}</div>
      </div>
      <div class="stats-view__stat">
        <div class="stats-view__stat-value">{{ practicedCount }}</div>
        <div class="stats-view__stat-label">{{ t.practicedCards }}</div>
      </div>
      <div class="stats-view__stat">
        <div class="stats-view__stat-value stats-view__stat-value--accent">{{ dueCount }}</div>
        <div class="stats-view__stat-label">{{ t.dueForReview || '待复习' }}</div>
      </div>
    </div>

    <!-- 练习进度环 + 正确率环 -->
    <div v-if="cards.length > 0" class="stats-view__rings-row">
      <!-- 练习进度环 -->
      <div class="stats-view__section stats-view__section--ring">
        <div class="stats-view__section-title">{{ t.practiceProgress || '练习覆盖' }}</div>
        <div class="stats-view__progress-ring">
          <svg viewBox="0 0 100 100" class="stats-view__ring-svg">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--b3-border-color)" stroke-width="8" />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="var(--b3-theme-primary)"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="ringCircumference"
              :stroke-dashoffset="coverageRingOffset"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div class="stats-view__ring-text">
            <span class="stats-view__ring-pct">{{ practicedPct }}%</span>
            <span class="stats-view__ring-sub">{{ practicedCount }}/{{ cards.length }}</span>
          </div>
        </div>
      </div>

      <!-- 正确率环 -->
      <div v-if="practicedCount > 0" class="stats-view__section stats-view__section--ring">
        <div class="stats-view__section-title">{{ t.accuracyRate || '正确率' }}</div>
        <div class="stats-view__progress-ring">
          <svg viewBox="0 0 100 100" class="stats-view__ring-svg">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--b3-border-color)" stroke-width="8" />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              :stroke="accuracyColor"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="ringCircumference"
              :stroke-dashoffset="accuracyRingOffset"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div class="stats-view__ring-text">
            <span class="stats-view__ring-pct" :style="{ color: accuracyColor }">{{ accuracyPct }}%</span>
            <span class="stats-view__ring-sub">{{ totalCorrect }}/{{ totalAttempts }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 对错分布条 -->
    <div v-if="practicedCount > 0" class="stats-view__section">
      <div class="stats-view__section-title">{{ t.accuracyRate || '正确率' }} {{ t.difficulty || '分布' }}</div>
      <div class="stats-view__bars">
        <div class="stats-view__bar-row">
          <span class="stats-view__bar-label">{{ t.correctCountLabel || '正确' }}</span>
          <div class="stats-view__bar-track">
            <div
              class="stats-view__bar-fill"
              :style="{ width: accuracyPct + '%', background: '#22c55e' }"
            />
          </div>
          <span class="stats-view__bar-count">{{ totalCorrect }}</span>
        </div>
        <div class="stats-view__bar-row">
          <span class="stats-view__bar-label">{{ t.wrongCountLabel || '错误' }}</span>
          <div class="stats-view__bar-track">
            <div
              class="stats-view__bar-fill"
              :style="{ width: wrongPct + '%', background: '#ef4444' }"
            />
          </div>
          <span class="stats-view__bar-count">{{ totalWrong }}</span>
        </div>
      </div>
    </div>

    <!-- 语言分布 -->
    <div v-if="langStats.length > 0" class="stats-view__section">
      <div class="stats-view__section-title">{{ t.language || '语言' }}</div>
      <div class="stats-view__bars">
        <div v-for="item in langStats" :key="item.label" class="stats-view__bar-row">
          <span class="stats-view__bar-label">{{ item.label }}</span>
          <div class="stats-view__bar-track">
            <div
              class="stats-view__bar-fill"
              :style="{ width: item.pct + '%', background: item.color }"
            />
          </div>
          <span class="stats-view__bar-count">{{ item.count }}</span>
        </div>
      </div>
    </div>

    <!-- 难度分布 -->
    <div v-if="diffStats.length > 0" class="stats-view__section">
      <div class="stats-view__section-title">{{ t.difficulty || '难度' }}</div>
      <div class="stats-view__bars">
        <div v-for="item in diffStats" :key="item.label" class="stats-view__bar-row">
          <span class="stats-view__bar-label">{{ item.label }}</span>
          <div class="stats-view__bar-track">
            <div
              class="stats-view__bar-fill"
              :style="{ width: item.pct + '%', background: item.color }"
            />
          </div>
          <span class="stats-view__bar-count">{{ item.count }}</span>
        </div>
      </div>
    </div>

    <!-- 分类列表 -->
    <div v-if="categoryStats.length > 0" class="stats-view__section">
      <div class="stats-view__section-title">{{ t.category || '分类' }}</div>
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
    <div v-if="cards.length === 0" class="stats-view__empty">
      {{ t.noCards }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { SkillCard, SkillI18n } from "../types"
import { langLabel, LANG_COLORS } from "../composables/useLangLabel"

const props = defineProps<{
  cards: SkillCard[]
  i18n: SkillI18n
}>()

const t = computed(() => props.i18n)

const practicedCount = computed(() => props.cards.filter((c) => c.practiceCount > 0).length)
const dueCount = computed(() =>
  props.cards.filter((c) => {
    if (!c.reviewData) return true
    return c.reviewData.nextReview <= Date.now()
  }).length,
)

const practicedPct = computed(() => {
  if (props.cards.length === 0) return 0
  return Math.round((practicedCount.value / props.cards.length) * 100)
})

// 正确率数据
const totalCorrect = computed(() =>
  props.cards.reduce((sum, c) => sum + (c.correctCount || 0), 0),
)
const totalWrong = computed(() =>
  props.cards.reduce((sum, c) => sum + (c.wrongCount || 0), 0),
)
const totalAttempts = computed(() => totalCorrect.value + totalWrong.value)
const accuracyPct = computed(() => {
  if (totalAttempts.value === 0) return 0
  return Math.round((totalCorrect.value / totalAttempts.value) * 100)
})
const wrongPct = computed(() => 100 - accuracyPct.value)

const accuracyColor = computed(() => {
  if (accuracyPct.value >= 80) return "#22c55e"
  if (accuracyPct.value >= 50) return "#f59e0b"
  return "#ef4444"
})

// 环形进度条
const ringCircumference = 2 * Math.PI * 42
const coverageRingOffset = computed(() =>
  ringCircumference - (practicedPct.value / 100) * ringCircumference,
)
const accuracyRingOffset = computed(() =>
  ringCircumference - (accuracyPct.value / 100) * ringCircumference,
)

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
const diffColors = { beginner: "#22c55e", intermediate: "#f59e0b", advanced: "#ef4444" }
const diffLabels: Record<string, string> = {
  beginner: t.value.beginner || "初级",
  intermediate: t.value.intermediate || "中级",
  advanced: t.value.advanced || "高级",
}

const diffStats = computed(() => {
  const map = new Map<string, number>()
  props.cards.forEach((c) => map.set(c.difficulty, (map.get(c.difficulty) || 0) + 1))
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([diff, count]) => ({
      label: diffLabels[diff] || diff,
      count,
      pct: Math.round((count / props.cards.length) * 100),
      color: diffColors[diff] || "#94a3b8",
    }))
})

// 分类
const categoryStats = computed(() => {
  const map = new Map<string, number>()
  props.cards.forEach((c) => map.set(c.category, (map.get(c.category) || 0) + 1))
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([cat, count]) => ({ label: cat, count }))
})
</script>

<style lang="scss" scoped>
@use "../styles/StatsView.scss";
</style>
