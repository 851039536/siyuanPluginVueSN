<!-- 交叉审核面板：分项评分条形图 / 严重度过滤 / 问题清单 / 改进建议 / 自动修复 -->
<template>
  <div class="review-section">
    <!-- 审核头部（始终可见） -->
    <button
      class="review-toggle-btn"
      @click="showReviewPanel = !showReviewPanel"
    >
      <svg
        width="12"
        height="12"
        class="review-chevron"
        :class="{ expanded: showReviewPanel }"
      >
        <use xlink:href="#iconRight"></use>
      </svg>
      <svg
        width="14"
        height="14"
      ><use xlink:href="#iconCheck"></use></svg>
      <span>交叉审核</span>
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
    </button>

    <!-- 审核详情 -->
    <div
      v-if="showReviewPanel && reviewResult"
      class="review-body"
    >
      <!-- 总体评价 -->
      <div class="review-summary">
        <svg
          width="12"
          height="12"
        ><use xlink:href="#iconSparkles"></use></svg>
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
          <svg
            width="10"
            height="10"
            class="subsection-chevron"
            :class="{ expanded: showScores }"
          ><use xlink:href="#iconRight"></use></svg>
          <span>分项评分</span>
        </button>
        <div
          v-if="showScores"
          class="subsection-body"
        >
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
        v-if="filteredIssues.length > 0"
        class="review-issues"
      >
        <div class="review-section-title">
          问题清单 ({{ filteredIssues.length }})
        </div>
        <div
          v-for="(issue, idx) in filteredIssues"
          :key="idx"
          class="review-issue-item"
          :class="`severity-${issue.severity}`"
        >
          <div class="issue-content">
            <span
              class="issue-severity"
              :class="`severity-${issue.severity}`"
            >{{ issue.severity }}</span>
            <span class="issue-text">{{ issue.description }}</span>
          </div>
          <div
            v-if="reviewResult.rating === '需改进' && !isAutoFixing"
            class="issue-actions"
          >
            <button
              class="fix-issue-btn"
              title="定向修复此问题"
              @click="$emit('fixIssue', filteredIssueIndices[idx])"
            >
              <svg
                width="10"
                height="10"
              ><use xlink:href="#iconRefresh"></use></svg>
              修复
            </button>
          </div>
        </div>
      </div>

      <!-- 改进建议 -->
      <div
        v-if="reviewResult.suggestions.length > 0"
        class="review-suggestions"
      >
        <div class="review-section-title">
          改进建议
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
        <span class="review-model">审核模型: {{ reviewResult.reviewModel }}</span>
        <span class="review-time">{{ formatTime(reviewResult.reviewedAt) }}</span>
        <div class="review-footer-actions">
          <button
            v-if="!isReviewing"
            class="review-footer-btn"
            title="重新审核"
            @click="$emit('reReview')"
          >
            <svg
              width="10"
              height="10"
            ><use xlink:href="#iconRefresh"></use></svg>
            重新审核
          </button>
          <template v-if="reviewResult.rating === '需改进' && reviewResult.issues.length > 0">
            <span
              v-if="isAutoFixing"
              class="auto-fixing-badge"
            >
              <span class="dot-flashing"></span>
              修复中...
            </span>
            <button
              v-else
              class="review-footer-btn auto-fix-btn"
              title="自动修复所有问题"
              @click="$emit('autoFix')"
            >
              <svg
                width="10"
                height="10"
              ><use xlink:href="#iconRefresh"></use></svg>
              自动修复
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
import type { ReviewResult } from "@/types/ai"

interface Props {
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

const showReviewPanel = ref(true)
const showScores = ref(true)

type ScoreKey = keyof NonNullable<ReviewResult["detailedScore"]>

const scoreLabelMap: Record<ScoreKey, string> = {
  accuracy: "准确性",
  structure: "结构",
  quality: "语言质量",
  format: "格式规范",
  coverage: "覆盖完整",
}

const scoreLevel = (value: number): string => {
  if (value >= 8) return "high"
  if (value >= 5) return "mid"
  return "low"
}

const ratingClass = computed(() => {
  if (!props.reviewResult) return ""
  const r = props.reviewResult.rating
  if (r === "优秀") return "rating-good"
  if (r === "良好") return "rating-ok"
  return "rating-needs-fix"
})

/** 严重程度过滤键的联合类型 */
type SeverityFilterKey = "all" | "高" | "中" | "低"

// 严重程度过滤
const issueFilter = ref<SeverityFilterKey>("all")

const filterCounts = computed<Record<SeverityFilterKey, number>>(() => {
  if (!props.reviewResult) {
    return { all: 0, 高: 0, 中: 0, 低: 0 }
  }
  const issues = props.reviewResult.issues
  return {
    all: issues.length,
    高: issues.filter((i) => i.severity === "高").length,
    中: issues.filter((i) => i.severity === "中").length,
    低: issues.filter((i) => i.severity === "低").length,
  }
})

const filterOptions: { key: SeverityFilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "高", label: "高" },
  { key: "中", label: "中" },
  { key: "低", label: "低" },
]

const filteredIssues = computed(() => {
  if (!props.reviewResult) return []
  if (issueFilter.value === "all") return props.reviewResult.issues
  return props.reviewResult.issues.filter((i) => i.severity === issueFilter.value)
})

// 过滤后的问题在原始数组中的索引（用于 fix-issue emit）
const filteredIssueIndices = computed(() => {
  if (!props.reviewResult) return []
  if (issueFilter.value === "all") {
    return props.reviewResult.issues.map((_, i) => i)
  }
  return props.reviewResult.issues
    .map((i, idx) => (i.severity === issueFilter.value ? idx : -1))
    .filter((idx) => idx >= 0)
})

const formatTime = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
}
</script>

<style scoped lang="scss">
@use "../styles/ReviewPanel.scss" as *;
@use "../styles/index.scss" as *;
</style>
