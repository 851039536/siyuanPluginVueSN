<!-- AI内容生成器主内容展示区：加载态 / 空状态 / 错误提示 / 预览 / Diff对比 / 审查 Tab 与直接审查 / 流式输出 -->
<template>
  <div class="main-content-area">
    <!-- 加载状态（仅在没有内容时显示，思考过程中不遮挡） -->
    <div
      v-if="isGenerating && !displayedContent && !generatedContent && !reasoningContent"
      class="loading-wrapper"
    >
      <Loader />
    </div>

    <!-- 错误提示 -->
    <div
      v-else-if="errorMessage && !displayedContent && !generatedContent"
      class="error-state"
    >
      <IconWrapper
        name="cancel"
        :size="48"
        class="error-icon"
      />
      <p>{{ errorMessage }}</p>
    </div>

    <!-- 生成结果（流式输出时也显示；思考过程到达时也渲染以展示推理内容） -->
    <div
      v-else-if="displayedContent || generatedContent || reasoningContent"
      class="result-container"
    >
      <div class="result-header">
        <span class="result-title">
          <span
            v-if="isGenerating"
            class="generating-indicator"
          >
            <span class="dot-flashing"></span>
            <!-- 流式输出提示："生成中..." -->
            {{ i18n.generatingLabel }}
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
              <IconWrapper
                name="timerOutline"
                :size="11"
              />
              {{ generationElapsed }}
            </span>
            <!-- 分段切换：预览 / 对比 / 审查（选中态走主色 text 外观） -->
            <div class="view-mode-toggle">
              <!-- 按钮："预览" -->
              <Button
                :variant="viewMode === 'preview' ? 'primary' : 'ghost'"
                text
                size="xsmall"
                icon="eye"
                :title="i18n.viewModePreview"
                @click="viewMode = 'preview'"
              >
                {{ i18n.viewModePreview }}
              </Button>
              <!-- 按钮："对比" -->
              <Button
                :variant="viewMode === 'diff' ? 'primary' : 'ghost'"
                text
                size="xsmall"
                icon="columns"
                :disabled="!hasDiff"
                :title="i18n.viewModeDiff"
                @click="viewMode = 'diff'"
              >
                {{ i18n.viewModeDiff }}
              </Button>
              <!-- Tab："审查"（交叉审核结果独立页签） -->
              <Button
                :variant="viewMode === 'review' ? 'primary' : 'ghost'"
                text
                size="xsmall"
                icon="sparkles"
                :disabled="!generatedContent"
                :title="i18n.reviewTab"
                @click="viewMode = 'review'"
              >
                {{ i18n.reviewTab }}
              </Button>
            </div>
          </template>
        </span>
        <ResultActionsBar
          :i18n="i18n"
          :is-generating="isGenerating"
          :is-applying="isApplying"
          :is-undoing="isUndoing"
          :is-inserting-sub-doc="isInsertingSubDoc"
          :can-apply="canApply"
          :can-insert-sub-doc="canInsertSubDoc"
          :can-undo="canUndo"
          :show-direct-review="showDirectReview"
          :conversation-count="conversationCount"
          @stop="$emit('stop')"
          @applyEdit="$emit('applyEdit')"
          @insertSubdoc="$emit('insertSubdoc')"
          @undoEdit="$emit('undoEdit')"
          @copy="$emit('copy')"
          @clear="$emit('clear')"
          @directReview="$emit('directReview')"
          @clearConversation="$emit('clearConversation')"
        />
      </div>

      <!-- 思考过程（可折叠） -->
      <ReasoningSection
        :i18n="i18n"
        :reasoning-content="reasoningContent"
        :show-reasoning="showReasoning"
        :is-generating="isGenerating"
        @toggle="$emit('toggleReasoning')"
      />

      <!-- RAG 联网搜索结果（可折叠） -->
      <SearchResultsSection
        :i18n="i18n"
        :search-results="searchResults"
        :search-status="searchStatus"
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
          :i18n="i18n"
          :original-content="originalContent"
          :new-content="generatedContent"
        />
        <!-- 审查模式（交叉审核结果独立页签） -->
        <div
          v-else-if="viewMode === 'review'"
          class="review-tab"
        >
          <ReviewPanel
            v-if="isReviewing || reviewResult"
            :i18n="i18n"
            :is-reviewing="isReviewing"
            :review-result="reviewResult || null"
            :is-auto-fixing="isAutoFixing"
            @reReview="$emit('reReview')"
            @autoFix="$emit('autoFix')"
            @fixIssue="$emit('fixIssue', $event)"
          />
          <!-- 审查 Tab 空态：尚无审核结果时的提示 -->
          <div
            v-else
            class="review-tab-empty"
          >
            <IconWrapper
              name="sparkles"
              :size="22"
              class="review-tab-empty-icon"
            />
            <p>{{ i18n.reviewTabEmpty }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <ContentAreaEmpty
      v-else
      :i18n="i18n"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue"
import type { ReviewResult, SearchResult } from "@/types/ai"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Loader from "@/components/Loader.vue"
import DiffPreview from "./DiffPreview.vue"
import ReviewPanel from "./ReviewPanel.vue"
import ResultActionsBar from "./ResultActionsBar.vue"
import ContentAreaEmpty from "./ContentAreaEmpty.vue"
import ReasoningSection from "./ReasoningSection.vue"
import SearchResultsSection from "./SearchResultsSection.vue"

interface Props {
  // 国际化文案（转传给 ReviewPanel 等子组件）
  i18n: Record<string, string>

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
  searchResults?: SearchResult[]
  searchStatus?: string

  // 耗时
  generationElapsed?: string

  // 审核
  isReviewing?: boolean
  reviewResult?: ReviewResult | null

  // 操作可用性
  canApply: boolean
  canInsertSubDoc: boolean
  canUndo: boolean

  // 自动修复
  isAutoFixing?: boolean

  // 对话（轮次数，父组件已按 2 条/轮折算）
  conversationCount?: number

  // 流式输出增强
  generationTip?: string
}

const props = withDefaults(defineProps<Props>(), {
  searchResults: () => [],
  showReasoning: false,
  searchStatus: "",
  generationElapsed: "",
  conversationCount: 0,
})

defineEmits<{
  (e: "stop"): void
  (e: "applyEdit"): void
  (e: "insertSubdoc"): void
  (e: "undoEdit"): void
  (e: "copy"): void
  (e: "clear"): void
  (e: "toggleReasoning"): void
  (e: "autoFix"): void
  (e: "reReview"): void
  (e: "directReview"): void
  (e: "fixIssue", issueIndex: number): void
  (e: "clearConversation"): void
}>()

const viewMode = ref<"preview" | "diff" | "review">("preview")

// 是否存在差异（有原文且有生成内容且不同）
const hasDiff = computed(() => {
  return !!props.originalContent && !!props.generatedContent
    && props.originalContent !== props.generatedContent
})

// "直接审查"按钮可用性：有生成内容且未在生成/审核中
const showDirectReview = computed(() =>
  !props.isGenerating && !!props.generatedContent && !props.isReviewing,
)

// 生成开始时重置为预览模式：流式输出需要预览展示，且生成完成后默认停留在预览界面，由用户手动切换对比
watch(() => props.isGenerating, (newVal) => {
  if (newVal) {
    viewMode.value = "preview"
  }
})

// 审核发起或结果就绪时自动切换到审查 Tab：点击"直接审查"后立即停留在审核页，审核完成后展示结果
watch(
  () => [props.isReviewing, props.reviewResult] as const,
  ([reviewing, result]) => {
    if (reviewing || result) {
      viewMode.value = "review"
    }
  },
)
</script>

<style scoped lang="scss">
@use "../styles/MainContentArea.scss" as *;
@use "../styles/index.scss" as *;
</style>
