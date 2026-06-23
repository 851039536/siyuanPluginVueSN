<template>
  <div class="main-content-area">
    <!-- 加载状态（仅在没有内容时显示） -->
    <div
      v-if="isGenerating && !displayedContent && !generatedContent"
      class="loading-wrapper"
    >
      <Loader />
    </div>

    <!-- 错误提示 -->
    <div
      v-else-if="errorMessage && !displayedContent && !generatedContent"
      class="error-state"
    >
      <svg
        width="48"
        height="48"
        class="error-icon"
      >
        <use xlink:href="#iconCloseRound"></use>
      </svg>
      <p>{{ errorMessage }}</p>
    </div>

    <!-- 生成结果（流式输出时也显示） -->
    <div
      v-else-if="displayedContent || generatedContent"
      class="result-container"
    >
      <div class="result-header">
        <span class="result-title">
          <span
            v-if="isGenerating"
            class="generating-indicator"
          >
            <span class="dot-flashing"></span>
            生成中...
            <span
              v-if="generationTip"
              class="generation-tip"
            >{{ generationTip }}</span>
          </span>
          <template v-else>
            <span
              v-if="generationElapsed"
              class="elapsed-badge"
            >
              <svg
                width="11"
                height="11"
              ><use xlink:href="#iconTime"></use></svg>
              {{ generationElapsed }}
            </span>
            <div class="view-mode-toggle">
              <button
                class="view-mode-btn"
                :class="[{ active: viewMode === 'preview' }]"
                title="预览"
                @click="viewMode = 'preview'"
              >
                <svg
                  width="14"
                  height="14"
                ><use xlink:href="#iconEye"></use></svg>
                预览
              </button>
              <button
                class="view-mode-btn"
                :class="[{ active: viewMode === 'diff' }]"
                :disabled="!hasDiff"
                title="对比"
                @click="viewMode = 'diff'"
              >
                <svg
                  width="14"
                  height="14"
                ><use xlink:href="#iconColumns"></use></svg>
                对比
              </button>
            </div>
          </template>
        </span>
        <div class="result-actions">
          <!-- 主要操作 -->
          <Button
            v-if="isGenerating"
            title="停止生成"
            variant="danger"
            size="small"
            @click="$emit('stop')"
          >
            <svg
              width="14"
              height="14"
            ><use xlink:href="#iconClose"></use></svg>
            停止
          </Button>
          <Button
            :disabled="!canApply"
            title="应用编辑"
            variant="primary"
            size="small"
            @click="$emit('apply-edit')"
          >
            <div
              v-if="isApplying"
              class="loading-spinner-small"
            ></div>
            <svg
              v-else
              width="14"
              height="14"
            ><use xlink:href="#iconCheck"></use></svg>
            应用
          </Button>
          <!-- 次要操作 -->
          <Button
            :disabled="!canInsertSubDoc"
            title="插入为子文档"
            variant="ghost"
            size="small"
            @click="$emit('insert-subdoc')"
          >
            <div
              v-if="isInsertingSubDoc"
              class="loading-spinner-small"
            ></div>
            <svg
              v-else
              width="14"
              height="14"
            ><use xlink:href="#iconAdd"></use></svg>
          </Button>
          <Button
            v-if="canUndo"
            :disabled="isUndoing"
            title="撤回编辑"
            variant="ghost"
            size="small"
            @click="$emit('undo-edit')"
          >
            <div
              v-if="isUndoing"
              class="loading-spinner-small"
            ></div>
            <svg
              v-else
              width="14"
              height="14"
            ><use xlink:href="#iconUndo"></use></svg>
          </Button>
          <Button
            title="复制"
            variant="ghost"
            size="small"
            @click="$emit('copy')"
          >
            <svg
              width="14"
              height="14"
            ><use xlink:href="#iconCopy"></use></svg>
          </Button>
          <!-- 重新审核 -->
          <Button
            v-if="!isGenerating && generatedContent"
            title="重新审核内容"
            variant="ghost"
            size="small"
            @click="$emit('re-review')"
          >
            <svg
              width="14"
              height="14"
            ><use xlink:href="#iconCheck"></use></svg>
          </Button>
          <!-- 对话控制 -->
          <Button
            v-if="!isGenerating && (conversationCount || 0) > 0"
            :title="`清空对话历史（${conversationCount || 0} 轮）`"
            variant="ghost"
            size="small"
            @click="$emit('clear-conversation')"
          >
            <svg
              width="14"
              height="14"
            ><use xlink:href="#iconRefresh"></use></svg>
            <span class="conv-count">{{ (conversationCount || 0) / 2 }}</span>
          </Button>
          <Button
            title="清除"
            variant="ghost"
            size="small"
            @click="$emit('clear')"
          >
            <svg
              width="14"
              height="14"
            ><use xlink:href="#iconTrashcan"></use></svg>
          </Button>
        </div>
      </div>

      <!-- 思考过程（可折叠） -->
      <div
        v-if="reasoningContent"
        class="reasoning-section"
      >
        <button
          class="reasoning-toggle"
          @click="$emit('toggle-reasoning')"
        >
          <svg
            width="12"
            height="12"
            class="reasoning-chevron"
            :class="{ expanded: showReasoning }"
          >
            <use xlink:href="#iconRight"></use>
          </svg>
          <svg
            width="14"
            height="14"
          ><use xlink:href="#iconSparkles"></use></svg>
          <span>思考过程</span>
          <span
            v-if="isGenerating"
            class="reasoning-dot"
          ></span>
        </button>
        <div
          v-if="showReasoning"
          class="reasoning-content"
        >{{ reasoningContent }}</div>
      </div>

      <!-- RAG 联网搜索结果（可折叠） -->
      <div
        v-if="searchStatus || searchResults.length > 0"
        class="search-results-section"
      >
        <button
          class="search-results-toggle"
          @click="showSearchPanel = !showSearchPanel"
        >
          <svg
            width="12"
            height="12"
            class="search-chevron"
            :class="{ expanded: showSearchPanel }"
          >
            <use xlink:href="#iconRight"></use>
          </svg>
          <svg
            width="14"
            height="14"
          ><use xlink:href="#iconSearch"></use></svg>
          <span>搜索来源</span>
          <span class="search-status-text">{{ searchStatus }}</span>
        </button>
        <div
          v-if="showSearchPanel && searchResults.length > 0"
          class="search-results-body"
        >
          <div
            v-for="(result, idx) in searchResults"
            :key="idx"
            class="search-result-item"
          >
            <div class="search-result-header">
              <span class="search-result-index">{{ idx + 1 }}.</span>
              <a
                :href="result.url"
                class="search-result-link"
                target="_blank"
                :title="result.url"
              >{{ result.title || result.url }}</a>
            </div>
            <div
              v-if="result.content"
              class="search-result-content"
            >{{ result.content }}</div>
          </div>
        </div>
      </div>

      <!-- 审核结果（独立组件） -->
      <ReviewPanel
        v-if="isReviewing || reviewResult"
        :is-reviewing="isReviewing"
        :review-result="reviewResult || null"
        :is-auto-fixing="isAutoFixing"
        @re-review="$emit('re-review')"
        @auto-fix="$emit('auto-fix')"
        @fix-issue="$emit('fix-issue', $event)"
      />

      <div class="result-content">
        <!-- 预览模式 -->
        <div
          v-if="viewMode === 'preview'"
          class="markdown-preview selectable-content"
          v-html="renderedMarkdown"
        ></div>
        <!-- Diff 对比模式 -->
        <DiffPreview
          v-else-if="viewMode === 'diff' && hasDiff"
          :original-content="originalContent"
          :new-content="generatedContent"
        />
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else
      class="empty-state"
    >
      <svg
        width="48"
        height="48"
        class="empty-icon"
      >
        <use xlink:href="#iconSparkles"></use>
      </svg>
      <p class="empty-title">
        AI 内容编辑助手
      </p>
      <div class="empty-steps">
        <div class="empty-step">
          <span class="step-num">1</span>
          <span>点击下方「选择文档」或「选择块」</span>
        </div>
        <div class="empty-step">
          <span class="step-num">2</span>
          <span>选择 AI 快捷操作或输入自定义指令</span>
        </div>
        <div class="empty-step">
          <span class="step-num">3</span>
          <span>预览结果后应用到文档</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Loader from "@/components/Loader.vue"
import DiffPreview from "./DiffPreview.vue"
import ReviewPanel from "./ReviewPanel.vue"

interface Props {
  // 状态
  isGenerating: boolean
  isApplying: boolean
  isUndoing: boolean
  isInsertingSubDoc: boolean
  errorMessage: string

  // 内容
  displayedContent: string
  generatedContent: string
  renderedMarkdown: string
  originalContent: string

  // 思考过程
  reasoningContent?: string
  showReasoning?: boolean

  // 搜索来源
  searchResults?: Array<{ title: string, url: string, content: string, score?: number }>
  showSearchResults?: boolean
  searchStatus?: string

  // 耗时
  generationElapsed?: string

  // 审核
  isReviewing?: boolean
  reviewResult?: {
    rating: string
    summary: string
    issues: Array<{ description: string, severity: string }>
    suggestions: string[]
    reviewModel: string
    reviewedAt: number
  } | null

  // 操作可用性
  canApply: boolean
  canInsertSubDoc: boolean
  canUndo: boolean

  // 自动修复
  isAutoFixing?: boolean

  // 对话
  conversationCount?: number
  hasContent?: boolean

  // 流式输出增强
  generationTip?: string
}

const props = withDefaults(defineProps<Props>(), {
  searchResults: () => [],
  showReasoning: false,
  searchStatus: "",
  showSearchResults: false,
  generationElapsed: "",
})

defineEmits<{
  (e: "stop"): void
  (e: "apply-edit"): void
  (e: "insert-subdoc"): void
  (e: "undo-edit"): void
  (e: "copy"): void
  (e: "clear"): void
  (e: "toggle-reasoning"): void
  (e: "auto-fix"): void
  (e: "re-review"): void
  (e: "fix-issue", issueIndex: number): void
  (e: "clear-conversation"): void
}>()

const viewMode = ref<"preview" | "diff">("preview")
const showSearchPanel = ref(true)

// 是否存在差异（有原文且有生成内容且不同）
const hasDiff = computed(() => {
  return !!props.originalContent && !!props.generatedContent
    && props.originalContent !== props.generatedContent
})

// 生成完成后自动切换到 Diff 模式
watch(() => props.isGenerating, (newVal, oldVal) => {
  if (oldVal && !newVal && hasDiff.value) {
    viewMode.value = "diff"
  }
})
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;

.loading-wrapper {
  position: relative;
  height: 200px;
}

// ============ 思考过程 ============
.reasoning-section {
  @include collapsible-section;
}

.reasoning-toggle {
  @include collapsible-toggle;
}

.reasoning-chevron {
  @include collapsible-chevron;
}

.reasoning-dot {
  @include collapsible-status-dot;
}

.reasoning-content {
  @include collapsible-body;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

// ============ 耗时徽章 ============
.elapsed-badge {
  @include codex-meta-label;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  font-variant-numeric: tabular-nums;

  svg {
    color: var(--b3-theme-primary);
    opacity: 0.65;
  }
}

// ============ RAG 搜索来源 ============
.search-results-section {
  @include collapsible-section;
}

.search-results-toggle {
  @include collapsible-toggle;
}

.search-chevron {
  @include collapsible-chevron;
}

.search-status-text {
  font-size: 10px;
  font-weight: 400;
  opacity: 0.5;
  margin-left: auto;
}

.search-results-body {
  @include collapsible-body;
  padding-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
}

.search-result-item {
  padding: 5px 0;

  & + & {
    border-top: 1px solid var(--b3-theme-surface-lighter);
  }
}

.search-result-header {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.search-result-index {
  font-size: 10px;
  font-weight: 600;
  color: var(--b3-theme-primary);
  flex-shrink: 0;
}

.search-result-link {
  font-size: 11px;
  color: var(--b3-theme-primary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
}

.search-result-content {
  margin-top: 3px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.65;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

// ============ 审核结果 ============
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

.review-issues {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review-issue-item {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  line-height: 1.5;
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

.review-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed var(--b3-theme-surface-lighter);
}

.review-model {
  @include codex-meta-label;
  font-size: 9px;
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
}

.auto-fixing-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

// ============ 流式输出提示 ============
.generation-tip {
  margin-left: 8px;
  font-size: 10px;
  font-weight: 400;
  opacity: 0.5;
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
}

// ============ 对话计数徽章 ============
.conv-count {
  font-size: 10px;
  font-weight: 600;
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
}
</style>
