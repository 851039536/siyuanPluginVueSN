<template>
  <div class="bottom-input-section">
    <!-- AI智能编辑工具栏 -->
    <div v-if="editTargetDoc" class="ai-edit-toolbar">
      <div class="toolbar-label">
        <div class="section-title-wrapper">
          <svg width="14" height="14">
            <use xlink:href="#iconSparkles"></use>
          </svg>
          <span>{{ 'AI智能编辑' }}:</span>
          <Button
            :class="['btn-collapse', { 'collapsed': collapsedAiToolbar }]"
            @click="$emit('toggle-ai-toolbar')"
            :title="collapsedAiToolbar ? '展开工具栏' : '折叠工具栏'"
            variant="ghost"
            size="small"
          >
            <svg width="14" height="14" class="collapse-icon">
              <use :xlink:href="collapsedAiToolbar ? '#iconRight' : '#iconDown'"></use>
            </svg>
          </Button>
        </div>
      </div>
      <div class="toolbar-actions" :class="{ 'collapsed': collapsedAiToolbar }">
        <Button @click="$emit('ai-edit', 'polish')" :disabled="isGenerating" :title="'AI润色'" variant="ghost" size="small">
          <svg width="14" height="14"><use xlink:href="#iconEdit"></use></svg>
          {{ '润色' }}
        </Button>
        <Button @click="$emit('ai-edit', 'expand')" :disabled="isGenerating" :title="'扩写内容'" variant="ghost" size="small">
          <svg width="14" height="14"><use xlink:href="#iconAdd"></use></svg>
          {{ '扩写' }}
        </Button>
        <Button @click="$emit('ai-edit', 'condense')" :disabled="isGenerating" :title="'精简内容'" variant="ghost" size="small">
          <svg width="14" height="14"><use xlink:href="#iconMin"></use></svg>
          {{ '精简' }}
        </Button>
        <Button @click="$emit('ai-edit', 'fix')" :disabled="isGenerating" :title="'修正错误'" variant="ghost" size="small">
          <svg width="14" height="14"><use xlink:href="#iconCheck"></use></svg>
          {{ '纠错' }}
        </Button>
        <Button @click="$emit('ai-edit', 'translate')" :disabled="isGenerating" :title="'翻译文档'" variant="ghost" size="small">
          <svg width="14" height="14"><use xlink:href="#iconLanguage"></use></svg>
          {{ '翻译' }}
        </Button>
        <Button @click="$emit('ai-edit', 'rewrite')" :disabled="isGenerating" :title="'改写文档'" variant="ghost" size="small">
          <svg width="14" height="14"><use xlink:href="#iconRefresh"></use></svg>
          {{ '改写' }}
        </Button>
        <Button @click="$emit('ai-edit', 'summary')" :disabled="isGenerating" :title="'AI总结文档'" variant="ghost" size="small">
          <svg width="14" height="14" viewBox="0 0 24 24">
            <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M13,12.5L11.5,14L10,12.5V16H8V12.5L10,14L11.5,12.5L13,14V16H15V12.5L13,12.5Z" />
          </svg>
          {{ '总结' }}
        </Button>

        <Button v-if="!isCheckingPlagiarism" @click="$emit('check-plagiarism')" :disabled="isGenerating" :title="'AI查重'" variant="ghost" size="small">
          <svg width="14" height="14"><use xlink:href="#iconSearch"></use></svg>
          {{ '查重' }}
        </Button>
        <Button v-else @click="$emit('stop')" :title="'停止生成'" variant="danger" size="small">
          <svg width="14" height="14"><use xlink:href="#iconClose"></use></svg>
          {{ '停止' }}
        </Button>
      </div>
    </div>

    <!-- 编辑模式：紧凑工具栏（提示词选择 + 目标文档选择 + 输入框 + 执行按钮） -->
    <div class="compact-toolbar edit-mode">
      <!-- 提示词选择按钮 -->
      <div class="prompt-selector-wrapper">
        <Button variant="ghost" size="small" @click="$emit('toggle-prompt-selector')" :title="currentPromptName || ('选择提示词')">
          <svg width="14" height="14">
            <use xlink:href="#iconList"></use>
          </svg>
          <span v-if="currentPromptName" class="prompt-name-compact">{{ currentPromptName }}</span>
          <span v-else>{{ '提示词' }}</span>
          <span v-if="savedPrompts.length > 0 && !currentPromptName" class="prompt-count-compact">{{ savedPrompts.length }}</span>
          <Button v-if="currentPromptName" variant="ghost" size="small" @click.stop="$emit('clear-current-prompt')" :title="'清除'">
            <svg width="10" height="10">
              <use xlink:href="#iconClose"></use>
            </svg>
          </Button>
        </Button>

        <!-- 提示词选择面板 -->
        <div v-if="showPromptSelector" class="prompt-selector-panel">
          <div class="prompt-selector-header">
            <Button @click="$emit('toggle-prompt-selector')" variant="ghost" size="small">
              <svg width="12" height="12">
                <use xlink:href="#iconClose"></use>
              </svg>
            </Button>
          </div>

          <!-- 搜索框 -->

          <div  class="prompt-list">
            <div
              v-for="(prompt, index) in paginatedPrompts"
              :key="prompt.id || index"
              class="prompt-item"
              @click="$emit('load-prompt', getOriginalIndex(prompt))"
            >
              <div class="prompt-item-header">
                <span class="prompt-name">{{ prompt.name }}</span>
                <div class="prompt-item-actions">
                  <Button
                    @click.stop="$emit('edit-prompt', getOriginalIndex(prompt))"
                    :title="'编辑'"
                    variant="ghost"
                    size="small"
                  >
                    <svg width="14" height="14">
                      <use xlink:href="#iconEdit"></use>
                    </svg>
                  </Button>
                  <Button
                    @click.stop="$emit('delete-prompt', getOriginalIndex(prompt))"
                    :title="'删除'"
                    variant="ghost"
                    size="small"
                  >
                    <svg width="14" height="14">
                      <use xlink:href="#iconTrashcan"></use>
                    </svg>
                  </Button>
                </div>
              </div>
              <div class="prompt-item-preview">{{ getPromptPreview(prompt.systemPrompt) }}</div>
              <div class="prompt-item-meta">
                <span>{{ '创造性' }}: {{ prompt.temperature }}</span>
                <span>{{ '最大长度' }}: {{ prompt.maxTokens }}</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- 目标文档选择 -->
      <div class="doc-selector-wrapper">
        <Button variant="ghost" size="small" @click="$emit('select-target-doc')" :title="editTargetDoc ? editTargetDoc.title : ('选择文档')">
          <svg width="14" height="14">
            <use xlink:href="#iconFile"></use>
          </svg>
          <span v-if="editTargetDoc" class="doc-name-compact">
            {{ editTargetDoc.title }}
            <Tag v-if="editTargetDoc.isBlock" size="small" variant="primary" title="块内容">块</Tag>
          </span>
          <span v-else>{{ '选择文档' }}</span>
          <Button v-if="editTargetDoc" variant="ghost" size="small" @click.stop="$emit('clear-target-doc')" :title="'清除'">
            <svg width="10" height="10">
              <use xlink:href="#iconClose"></use>
            </svg>
          </Button>
        </Button>
      </div>

      <!-- 编辑模式：自定义输入框 -->
      <Textarea
        v-if="editTargetDoc"
        :model-value="editCustomInput"
        @update:model-value="$emit('update:editCustomInput', $event)"
        :placeholder="'输入编辑指令...'"
        :rows="1"
        :autosize="true"
        :disabled="isGenerating"
        @keydown.ctrl.enter="$emit('custom-edit')"
      />

      <!-- 执行/停止按钮 -->
      <Button
        v-if="!isGenerating && editTargetDoc"
        @click="$emit('custom-edit')"
        :disabled="!canExecute"
        :title="executeButtonTitle"
        variant="primary"
        size="small"
      >
        <svg width="16" height="16">
          <use xlink:href="#iconSparkles"></use>
        </svg>
      </Button>
      <Button
        v-else-if="isGenerating"
        @click="$emit('stop')"
        :title="'停止生成'"
        variant="danger"
        size="small"
      >
        <svg width="16" height="16">
          <use xlink:href="#iconClose"></use>
        </svg>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Button from '@/components/Button.vue';
import Textarea from '@/components/Textarea.vue';
import Tag from '@/components/Tag.vue';

interface TargetDoc {
  id: string;
  title: string;
  content: string;
  isBlock?: boolean;
}

interface SavedPrompt {
  id: string;
  name: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  contextMessageLimit: number;
  createdAt: number;
}

interface Props {
  // 状态
  isGenerating: boolean;
  isCheckingPlagiarism: boolean;
  editTargetDoc: TargetDoc | null;

  // AI工具栏
  collapsedAiToolbar: boolean;

  // 提示词选择
  showPromptSelector: boolean;
  currentPromptName: string;
  savedPrompts: SavedPrompt[];
  filteredPrompts: SavedPrompt[];
  paginatedPrompts: SavedPrompt[];
  promptSearchQuery: string;
  currentPage: number;
  totalPages: number;

  // 输入
  editCustomInput: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'ai-edit', action: 'polish' | 'expand' | 'condense' | 'fix' | 'translate' | 'rewrite' | 'summary'): void;
  (e: 'check-plagiarism'): void;
  (e: 'stop'): void;
  (e: 'toggle-ai-toolbar'): void;
  (e: 'toggle-prompt-selector'): void;
  (e: 'clear-current-prompt'): void;
  (e: 'load-prompt', index: number): void;
  (e: 'edit-prompt', index: number): void;
  (e: 'delete-prompt', index: number): void;
  (e: 'select-target-doc'): void;
  (e: 'clear-target-doc'): void;
  (e: 'custom-edit'): void;
  (e: 'update:promptSearchQuery', value: string): void;
  (e: 'update:currentPage', value: number): void;
  (e: 'update:editCustomInput', value: string): void;
}>();

// 计算属性
const canExecute = computed(() => {
  return props.editCustomInput.trim() || props.currentPromptName;
});

const executeButtonTitle = computed(() => {
  return !props.editCustomInput.trim() && props.currentPromptName
    ? '使用当前提示词生成'
    : '执行';
});

// 获取原始索引
const getOriginalIndex = (prompt: SavedPrompt) => {
  return props.savedPrompts.findIndex(p => p.id === prompt.id);
};

// 获取提示词预览
const getPromptPreview = (text: string): string => {
  const maxLength = 60;
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};
</script>

<style scoped lang="scss">
@use "../index.scss";
</style>
