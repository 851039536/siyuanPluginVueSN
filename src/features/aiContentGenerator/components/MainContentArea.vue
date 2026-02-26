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
          📝 {{ '编辑内容' }}
          <span v-if="isGenerating" class="generating-indicator">
            <span class="dot-flashing"></span>
            {{ '生成中' }}
          </span>
        </span>
        <div class="result-actions">
          <!-- 停止生成按钮 -->
          <Button
            v-if="isGenerating"
            @click="$emit('stop')"
            :title="'停止生成'"
            variant="danger"
            size="small"
          >
            <svg width="16" height="16">
              <use xlink:href="#iconClose"></use>
            </svg>
            {{ '停止' }}
          </Button>
          <Button
            @click="$emit('apply-edit')"
            :disabled="!canApply"
            :title="'应用编辑'"
            variant="primary"
            size="small"
          >
            <div v-if="isApplying" class="loading-spinner-small"></div>
            <svg v-else width="16" height="16">
              <use xlink:href="#iconCheck"></use>
            </svg>
            {{ '应用' }}
          </Button>
          <Button
            v-if="canShowDiff"
            @click="$emit('toggle-diff')"
            :class="{ active: showDiffMode }"
            :title="showDiffMode ? '返回预览' : '查看差异'"
            variant="ghost"
            size="small"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path v-if="!showDiffMode" fill="currentColor" d="M3,13H11V3H3V13M3,21H11V15H3V21M13,21H21V11H13V21M13,3V9H21V3H13Z" />
              <path v-else fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z" />
            </svg>
            {{ showDiffMode ? '预览' : '差异' }}
          </Button>
          <Button
            @click="$emit('insert-subdoc')"
            :disabled="!canInsertSubDoc"
            :title="'插入子文档'"
            variant="ghost"
            size="small"
          >
            <div v-if="isInsertingSubDoc" class="loading-spinner-small"></div>
            <svg v-else width="16" height="16" viewBox="0 0 24 24">
              <path fill="currentColor" d="M20,18H4V6H20M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4M13,12H16V15H18V12H21V10H18V7H16V10H13V12Z" />
            </svg>
            {{ '子文档' }}
          </Button>
          <Button
            v-if="canUndo"
            @click="$emit('undo-edit')"
            :disabled="isUndoing"
            :title="'撤回编辑'"
            variant="ghost"
            size="small"
          >
            <div v-if="isUndoing" class="loading-spinner-small"></div>
            <svg v-else width="16" height="16">
              <use xlink:href="#iconUndo"></use>
            </svg>
            {{ '撤回' }}
          </Button>
          <Button @click="$emit('copy')" :title="'复制Markdown'" variant="ghost" size="small">
            <svg width="16" height="16">
              <use xlink:href="#iconCopy"></use>
            </svg>
            {{ '复制' }}
          </Button>
          <Button @click="$emit('clear')" variant="ghost" size="small">
            <svg width="16" height="16">
              <use xlink:href="#iconTrashcan"></use>
            </svg>
            {{ '清除' }}
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
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M4,4H10V10H4V4M20,4V10H14V4H20M14,20H20V14H14V20M4,14V20H10V14H4Z" />
                </svg>
                分栏
              </Button>
              <Button
                :class="['diff-mode-btn', { active: diffMode === 'unified' }]"
                @click="$emit('update:diffMode', 'unified')"
                title="统一显示"
                variant="ghost"
                size="small"
              >
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M2,2V22H22V2H2M20,20H4V4H20V20M8,8H16V10H8V8M8,11H16V13H8V11M8,14H16V16H8V14Z" />
                </svg>
                统一
              </Button>
            </div>
            <div class="diff-view-info">
              <span class="diff-label">原文档 vs AI生成</span>
            </div>
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
      <svg width="64" height="64" class="empty-icon">
        <use xlink:href="#iconFile"></use>
      </svg>
      <p>{{ '请选择文档并使用AI编辑功能' }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Diff } from 'vue-diff';
import 'vue-diff/dist/index.css';
import Button from '@/components/Button.vue';

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
  diffMode: 'split' | 'unified';

  // 操作可用性
  canApply: boolean;
  canShowDiff: boolean;
  canInsertSubDoc: boolean;
  canUndo: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'stop'): void;
  (e: 'apply-edit'): void;
  (e: 'toggle-diff'): void;
  (e: 'insert-subdoc'): void;
  (e: 'undo-edit'): void;
  (e: 'copy'): void;
  (e: 'clear'): void;
  (e: 'update:diffMode', value: 'split' | 'unified'): void;
}>();
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
