<template>
  <div class="main-content-area">
    <!-- 加载状态（仅在没有内容时显示） -->
    <div v-if="isGenerating && !displayedContent && !generatedContent" class="loading-state">
      <div class="loading-spinner-large"></div>
      <p>{{ 'AI正在思考...' }}</p>
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
            v-if="canShowDiff"
            @click="$emit('toggle-diff')"
            :class="{ active: showDiffMode }"
            :title="showDiffMode ? '返回预览' : '查看差异'"
            variant="ghost"
            size="small"
          >
            <svg width="14" height="14"><use xlink:href="#iconDiff"></use></svg>
          </Button>
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
        <div v-if="!showDiffMode" class="markdown-preview selectable-content" v-html="renderedMarkdown"></div>
        <!-- 差异对比模式 -->
        <div v-else class="diff-view-container">
          <!-- 差异显示工具栏 -->
          <div class="diff-view-toolbar">
            <div class="diff-mode-options">
              <Button
                :class="['diff-mode-btn', { active: diffMode === 'split' }]"
                @click="$emit('update:diffMode', 'split')"
                title="分栏显示"
                variant="ghost"
                size="small"
              >
                分栏
              </Button>
              <Button
                :class="['diff-mode-btn', { active: diffMode === 'unified' }]"
                @click="$emit('update:diffMode', 'unified')"
                title="统一显示"
                variant="ghost"
                size="small"
              >
                统一
              </Button>
            </div>
            <span class="diff-label">原文 vs 生成</span>
          </div>
          <!-- 差异显示组件 -->
          <div class="diff-viewer-wrapper">
            <Diff
              :mode="diffMode"
              theme="dark"
              language="markdown"
              :prev="originalContent"
              :current="generatedContent"
              :folding="false"
              :virtual-scroll="false"
              :render-added="true"
              :render-removed="true"
              :hide-line-numbers="false"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <svg width="48" height="48" class="empty-icon">
        <use xlink:href="#iconFile"></use>
      </svg>
      <p class="empty-title">选择文档开始编辑</p>
      <p class="empty-hint">点击下方"选择文档"或拖拽文档到此面板</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Diff } from "vue-diff";
import "vue-diff/dist/index.css";
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
	originalContent: string;
	renderedMarkdown: string;

	// 差异对比
	showDiffMode: boolean;
	diffMode: "split" | "unified";

	// 操作可用性
	canApply: boolean;
	canShowDiff: boolean;
	canInsertSubDoc: boolean;
	canUndo: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	(e: "stop"): void;
	(e: "apply-edit"): void;
	(e: "toggle-diff"): void;
	(e: "insert-subdoc"): void;
	(e: "undo-edit"): void;
	(e: "copy"): void;
	(e: "clear"): void;
	(e: "update:diffMode", value: "split" | "unified"): void;
}>();
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
