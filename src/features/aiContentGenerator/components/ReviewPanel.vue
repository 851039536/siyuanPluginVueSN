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
        <div class="review-section-title">分项评分</div>
        <div
          v-for="(value, key) in reviewResult.detailedScore"
          :key="key"
          class="score-bar-row"
        >
          <span class="score-label">{{ scoreLabelMap[key as ScoreKey] || key }}</span>
          <div class="score-bar-bg">
            <div
              class="score-bar-fill"
              :class="'score-fill-' + scoreLevel(value)"
              :style="{ width: value * 10 + '%' }"
            ></div>
          </div>
          <span class="score-value">{{ value }}/10</span>
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
          :class="'severity-' + issue.severity"
        >
          <div class="issue-content">
            <span
              class="issue-severity"
              :class="'severity-' + issue.severity"
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
              @click="$emit('fix-issue', filteredIssueIndices[idx])"
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
        <div class="review-section-title">改进建议</div>
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
            @click="$emit('re-review')"
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
              @click="$emit('auto-fix')"
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
import { computed, ref } from "vue"

interface ReviewResultData {
  rating: string
  summary: string
  issues: Array<{ description: string; severity: string }>
  suggestions: string[]
  reviewModel: string
  reviewedAt: number
  detailedScore?: Record<string, number>
}

interface Props {
  isReviewing: boolean
  reviewResult: ReviewResultData | null
  isAutoFixing: boolean
}

const props = defineProps<Props>()

defineEmits<{
  (e: "re-review"): void
  (e: "auto-fix"): void
  (e: "fix-issue", issueIndex: number): void
}>()

const showReviewPanel = ref(true)

type ScoreKey = keyof NonNullable<ReviewResultData["detailedScore"]>

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

// 严重程度过滤
const issueFilter = ref<string>("all")

const filterCounts = computed(() => {
  if (!props.reviewResult) return { all: 0, 高: 0, 中: 0, 低: 0 }
  const issues = props.reviewResult.issues
  return {
    all: issues.length,
    高: issues.filter((i) => i.severity === "高").length,
    中: issues.filter((i) => i.severity === "中").length,
    低: issues.filter((i) => i.severity === "低").length,
  }
})

const filterOptions = computed(() => [
  { key: "all", label: "全部" },
  { key: "高", label: "高" },
  { key: "中", label: "中" },
  { key: "低", label: "低" },
])

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
@use "../styles/index.scss" as *;

.review-section {
  @include collapsible-section;
}

.review-toggle-btn {
  @include collapsible-toggle(var(--b3-theme-success));
}

.review-chevron {
  @include collapsible-chevron;
}

.review-loading-dot {
  @include collapsible-status-dot(var(--b3-theme-success));
  margin-left: auto;
}

.review-rating-badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;

  &.rating-good {
    color: #fff;
    background: var(--b3-theme-success);
  }

  &.rating-ok {
    color: #fff;
    background: var(--b3-theme-primary);
  }

  &.rating-needs-fix {
    color: #fff;
    background: var(--b3-theme-error);
  }
}

.review-body {
  @include collapsible-body;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.review-summary {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  line-height: 1.6;

  svg {
    color: var(--b3-theme-primary);
    flex-shrink: 0;
    margin-top: 2px;
  }
}

.review-section-title {
  @include codex-meta-label;
  margin-bottom: 4px;
}

// ============ 分项评分条形图 ============
.score-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.score-bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.score-label {
  width: 56px;
  flex-shrink: 0;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  text-align: right;
}

.score-bar-bg {
  flex: 1;
  height: 6px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 3px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.score-fill-high {
  background: var(--b3-theme-success);
}

.score-fill-mid {
  background: var(--b3-theme-warning, #e6a23c);
}

.score-fill-low {
  background: var(--b3-theme-error);
}

.score-value {
  width: 28px;
  flex-shrink: 0;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  font-size: 9px;
}

// ============ 严重程度过滤 Tabs ============
.issue-filter {
  display: flex;
  gap: 3px;
}

.issue-filter-btn {
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface-lighter);
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.6;

  &:hover {
    opacity: 0.8;
  }

  &.active {
    opacity: 1;
    background: var(--b3-theme-surface);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }
}

// ============ 问题清单 ============
.review-issues {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review-issue-item {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  line-height: 1.5;
  padding: 4px 6px;
  border-radius: 3px;
  border-left: 3px solid transparent;

  &.severity-高 {
    border-left-color: var(--b3-theme-error);
    background: var(--b3-theme-error-background);
  }

  &.severity-中 {
    border-left-color: var(--b3-theme-warning);
  }

  &.severity-低 {
    border-left-color: var(--b3-theme-surface-lighter);
  }

  .issue-content {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 5px;
  }
}

.issue-severity {
  font-size: 9px;
  font-weight: 600;
  padding: 0 4px;
  border-radius: 2px;
  flex-shrink: 0;

  &.severity-高 {
    color: var(--b3-theme-error);
    background: var(--b3-theme-error-background);
  }

  &.severity-中 {
    color: var(--b3-theme-warning);
    background: var(--b3-theme-warning-background);
  }

  &.severity-低 {
    color: var(--b3-theme-on-surface);
    background: var(--b3-theme-surface-lighter);
    opacity: 0.7;
  }
}

.issue-text {
  flex: 1;
  word-break: break-word;
}

.issue-actions {
  flex-shrink: 0;
}

.fix-issue-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  font-size: 9px;
  color: var(--b3-theme-primary);
  background: rgba(var(--b3-theme-primary-rgb, 53, 125, 221), 0.08);
  border: 1px solid rgba(var(--b3-theme-primary-rgb, 53, 125, 221), 0.2);
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: rgba(var(--b3-theme-primary-rgb, 53, 125, 221), 0.15);
  }
}

// ============ 改进建议 ============
.review-suggestions {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.review-suggestion-item {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  line-height: 1.5;
}

.suggestion-num {
  font-weight: 600;
  color: var(--b3-theme-primary);
  margin-right: 3px;
}

// ============ 底部操作栏 ============
.review-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed var(--b3-theme-surface-lighter);
  flex-wrap: wrap;
}

.review-model {
  @include codex-meta-label;
  font-size: 9px;
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
}

.review-time {
  font-size: 9px;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
}

.review-footer-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.review-footer-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface-lighter);
  border: none;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: var(--b3-theme-surface-light);
    color: var(--b3-theme-primary);
  }

  &.auto-fix-btn {
    color: #fff;
    background: var(--b3-theme-warning, #e6a23c);

    &:hover {
      opacity: 0.9;
    }
  }
}

.auto-fixing-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.dot-flashing {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
}
</style>
