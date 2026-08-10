<!-- 交叉审核面板：分项评分条形图 / 严重度过滤 / 问题清单 / 改进建议 / 自动修复 -->
<template>
  <div class="review-panel-wrapper">
    <!-- 审核头部 -->
    <div class="review-header">
      <!-- 左侧：图标 + 标题 -->
      <div class="review-header-left">
        <SvgIcon name="#iconCheck" />
        <!-- 头栏标题："交叉审核" -->
        <span class="review-header-title">{{ i18n.reviewCrossReview }}</span>
      </div>
      <!-- 右侧：加载状态点 / 评级徽标 -->
      <div class="review-header-right">
        <span
          v-if="isReviewing"
          class="review-loading-dot"
        ></span>
        <span
          v-else-if="reviewResult"
          class="review-rating-badge"
          :class="ratingClass"
        >
          {{ reviewResult.rating }}
        </span>
      </div>
    </div>

    <!-- 审核详情 -->
    <div
      v-if="reviewResult"
      class="review-body"
    >
      <!-- 总体评价 -->
      <div class="review-summary">
        <SvgIcon name="#iconSparkles" />
        {{ reviewResult.summary }}
      </div>

      <!-- 分项评分条形图 -->
      <div
        v-if="reviewResult.detailedScore"
        class="score-section"
      >
        <button
          class="subsection-toggle"
          @click="showScores = !showScores"
        >
          <!-- 小节标题："分项评分" -->
          <SvgIcon
            name="#iconRight"
            :size="10"
            class="subsection-chevron"
            :class="{ expanded: showScores }"
          />
          <span>{{ i18n.reviewDetailedScore }}</span>
        </button>
        <div
          v-if="showScores"
          class="subsection-body"
        >
          <!-- 雷达图：五维得分分布总览 -->
          <ReviewRadarChart
            :scores="reviewResult.detailedScore"
            :labels="scoreLabelMap"
            :get-level="scoreLevel"
          />
          <!-- 条形图：各维度精确读数 -->
          <div
            v-for="(value, key) in reviewResult.detailedScore"
            :key="key"
            class="score-bar-row"
          >
            <span class="score-label">{{ scoreLabelMap[key as ScoreKey] || key }}</span>
            <div class="score-bar-bg">
              <div
                class="score-bar-fill"
                :class="`score-fill-${scoreLevel(value)}`"
                :style="{ width: `${value * 10}%` }"
              ></div>
            </div>
            <span class="score-value">{{ value }}/10</span>
          </div>
        </div>
      </div>

      <!-- 严重程度过滤 -->
      <div
        v-if="reviewResult.issues.length > 0"
        class="issue-filter"
      >
        <button
          v-for="f in filterOptions"
          :key="f.key"
          class="issue-filter-btn"
          :class="{ active: issueFilter === f.key }"
          @click="issueFilter = f.key"
        >
          {{ f.label }} ({{ filterCounts[f.key] }})
        </button>
      </div>

      <!-- 问题清单 -->
      <div
        v-if="filteredIssueEntries.length > 0"
        class="review-issues"
      >
        <!-- 小节标题："问题清单 (N)" -->
        <div class="review-section-title">
          {{ i18n.reviewIssueList }} ({{ filteredIssueEntries.length }})
        </div>
        <div
          v-for="entry in filteredIssueEntries"
          :key="entry.originalIndex"
          class="review-issue-item"
          :class="`severity-${entry.issue.severity}`"
        >
          <div class="issue-content">
            <span
              class="issue-severity"
              :class="`severity-${entry.issue.severity}`"
            >{{ entry.issue.severity }}</span>
            <span class="issue-text">{{ entry.issue.description }}</span>
          </div>
          <div
            v-if="needsFix && !isAutoFixing"
            class="issue-actions"
          >
            <!-- 按钮："修复"（title："定向修复此问题"） -->
            <button
              class="fix-issue-btn"
              :title="i18n.reviewFixIssueTitle"
              @click="$emit('fixIssue', entry.originalIndex)"
            >
              <SvgIcon
                name="#iconRefresh"
                :size="10"
              />
              {{ i18n.reviewFix }}
            </button>
          </div>
        </div>
      </div>

      <!-- 改进建议 -->
      <div
        v-if="reviewResult.suggestions.length > 0"
        class="review-suggestions"
      >
        <!-- 小节标题："改进建议" -->
        <div class="review-section-title">
          {{ i18n.reviewSuggestions }}
        </div>
        <div
          v-for="(sug, idx) in reviewResult.suggestions"
          :key="idx"
          class="review-suggestion-item"
        >
          <span class="suggestion-num">{{ idx + 1 }}.</span>
          {{ sug }}
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="review-footer">
        <!-- 元信息："审核模型:" + 模型名 -->
        <span class="review-model">{{ i18n.reviewModelLabel }} {{ reviewResult.reviewModel }}</span>
        <span class="review-time">{{ formatTime(reviewResult.reviewedAt) }}</span>
        <div class="review-footer-actions">
          <!-- 按钮："重新审核" -->
          <button
            v-if="!isReviewing"
            class="review-footer-btn"
            :title="i18n.reviewReReview"
            @click="$emit('reReview')"
          >
            <SvgIcon
              name="#iconRefresh"
              :size="10"
            />
            {{ i18n.reviewReReview }}
          </button>
          <template v-if="needsFix">
            <!-- 修复进行中徽标："修复中..." -->
            <span
              v-if="isAutoFixing"
              class="auto-fixing-badge"
            >
              <span class="dot-flashing"></span>
              {{ i18n.reviewFixing }}
            </span>
            <!-- 按钮："自动修复"（title："自动修复所有问题"） -->
            <button
              v-else
              class="review-footer-btn auto-fix-btn"
              :title="i18n.reviewAutoFixTitle"
              @click="$emit('autoFix')"
            >
              <SvgIcon
                name="#iconRefresh"
                :size="10"
              />
              {{ i18n.reviewAutoFix }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
} from "vue"
import type { IssueSeverity, ReviewRating, ReviewResult } from "@/types/ai"
import { RATING_NEEDS_FIX, SEVERITY_LEVELS } from "../types"
import ReviewRadarChart from "./ReviewRadarChart.vue"
import SvgIcon from "./SvgIcon.vue"

interface Props {
  i18n: Record<string, string>
  isReviewing: boolean
  reviewResult: ReviewResult | null
  isAutoFixing: boolean
}

const props = defineProps<Props>()

defineEmits<{
  (e: "reReview"): void
  (e: "autoFix"): void
  (e: "fixIssue", issueIndex: number): void
}>()

const showScores = ref(true)

type ScoreKey = keyof NonNullable<ReviewResult["detailedScore"]>

/** 分项评分标签（准确性/结构/语言质量/格式规范/覆盖完整），文案来自 i18n */
const scoreLabelMap = computed<Record<ScoreKey, string>>(() => ({
  accuracy: props.i18n.reviewScoreAccuracy,
  structure: props.i18n.reviewScoreStructure,
  quality: props.i18n.reviewScoreQuality,
  format: props.i18n.reviewScoreFormat,
  coverage: props.i18n.reviewScoreCoverage,
}))

const scoreLevel = (value: number): string => {
  if (value >= 8) return "high"
  if (value >= 5) return "mid"
  return "low"
}

/** 评级→徽标样式类映射（rating 值为 AI 输出的中文业务枚举） */
const RATING_CLASS_MAP: Record<ReviewRating, string> = {
  优秀: "rating-good",
  良好: "rating-ok",
  需改进: "rating-needs-fix",
}

const ratingClass = computed(() =>
  props.reviewResult ? RATING_CLASS_MAP[props.reviewResult.rating] : "",
)

/** 评级为"需改进"且有具体问题时才展示定向修复/自动修复入口（语义与 useReview 逻辑一致） */
const needsFix = computed(() => {
  const result = props.reviewResult
  return result?.rating === RATING_NEEDS_FIX && result.issues.length > 0
})

/** 严重程度过滤键的联合类型（"全部"为 UI 键，"高/中/低"派生自业务枚举） */
type SeverityFilterKey = "all" | IssueSeverity

// 严重程度过滤
const issueFilter = ref<SeverityFilterKey>("all")

// 单次遍历累加各严重度计数
const filterCounts = computed<Record<SeverityFilterKey, number>>(() => {
  const counts = { all: 0 } as Record<SeverityFilterKey, number>
  for (const sev of SEVERITY_LEVELS) counts[sev] = 0
  for (const issue of props.reviewResult?.issues ?? []) {
    counts.all++
    counts[issue.severity]++
  }
  return counts
})

/** 严重度 → i18n 标签映射（高/中/低），与"全部"按钮同为 i18n 文案来源，保证国际化一致性 */
const SEVERITY_LABEL_MAP: Record<IssueSeverity, string> = {
  高: props.i18n.reviewSeverityHigh,
  中: props.i18n.reviewSeverityMid,
  低: props.i18n.reviewSeverityLow,
}

// 过滤按钮："全部"与"高/中/低"文案均取自 i18n，避免中文枚举值直接硬编码展示
const filterOptions = computed<{ key: SeverityFilterKey; label: string }[]>(() => [
  { key: "all", label: props.i18n.reviewFilterAll },
  ...SEVERITY_LEVELS.map((sev) => ({ key: sev, label: SEVERITY_LABEL_MAP[sev] })),
])

/** 过滤后的问题及其在原始数组中的索引（fixIssue emit 需要原始索引），单 computed 避免两次遍历靠位置隐式对齐 */
const filteredIssueEntries = computed(() => {
  const issues = props.reviewResult?.issues ?? []
  return issues
    .map((issue, originalIndex) => ({ issue, originalIndex }))
    .filter((entry) => issueFilter.value === "all" || entry.issue.severity === issueFilter.value)
})

// 本地紧凑 HH:mm 展示；不复用 @/utils/format.ts 的 formatTime（其输出完整日期时间，不适合 footer 徽标）
const formatTime = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
}
</script>

<style scoped lang="scss">
@use "../styles/ReviewPanel.scss" as *;
@use "../styles/index.scss" as *;
</style>
