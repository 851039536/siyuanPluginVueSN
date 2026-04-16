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
        <div class="markdown-preview selectable-content" v-html="renderedMarkdown"></div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <svg width="48" height="48" class="empty-icon">
        <use xlink:href="#iconFile"></use>
      </svg>
      <p class="empty-title">选择文档开始编辑</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";

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

	// 操作可用性
	canApply: boolean;
	canInsertSubDoc: boolean;
	canUndo: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	(e: "stop"): void;
	(e: "apply-edit"): void;
	(e: "insert-subdoc"): void;
	(e: "undo-edit"): void;
	(e: "copy"): void;
	(e: "clear"): void;
}>();
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
