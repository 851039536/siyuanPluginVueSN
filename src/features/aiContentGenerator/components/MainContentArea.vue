<!-- AI内容生成器主内容展示区：加载态 / 空状态 / 错误提示 / Markdown预览 / Diff对比 / 流式输出 -->
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
            size="xsmall"
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
            size="xsmall"
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
            size="xsmall"
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
            size="xsmall"
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
            size="xsmall"
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
            size="xsmall"
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
            size="xsmall"
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
            size="xsmall"
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
      <ReasoningSection
        :reasoning-content="reasoningContent"
        :show-reasoning="showReasoning"
        :is-generating="isGenerating"
        @toggle="$emit('toggle-reasoning')"
      />

      <!-- RAG 联网搜索结果（可折叠） -->
      <SearchResultsSection
        :search-results="searchResults"
        :search-status="searchStatus"
      />

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
    <ContentAreaEmpty
      v-else
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue"
import type { ReviewResult } from "@/types/ai"
import Button from "@/components/Button.vue"
import Loader from "@/components/Loader.vue"
import DiffPreview from "./DiffPreview.vue"
import ReviewPanel from "./ReviewPanel.vue"
import ContentAreaEmpty from "./ContentAreaEmpty.vue"
import ReasoningSection from "./ReasoningSection.vue"
import SearchResultsSection from "./SearchResultsSection.vue"

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

  // 对话
  conversationCount?: number

  // 流式输出增强
  generationTip?: string
}

const props = withDefaults(defineProps<Props>(), {
  searchResults: () => [],
  showReasoning: false,
  searchStatus: "",
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
@use "../styles/MainContentArea.scss" as *;
@use "../styles/index.scss" as *;
</style>
