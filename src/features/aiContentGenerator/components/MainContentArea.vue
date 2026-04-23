<template>
  <div class="main-content-area">
    <!-- 加载状态（仅在没有内容时显示） -->
    <div v-if="isGenerating && !displayedContent && !generatedContent" class="loading-state">
      <div class="loading-spinner-large"></div>
      <p>{{ '正在思考...' }}</p>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="errorMessage && !displayedContent && !generatedContent" class="error-state">
      <svg width="48" height="48" class="error-icon">
        <use xlink:href="#iconCloseRound"></use>
      </svg>
      <p>{{ errorMessage }}</p>
    </div>

    <!-- 生成结果（流式输出时也显示） -->
    <div v-else-if="displayedContent || generatedContent" class="result-container">
      <div class="result-header">
        <span class="result-title">
          <span v-if="isGenerating" class="generating-indicator">
            <span class="dot-flashing"></span>
            生成中...
          </span>
          <div v-else class="view-mode-toggle">
            <button
              :class="['view-mode-btn', { active: viewMode === 'preview' }]"
              @click="viewMode = 'preview'"
              title="预览"
            >
              <svg width="14" height="14"><use xlink:href="#iconEye"></use></svg>
              预览
            </button>
            <button
              :class="['view-mode-btn', { active: viewMode === 'diff' }]"
              @click="viewMode = 'diff'"
              :disabled="!hasDiff"
              title="对比"
            >
              <svg width="14" height="14"><use xlink:href="#iconColumns"></use></svg>
              对比
            </button>
          </div>
        </span>
        <div class="result-actions">
          <!-- 主要操作 -->
          <Button
            v-if="isGenerating"
            @click="$emit('stop')"
            title="停止生成"
            variant="danger"
            size="small"
          >
            <svg width="14" height="14"><use xlink:href="#iconClose"></use></svg>
            停止
          </Button>
          <Button
            @click="$emit('apply-edit')"
            :disabled="!canApply"
            title="应用编辑"
            variant="primary"
            size="small"
          >
            <div v-if="isApplying" class="loading-spinner-small"></div>
            <svg v-else width="14" height="14"><use xlink:href="#iconCheck"></use></svg>
            应用
          </Button>
          <!-- 次要操作 -->
          <Button
            @click="$emit('insert-subdoc')"
            :disabled="!canInsertSubDoc"
            title="插入为子文档"
            variant="ghost"
            size="small"
          >
            <div v-if="isInsertingSubDoc" class="loading-spinner-small"></div>
            <svg v-else width="14" height="14"><use xlink:href="#iconAdd"></use></svg>
          </Button>
          <Button
            v-if="canUndo"
            @click="$emit('undo-edit')"
            :disabled="isUndoing"
            title="撤回编辑"
            variant="ghost"
            size="small"
          >
            <div v-if="isUndoing" class="loading-spinner-small"></div>
            <svg v-else width="14" height="14"><use xlink:href="#iconUndo"></use></svg>
          </Button>
          <Button @click="$emit('copy')" title="复制" variant="ghost" size="small">
            <svg width="14" height="14"><use xlink:href="#iconCopy"></use></svg>
          </Button>
          <Button @click="$emit('clear')" title="清除" variant="ghost" size="small">
            <svg width="14" height="14"><use xlink:href="#iconTrashcan"></use></svg>
          </Button>
        </div>
      </div>
      <div class="result-content">
        <!-- 预览模式 -->
        <div v-if="viewMode === 'preview'" class="markdown-preview selectable-content" v-html="renderedMarkdown"></div>
        <!-- Diff 对比模式 -->
        <DiffPreview
          v-else-if="viewMode === 'diff' && hasDiff"
          :original-content="originalContent"
          :new-content="generatedContent"
        />
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <svg width="48" height="48" class="empty-icon">
        <use xlink:href="#iconSparkles"></use>
      </svg>
      <p class="empty-title">AI 内容编辑助手</p>
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
import { ref, computed, watch, toRef } from "vue";
import Button from "@/components/Button.vue";
import DiffPreview from "./DiffPreview.vue";

interface Props {
	// 状态
	isGenerating: boolean;
	isApplying: boolean;
	isUndoing: boolean;
	isInsertingSubDoc: boolean;
	errorMessage: string;

	// 内容
	displayedContent: string;
	generatedContent: string;
	renderedMarkdown: string;
	originalContent: string;

	// 操作可用性
	canApply: boolean;
	canInsertSubDoc: boolean;
	canUndo: boolean;
}

const props = defineProps<Props>();

defineEmits<{
	(e: "stop"): void;
	(e: "apply-edit"): void;
	(e: "insert-subdoc"): void;
	(e: "undo-edit"): void;
	(e: "copy"): void;
	(e: "clear"): void;
}>();

const viewMode = ref<"preview" | "diff">("preview");

// 是否存在差异（有原文且有生成内容且不同）
const hasDiff = computed(() => {
	return !!props.originalContent && !!props.generatedContent
		&& props.originalContent !== props.generatedContent;
});

// 生成完成后自动切换到 Diff 模式
const isGenerating = toRef(props, "isGenerating");
watch(isGenerating, (newVal, oldVal) => {
	if (oldVal && !newVal && hasDiff.value) {
		viewMode.value = "diff";
	}
});
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
