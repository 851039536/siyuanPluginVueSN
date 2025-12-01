<template>
  <div class="ai-content-panel">
    <!-- 顶部工具栏 -->
    <div class="panel-header">
      <div class="header-title">
        <span>🤖 {{ i18n.aiContentGenerator || 'AI信息生成' }}</span>
      </div>
      <div class="header-actions">
        <!-- Edit模式切换按钮 -->
        <button
          class="btn-icon"
          @click="toggleEditMode"
          :class="{ 'active': editMode }"
          :title="i18n.editMode || '编辑模式'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <use xlink:href="#iconEdit"></use>
          </svg>
        </button>
        <button class="btn-icon" @click="toggleSettings" :title="i18n.conversationSettings || '对话设置'">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <use xlink:href="#iconSettings"></use>
          </svg>
        </button>
      </div>
    </div>

    <!-- 对话设置面板 -->
    <div class="settings-panel" v-if="showSettings">
      <div class="panel-section">
        <div class="section-header">
          <span>💬 {{ i18n.conversationSettings || '对话设置' }}</span>
          <button class="btn-close" @click="toggleSettings">
            <svg width="14" height="14">
              <use xlink:href="#iconClose"></use>
            </svg>
          </button>
        </div>
        <div class="section-content">
          <div class="setting-item">
            <div class="label-row">
              <label>{{ i18n.systemPrompt || '系统提示词' }}</label>
            </div>
            <textarea
              v-model="systemPrompt"
              class="prompt-input"
              :placeholder="i18n.systemPromptPlaceholder || '输入系统提示词，定义AI的角色和行为...'"
              rows="4"
            ></textarea>
          </div>
          <div class="setting-item">
            <label>{{ i18n.temperature || '创造性' }} ({{ temperature }})</label>
            <input
              type="range"
              v-model.number="temperature"
              min="0"
              max="2"
              step="0.1"
              class="slider"
            />
            <div class="slider-hint">
              <span>{{ i18n.precise || '精确' }}</span>
              <span>{{ i18n.creative || '创造' }}</span>
            </div>
          </div>
          <div class="setting-item">
            <label>{{ i18n.maxTokens || '最大长度' }}</label>
            <input
              type="number"
              v-model.number="maxTokens"
              min="100"
              max="4000"
              step="100"
              class="number-input"
            />
          </div>
          <!-- 需求5：上下文消息数量配置 -->
          <div class="setting-item">
            <label>{{ i18n.contextMessageLimit || '上下文消息数量' }} ({{ contextMessageLimit }})</label>
            <input
              type="range"
              v-model.number="contextMessageLimit"
              min="1"
              max="10"
              step="1"
              class="slider"
            />
            <div class="slider-hint">
              <span>{{ i18n.minimal || '最少' }} (1)</span>
              <span>{{ i18n.maximum || '最多' }} (10)</span>
            </div>
          </div>
          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" v-model="enableMarkdown" />
              <span>{{ i18n.forceMarkdown || '强制Markdown格式输出' }}</span>
            </label>
          </div>
          <!-- 打字机效果已默认启用,不再提供可选项 -->

          <!-- 保存提示词配置 -->
          <div class="setting-item save-prompt-section">
            <div class="save-prompt-header">
              <label>{{ i18n.savePromptConfig || '保存当前配置' }}</label>
            </div>
            <div class="save-prompt-input-group">
              <input
                v-model="newPromptName"
                type="text"
                class="prompt-name-input"
                :placeholder="i18n.promptNamePlaceholder || '输入配置名称...'"
                @keydown.enter="saveCurrentPrompt"
              />
              <button
                class="btn-save-prompt"
                @click="saveCurrentPrompt"
                :disabled="!newPromptName.trim()"
              >
                <svg width="14" height="14">
                  <use xlink:href="#iconSave"></use>
                </svg>
                {{ i18n.save || '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-section">
      <!-- 当前选中的提示词显示（修复问题1） -->
      <div v-if="currentPromptName" class="current-prompt-display">
        <svg width="14" height="14">
          <use xlink:href="#iconList"></use>
        </svg>
        <span class="prompt-label">{{ i18n.currentPrompt || '当前提示词' }}:</span>
        <span class="prompt-value">{{ currentPromptName }}</span>
        <button class="btn-clear-prompt" @click="clearCurrentPrompt" :title="i18n.clear || '清除'">
          <svg width="12" height="12">
            <use xlink:href="#iconClose"></use>
          </svg>
        </button>
      </div>

      <!-- 提示词选择按钮 -->
      <div class="prompt-selector-wrapper">
        <button class="btn-prompt-selector" @click="showPromptSelector = !showPromptSelector">
          <svg width="16" height="16">
            <use xlink:href="#iconList"></use>
          </svg>
          <span>{{ i18n.selectPrompt || '选择提示词' }}</span>
          <span v-if="savedPrompts.length > 0" class="prompt-count">({{ savedPrompts.length }})</span>
          <svg width="12" height="12" class="arrow-icon">
            <use :xlink:href="showPromptSelector ? '#iconUp' : '#iconDown'"></use>
          </svg>
        </button>

        <!-- 提示词选择面板 -->
        <div v-if="showPromptSelector" class="prompt-selector-panel">
          <div class="prompt-selector-header">
            <span>{{ i18n.savedPrompts || '已保存的提示词' }}</span>
            <button class="btn-close-small" @click="showPromptSelector = false">
              <svg width="12" height="12">
                <use xlink:href="#iconClose"></use>
              </svg>
            </button>
          </div>

          <div v-if="savedPrompts.length === 0" class="empty-prompts">
            <p>{{ i18n.noSavedPrompts || '暂无保存的提示词，请在对话设置中保存' }}</p>
          </div>

          <div v-else class="prompt-list">
            <div
              v-for="(prompt, index) in savedPrompts"
              :key="index"
              class="prompt-item"
              @click="loadPrompt(index)"
            >
              <div class="prompt-item-header">
                <span class="prompt-name">{{ prompt.name }}</span>
                <button
                  class="btn-delete-prompt"
                  @click.stop="deletePrompt(index)"
                  :title="i18n.delete || '删除'"
                >
                  <svg width="14" height="14">
                    <use xlink:href="#iconTrashcan"></use>
                  </svg>
                </button>
              </div>
              <div class="prompt-item-preview">{{ getPromptPreview(prompt.systemPrompt) }}</div>
              <div class="prompt-item-meta">
                <span>{{ i18n.temperature || '创造性' }}: {{ prompt.temperature }}</span>
                <span>{{ i18n.maxTokens || '最大长度' }}: {{ prompt.maxTokens }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit模式：目标文档选择 -->
      <div v-if="editMode" class="edit-doc-selector">
        <div class="selector-label">
          <svg width="14" height="14">
            <use xlink:href="#iconFile"></use>
          </svg>
          <span>{{ i18n.targetDocument || '目标文档' }}:</span>
        </div>
        <button class="btn-select-doc" @click="selectTargetDocument">
          <span v-if="!editTargetDoc">{{ i18n.selectDocument || '选择要编辑的文档' }}</span>
          <span v-else class="selected-doc-name">📄 {{ editTargetDoc.title }}</span>
          <svg width="14" height="14">
            <use xlink:href="#iconSelect"></use>
          </svg>
        </button>
        <button v-if="editTargetDoc" class="btn-clear-doc" @click="clearTargetDocument" :title="i18n.clear || '清除'">
          <svg width="12" height="12">
            <use xlink:href="#iconClose"></use>
          </svg>
        </button>
      </div>

      <!-- Edit模式：AI智能编辑工具栏 -->
      <div v-if="editMode && editTargetDoc" class="ai-edit-toolbar">
        <div class="toolbar-label">
          <svg width="14" height="14">
            <use xlink:href="#iconSparkles"></use>
          </svg>
          <span>{{ i18n.aiEditTools || 'AI智能编辑' }}:</span>
        </div>
        <div class="toolbar-actions">
          <button class="btn-ai-action" @click="aiEditAction('polish')" :disabled="isGenerating" :title="i18n.aiPolish || 'AI润色'">
            <svg width="14" height="14"><use xlink:href="#iconPaint"></use></svg>
            {{ i18n.polish || '润色' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('expand')" :disabled="isGenerating" :title="i18n.aiExpand || '扩写内容'">
            <svg width="14" height="14"><use xlink:href="#iconExpand"></use></svg>
            {{ i18n.expand || '扩写' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('condense')" :disabled="isGenerating" :title="i18n.aiCondense || '精简内容'">
            <svg width="14" height="14"><use xlink:href="#iconShrink"></use></svg>
            {{ i18n.condense || '精简' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('fix')" :disabled="isGenerating" :title="i18n.aiFix || '修正错误'">
            <svg width="14" height="14"><use xlink:href="#iconCheck"></use></svg>
            {{ i18n.fix || '纠错' }}
          </button>
          <button class="btn-ai-action btn-analyze" @click="analyzeDocument" :disabled="isGenerating || isAnalyzing" :title="i18n.aiAnalyze || 'AI分析建议'">
            <div v-if="isAnalyzing" class="loading-spinner-tiny"></div>
            <svg v-else width="14" height="14"><use xlink:href="#iconLightbulb"></use></svg>
            {{ i18n.analyze || '智能分析' }}
          </button>
        </div>
      </div>

      <!-- AI分析建议面板 -->
      <div v-if="editMode && aiSuggestions" class="ai-suggestions-panel">
        <div class="suggestions-header">
          <svg width="16" height="16"><use xlink:href="#iconLightbulb"></use></svg>
          <span>{{ i18n.aiSuggestions || 'AI优化建议' }}</span>
          <button class="btn-close-suggestions" @click="aiSuggestions = null">
            <svg width="12" height="12"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
        <div class="suggestions-content">
          <p class="suggestion-text">{{ aiSuggestions }}</p>
          <button class="btn-apply-suggestions" @click="applySuggestions" :disabled="isGenerating">
            {{ i18n.applySuggestions || '应用建议优化' }}
          </button>
        </div>
      </div>

      <!-- 引用当前文档按钮（仅普通模式显示） -->
      <div v-if="!editMode" class="reference-doc-wrapper">
        <button
          class="btn-reference-doc"
          @click="insertCurrentDocReference"
          :title="i18n.referenceCurrentDoc || '引用当前文档内容'"
        >
          <svg width="16" height="16">
            <use xlink:href="#iconAt"></use>
          </svg>
          <span>{{ i18n.referenceCurrentDoc || '@当前文档' }}</span>
        </button>
        <span v-if="referencedDocTitle" class="referenced-doc-title">
          📄 {{ referencedDocTitle }}
          <button class="btn-cancel-reference" @click="cancelDocReference" :title="i18n.cancel || '取消'">
            <svg width="12" height="12">
              <use xlink:href="#iconClose"></use>
            </svg>
          </button>
        </span>
      </div>

      <!-- 输入框和生成按钮（仅普通模式显示） -->
      <div v-if="!editMode" class="input-wrapper">
        <textarea
          v-model="userInput"
          class="user-input"
          :placeholder="referencedDocContent ? (i18n.inputPlaceholderWithDoc || '输入问题或直接生成总结...') : (i18n.inputPlaceholder || '输入您的问题或需求...')"
          rows="3"
          @keydown.ctrl.enter="handleGenerate"
          :disabled="isGenerating"
        ></textarea>
        <button
          v-if="!isGenerating"
          class="btn-generate"
          @click="handleGenerate"
          :disabled="!userInput.trim() && !referencedDocContent"
        >
          <svg width="18" height="18">
            <use xlink:href="#iconSend"></use>
          </svg>
          <span>{{ i18n.generate || '生成' }}</span>
        </button>
        <button
          v-else
          class="btn-stop"
          @click="handleStop"
          :title="i18n.stopGeneration || '停止生成'"
        >
          <svg width="18" height="18">
            <use xlink:href="#iconClose"></use>
          </svg>
          <span>{{ i18n.stop || '停止' }}</span>
        </button>
      </div>

      <!-- 编辑模式提示信息 -->
      <div v-if="editMode && editTargetDoc" class="edit-mode-info">
        <div class="doc-meta-info">
          <div class="meta-item">
            <svg width="14" height="14"><use xlink:href="#iconFile"></use></svg>
            <span>{{ i18n.documentTitle || '文档标题' }}: <strong>{{ editTargetDoc.title }}</strong></span>
          </div>
          <div class="meta-item">
            <svg width="14" height="14"><use xlink:href="#iconClock"></use></svg>
            <span>{{ i18n.editModeHint || '使用AI编辑工具对文档进行智能优化' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 输出区域 -->
    <div class="output-section">
      <!-- 加载状态（仅在没有内容时显示） -->
      <div v-if="isGenerating && !displayedContent && !generatedContent" class="loading-state">
        <div class="loading-spinner-large"></div>
        <p>{{ i18n.aiThinking || 'AI正在思考...' }}</p>
      </div>

      <!-- 错误提示 -->
      <div v-else-if="errorMessage && !displayedContent && !generatedContent" class="error-state">
        <svg width="48" height="48" class="error-icon">
          <use xlink:href="#iconCloseRound"></use>
        </svg>
        <p>{{ errorMessage }}</p>
        <button class="btn-retry" @click="handleGenerate">
          {{ i18n.retry || '重试' }}
        </button>
      </div>

      <!-- 生成结果（流式输出时也显示） -->
      <div v-else-if="displayedContent || generatedContent" class="result-container">
        <div class="result-header">
          <span class="result-title">
            📝 {{ editMode ? (i18n.editContent || '编辑内容') : (i18n.generatedContent || '生成内容') }}
            <span v-if="isGenerating" class="generating-indicator">
              <span class="dot-flashing"></span>
              {{ i18n.generating || '生成中' }}
            </span>
          </span>
          <div class="result-actions">
            <!-- Edit模式专用按钮 -->
            <template v-if="editMode">
              <button
                class="btn-action btn-apply"
                @click="applyEdit"
                :disabled="!editTargetDoc || isApplying"
                :title="i18n.applyEdit || '应用编辑'"
              >
                <div v-if="isApplying" class="loading-spinner-small"></div>
                <svg v-else width="16" height="16">
                  <use xlink:href="#iconCheck"></use>
                </svg>
                {{ i18n.applyEdit || '应用' }}
              </button>
              <button
                v-if="lastEditHistory && editMode"
                class="btn-action btn-undo"
                @click="undoEdit"
                :disabled="isUndoing"
                :title="i18n.undoEdit || '撤回编辑'"
              >
                <div v-if="isUndoing" class="loading-spinner-small"></div>
                <svg v-else width="16" height="16">
                  <use xlink:href="#iconUndo"></use>
                </svg>
                {{ i18n.undo || '撤回' }}
              </button>
            </template>
            <!-- 普通模式：撤回插入按钮 -->
            <button
              v-if="!editMode && lastEditHistory"
              class="btn-action btn-undo"
              @click="undoEdit"
              :disabled="isUndoing"
              :title="i18n.undoInsert || '撤回插入'"
            >
              <div v-if="isUndoing" class="loading-spinner-small"></div>
              <svg v-else width="16" height="16">
                <use xlink:href="#iconUndo"></use>
              </svg>
              {{ i18n.undo || '撤回' }}
            </button>
            <!-- 通用按钮 -->
            <!-- 普通模式：插入到当前文档按钮 -->
            <button
              v-if="!editMode"
              class="btn-action btn-insert"
              @click="insertToCurrentDocument"
              :disabled="isInserting"
              :title="i18n.insertToDocument || '插入到当前文档'"
            >
              <div v-if="isInserting" class="loading-spinner-small"></div>
              <svg v-else width="16" height="16">
                <use xlink:href="#iconDownload"></use>
              </svg>
              {{ i18n.insertToDoc || '插入' }}
            </button>
            <button class="btn-action" @click="copyContent" :title="i18n.copyMarkdown || '复制Markdown'">
              <svg width="16" height="16">
                <use xlink:href="#iconCopy"></use>
              </svg>
              {{ i18n.copy || '复制' }}
            </button>
            <button class="btn-action btn-clear" @click="clearContent">
              <svg width="16" height="16">
                <use xlink:href="#iconTrashcan"></use>
              </svg>
              {{ i18n.clear || '清除' }}
            </button>
          </div>
        </div>
        <div class="result-content">
          <!-- 统一预览界面 -->
          <div class="markdown-preview selectable-content" v-html="renderedDisplayedMarkdown"></div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <svg width="64" height="64" class="empty-icon">
          <use xlink:href="#iconFile"></use>
        </svg>
        <p>{{ i18n.emptyHint || '输入问题后点击生成，AI将为您创建Markdown格式的内容' }}</p>
        <div class="quick-templates">
          <p class="templates-title">{{ i18n.quickTemplates || '快速模板' }}:</p>
          <div class="template-buttons">
            <button class="btn-template" @click="useTemplate('article')">
              📄 {{ i18n.article || '文章大纲' }}
            </button>
            <button class="btn-template" @click="useTemplate('summary')">
              📋 {{ i18n.summary || '内容总结' }}
            </button>
            <button class="btn-template" @click="useTemplate('todo')">
              ✅ {{ i18n.todoList || '待办清单' }}
            </button>
            <button class="btn-template" @click="useTemplate('ideas')">
              💡 {{ i18n.brainstorm || '头脑风暴' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { showMessage } from 'siyuan';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import * as api from '@/api';
import { AIGeneratorStorage, type AIPromptConfig } from './storage';

// Props
interface Props {
  i18n: any;
  plugin: any;
  onGenerate: (options: GenerateOptions) => Promise<string>;
}

interface GenerateOptions {
  userInput: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  context?: string;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void; // 流式输出回调（修复问题2）
}

const props = withDefaults(defineProps<Props>(), {
  plugin: null
});

// 存储实例
let storage: AIGeneratorStorage | null = null;

// 状态
const userInput = ref('');
const generatedContent = ref('');
const isGenerating = ref(false);
const errorMessage = ref('');
const showRaw = ref(false);
const showSettings = ref(false);
const abortController = ref<AbortController | null>(null);

// Edit模式状态
const editMode = ref(false);
const editTargetDoc = ref<{ id: string; title: string; content: string } | null>(null);
const originalContent = ref(''); // 文档原始内容
const hasContentChanged = ref(false);
const isApplying = ref(false);
const isUndoing = ref(false);

// AI智能编辑状态
const isAnalyzing = ref(false);
const aiSuggestions = ref<string | null>(null);

// 编辑历史（用于撤回/重做）
interface EditHistory {
  docId: string;
  docTitle: string;
  originalContent: string;
  timestamp: number;
}
const lastEditHistory = ref<EditHistory | null>(null);

// 普通模式：插入到当前文档状态
const isInserting = ref(false);

// 对话设置
const systemPrompt = ref('你是一个专业的内容创作助手，擅长生成结构清晰、格式规范的Markdown文档。请确保输出内容使用标准的Markdown语法。');
const temperature = ref(0.7);
const maxTokens = ref(2000);
const enableMarkdown = ref(true);
const enableTypewriter = ref(true);

// 需求5：新增上下文消息数量配置
const contextMessageLimit = ref(1);

// 上下文配置已删除
const displayedContent = ref(''); // 用于打字机效果显示的内容
// 提示词管理
interface SavedPrompt {
  name: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  enableMarkdown: boolean;
  enableTypewriter: boolean;
}

const savedPrompts = ref<SavedPrompt[]>([]);
const showPromptSelector = ref(false);
const newPromptName = ref('');
const currentPromptName = ref(''); // 当前选中的提示词名称

// 需求3：持久化当前提示词选择
const CURRENT_PROMPT_STORAGE_KEY = 'ai-content-generator-current-prompt';

// 引用当前文档
const referencedDocTitle = ref('');
const referencedDocContent = ref('');

/**
 * 移除Markdown内容中的Frontmatter（YAML元数据）
 * @param content 原始内容
 * @returns 移除frontmatter后的内容
 */
const removeFrontmatter = (content: string): string => {
  // 匹配开头的 --- ... --- 格式的YAML frontmatter
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
  return content.replace(frontmatterRegex, '').trim();
};



// 渲染Markdown (使用marked库进行标准渲染，支持代码高亮)
const renderedDisplayedMarkdown = computed(() => {
  if (!displayedContent.value) return '';
  try {
    // 配置marked选项
    marked.setOptions({
      breaks: true,  // 支持GFM换行
      gfm: true,     // 启用GitHub风格的Markdown
    });

    let content = displayedContent.value;

    // 移除标题中的粗体标记
    content = content.replace(/^(#{1,6})\s+\*\*(.+?)\*\*\s*$/gm, '$1 $2');

    return marked.parse(content) as string;
  } catch (error) {
    console.error('Markdown渲染失败:', error);
    return `<pre>${displayedContent.value}</pre>`;
  }
});



// 监听渲染内容变化，应用代码高亮（修复问题3）
watch(renderedDisplayedMarkdown, async () => {
  await nextTick();
  // 手动对所有代码块应用高亮
  const preBlocks = document.querySelectorAll('.markdown-preview pre code');
  preBlocks.forEach((block) => {
    if (!(block as HTMLElement).dataset.highlighted) {
      hljs.highlightElement(block as HTMLElement);
    }
  });
});

/**
 * HTML转义工具函数
 */
const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

// 切换设置面板
const toggleSettings = () => {
  showSettings.value = !showSettings.value;
};

// 切换Edit模式
const toggleEditMode = () => {
  editMode.value = !editMode.value;
  if (!editMode.value) {
    // 退出Edit模式时清理状态
    clearEditState();
  }
  showMessage(
    editMode.value
      ? (props.i18n.editModeEnabled || '✓ 已启用编辑模式')
      : (props.i18n.editModeDisabled || '✓ 已关闭编辑模式'),
    1500,
    'info'
  );
};

// 清理Edit模式状态
const clearEditState = () => {
  editTargetDoc.value = null;
  originalContent.value = '';
};



// 停止打字机效果
const stopTypewriter = () => {
  // 流式输出时不需要清理
};

// 停止生成
const handleStop = () => {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
    isGenerating.value = false;
    showMessage('✓ 已停止生成', 2000, 'info');
  }
};

// 生成内容
const handleGenerate = async () => {
  // 如果既没有输入也没有引用文档，提示用户
  if (!userInput.value.trim() && !referencedDocContent.value) {
    showMessage(props.i18n.enterInput || '请输入内容或引用文档', 2000, 'info');
    return;
  }

  // 创建新的 AbortController
  abortController.value = new AbortController();

  isGenerating.value = true;
  errorMessage.value = '';
  generatedContent.value = '';
  displayedContent.value = '';
  stopTypewriter();

  try {
    let finalSystemPrompt = systemPrompt.value;
    console.log('系统提示词:', finalSystemPrompt.substring(0, 100) + '...');

    if (enableMarkdown.value) {
      finalSystemPrompt += '\n\n**重要**: 请严格使用Markdown格式输出，包括标题(#)、列表(- 或 1.)、代码块(```)、粗体(**) 等标准语法。';
    }

    // 添加当前文档上下文（如果有）
    let contextInfo = '';
    if (referencedDocContent.value) {
      // 移除文档内容中的 frontmatter
      const cleanDocContent = removeFrontmatter(referencedDocContent.value);

      contextInfo = `【参考文档】
标题：${referencedDocTitle.value}
内容：
${cleanDocContent}`;
      console.log('已添加文档上下文，标题:', referencedDocTitle.value, '内容长度:', cleanDocContent.length);
    }

    // 如果只引用了文档没有输入问题，使用默认的总结提示
    let finalUserInput = userInput.value;
    if (!userInput.value.trim() && referencedDocContent.value) {
      // 当没有用户输入时，将系统提示词的要求融入到用户消息中
      // 这样可以确保 AI 遵循系统提示词中的格式要求
      finalUserInput = '请严格按照系统提示词中定义的文档结构和格式要求，对上述文档内容进行专业的技术文档撰写。如果文档内容不完整或只有标题，请基于标题主题，撰写一份完整、专业的技术说明文档。';
      console.log('使用增强的默认提示（融合系统提示词要求）');
    } else {
      console.log('用户输入:', finalUserInput.substring(0, 100));
    }

    const options: GenerateOptions = {
      userInput: finalUserInput,
      systemPrompt: finalSystemPrompt,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      context: contextInfo || undefined,
      signal: abortController.value?.signal,
      // 默认启用打字机效果，传入流式回调
      onChunk: (chunk: string) => {
        console.log('收到流式数据块:', chunk);
        displayedContent.value += chunk;
        generatedContent.value += chunk;
      }
    };

    const result = await props.onGenerate(options);

    if (result) {
      // 如果流式输出没有更新内容（某些API可能不支持流式），使用返回的完整结果
      if (!generatedContent.value && result) {
        generatedContent.value = result;
        displayedContent.value = result;
      }
      showMessage('✓ 生成成功', 2000, 'info');
    } else {
      errorMessage.value = props.i18n.generateFailed || '生成失败，请重试';
    }
  } catch (error) {
    // 如果是用户主动取消，不显示错误
    if ((error as Error).name === 'AbortError') {
      console.log('用户取消了生成');
      return;
    }
    console.error('生成内容失败:', error);
    errorMessage.value = (error as Error).message || '生成失败';
    showMessage('生成失败: ' + errorMessage.value, 3000, 'error');
  } finally {
    isGenerating.value = false;
    abortController.value = null;
  }
};

/**
 * 转换 Markdown 为思源兼容格式
 * 思源笔记对某些 Markdown 语法有特殊要求
 *
 * 注意：思源笔记在使用 markdown 模式时会解析 Markdown 语法
 * 但某些格式（如粗体）可能在某些情况下显示不正确
 */
const convertToSiyuanMarkdown = (content: string): string => {
  let converted = content;

  // 1. 确保标题前后有空行
  converted = converted.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
  converted = converted.replace(/(#{1,6}\s[^\n]+)\n([^\n#])/g, '$1\n\n$2');

  // 2. 处理粗体格式
  // 思源笔记在使用 markdown 模式时，粗体标记可能被解析但不显示效果
  // 临时解决方案：移除粗体标记，保留文本内容
  // TODO: 找到更好的方法让思源正确显示粗体
  converted = converted.replace(/\*\*([^*]+?)\*\*/g, '$1'); // 移除粗体标记
  converted = converted.replace(/__([^_]+?)__/g, '$1'); // 移除另一种粗体标记

  // 3. 处理斜体格式（同样可能有显示问题，暂时保留）
  // converted = converted.replace(/\*([^*]+?)\*/g, '$1'); // 如需移除斜体，取消注释

  // 4. 确保代码块前后有空行
  converted = converted.replace(/([^\n])\n```/g, '$1\n\n```');
  converted = converted.replace(/```\n([^\n])/g, '```\n\n$1');

  // 5. 确保列表前后有空行
  converted = converted.replace(/([^\n])\n([-*+]\s)/g, '$1\n\n$2');
  converted = converted.replace(/([^\n])\n(\d+\.\s)/g, '$1\n\n$2');

  // 6. 清理多余的连续空行（最多保留两个换行符）
  converted = converted.replace(/\n{3,}/g, '\n\n');

  return converted;
};

// 复制内容（需求2：修复Markdown格式复制）
const copyContent = async () => {
  if (!generatedContent.value) return;

  try {
    // 转换为思源兼容的 Markdown 格式
    const siyuanContent = convertToSiyuanMarkdown(generatedContent.value);
    await navigator.clipboard.writeText(siyuanContent);
    showMessage('✓ 已复制Markdown到剪贴板', 2000, 'info');
  } catch (error) {
    console.error('复制失败:', error);
    showMessage('复制失败', 2000, 'error');
  }
};

/**
 * 插入到当前文档（普通模式）
 */
const insertToCurrentDocument = async () => {
  if (!generatedContent.value) {
    showMessage('没有可插入的内容', 2000, 'info');
    return;
  }

  // 确认对话框
  const confirmMessage = props.i18n.confirmInsertToDocument ||
    '确定要将生成的内容插入到当前文档吗？这将覆盖文档的现有内容。';

  if (!confirm(confirmMessage)) {
    return;
  }

  isInserting.value = true;
  try {
    // 1. 获取当前光标所在的块ID
    const currentBlockId = getCurrentBlockId();
    if (!currentBlockId) {
      // 备用方案：使用激活窗口的文档
      const protyle = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)');
      const docId = protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id');

      if (!docId) {
        showMessage('无法获取当前文档，请将光标放在文档中', 3000, 'error');
        return;
      }

      await insertContentToDocument(docId);
      return;
    }

    // 2. 通过块ID获取文档ID
    const docId = await getDocIdByBlockId(currentBlockId);
    if (!docId) {
      showMessage('无法获取当前文档信息', 3000, 'error');
      return;
    }

    await insertContentToDocument(docId);
  } catch (error) {
    console.error('插入文档失败:', error);
    showMessage('插入文档失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    isInserting.value = false;
  }
};

/**
 * 将内容插入到指定文档
 */
const insertContentToDocument = async (docId: string) => {
  try {
    // 获取文档信息（用于显示和历史记录）
    const docBlock = await api.getBlockByID(docId);
    if (!docBlock) {
      showMessage('无法获取文档信息', 3000, 'error');
      return;
    }

    // 获取原始内容（用于撤回）
    const docContent = await api.exportMdContent(docId);
    const originalContent = docContent?.content || '';

    // 保存到编辑历史（用于撤回）
    lastEditHistory.value = {
      docId: docId,
      docTitle: docBlock.content || '未命名文档',
      originalContent: removeFrontmatter(originalContent),
      timestamp: Date.now()
    };

    // 转换为思源兼容的 Markdown 格式
    const siyuanContent = convertToSiyuanMarkdown(generatedContent.value);

    // 使用updateBlock API更新文档内容
    await api.updateBlock('markdown', siyuanContent, docId);

    showMessage(`✓ 已插入到文档: ${docBlock.content || '未命名文档'}`, 2000, 'info');
  } catch (error) {
    console.error('插入内容失败:', error);
    throw error;
  }
};

// 需求1：取消文档引用
const cancelDocReference = () => {
  referencedDocTitle.value = '';
  referencedDocContent.value = '';
  showMessage('✓ 已取消文档引用', 1500, 'info');
};

// 清除内容
const clearContent = () => {
  generatedContent.value = '';
  displayedContent.value = '';
  errorMessage.value = '';
  showRaw.value = false;
  stopTypewriter();
};

// 选择目标文档
const selectTargetDocument = async () => {
  try {
    // 获取当前光标所在的块ID
    const currentBlockId = getCurrentBlockId();
    if (!currentBlockId) {
      // 备用方案：使用激活窗口的文档
      const protyle = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)');
      const docId = protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id');

      if (!docId) {
        showMessage('无法获取当前文档，请将光标放在文档中', 3000, 'error');
        return;
      }

      await loadTargetDocument(docId);
      return;
    }

    // 通过块ID获取文档ID
    const docId = await getDocIdByBlockId(currentBlockId);
    if (!docId) {
      showMessage('无法获取当前文档信息', 3000, 'error');
      return;
    }

    await loadTargetDocument(docId);
  } catch (error) {
    console.error('选择文档失败:', error);
    showMessage('选择文档失败: ' + (error as Error).message, 3000, 'error');
  }
};

// 加载目标文档
const loadTargetDocument = async (docId: string) => {
  try {
    // 获取文档块信息
    const docBlock = await api.getBlockByID(docId);
    if (!docBlock) {
      showMessage('无法获取文档信息', 3000, 'error');
      return;
    }

    // 获取文档的Markdown内容
    const docContent = await api.exportMdContent(docId);
    if (!docContent || !docContent.content) {
      showMessage('无法获取文档内容', 3000, 'error');
      return;
    }

    // 移除frontmatter，获取纯净的Markdown内容
    const cleanContent = removeFrontmatter(docContent.content);

    // 保存文档信息（使用清理后的内容）
    editTargetDoc.value = {
      id: docId,
      title: docBlock.content || '未命名文档',
      content: cleanContent
    };

    // 保存原始内容用于对比（使用清理后的内容）
    originalContent.value = cleanContent;

    // 将文档内容加载到生成内容区域（使用清理后的内容）
    generatedContent.value = cleanContent;
    displayedContent.value = cleanContent;

    showMessage(`✓ 已选择文档: ${editTargetDoc.value.title}`, 2000, 'info');
  } catch (error) {
    console.error('加载文档失败:', error);
    showMessage('加载文档失败: ' + (error as Error).message, 3000, 'error');
  }
};

// 清除目标文档
const clearTargetDocument = () => {
  clearEditState();
  clearContent();
  showMessage('✓ 已清除目标文档', 1500, 'info');
};





// 应用编辑
const applyEdit = async () => {
  if (!editTargetDoc.value) return;

  isApplying.value = true;
  try {
    // 保存编辑历史（用于撤回）
    lastEditHistory.value = {
      docId: editTargetDoc.value.id,
      docTitle: editTargetDoc.value.title,
      originalContent: originalContent.value,
      timestamp: Date.now()
    };

    // 转换为思源兼容的 Markdown 格式
    const siyuanContent = convertToSiyuanMarkdown(generatedContent.value);

    // 使用updateBlock API更新文档内容
    await api.updateBlock('markdown', siyuanContent, editTargetDoc.value.id);

    showMessage(`✓ 已更新文档: ${editTargetDoc.value.title}`, 2000, 'info');

    // 更新原始内容为当前内容
    originalContent.value = generatedContent.value;
    editTargetDoc.value.content = generatedContent.value;
  } catch (error) {
    console.error('应用编辑失败:', error);
    showMessage('应用编辑失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    isApplying.value = false;
  }
};

// 撤回编辑
const undoEdit = async () => {
  if (!lastEditHistory.value) return;

  isUndoing.value = true;
  try {
    // 恢复原始内容
    await api.updateBlock('markdown', lastEditHistory.value.originalContent, lastEditHistory.value.docId);

    showMessage(`✓ 已撤回对文档的编辑: ${lastEditHistory.value.docTitle}`, 2000, 'info');

    // 如果当前编辑的是同一个文档，更新界面
    if (editTargetDoc.value && editTargetDoc.value.id === lastEditHistory.value.docId) {
      generatedContent.value = lastEditHistory.value.originalContent;
      displayedContent.value = lastEditHistory.value.originalContent;
      originalContent.value = lastEditHistory.value.originalContent;
      editTargetDoc.value.content = lastEditHistory.value.originalContent;
    }

    // 清除历史记录
    lastEditHistory.value = null;
  } catch (error) {
    console.error('撤回编辑失败:', error);
    showMessage('撤回编辑失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    isUndoing.value = false;
  }
};

/**
 * AI智能编辑功能
 */
const aiEditAction = async (action: 'polish' | 'expand' | 'condense' | 'fix') => {
  if (!editTargetDoc.value) {
    showMessage('请先选择要编辑的文档', 2000, 'info');
    return;
  }

  const actionPrompts = {
    polish: '请对以下文档进行润色优化，保持原有结构，提升语言质量和可读性，使表达更加专业、流畅。保持Markdown格式，直接输出优化后的完整文档内容：',
    expand: '请对以下文档进行扩写，增加更详细的说明、例子和补充信息，使内容更加丰富和全面。保持Markdown格式，直接输出扩写后的完整文档内容：',
    condense: '请对以下文档进行精简，去除冗余内容，保留核心要点，使表达更加简洁有力。保持Markdown格式，直接输出精简后的完整文档内容：',
    fix: '请对以下文档进行错误检查和修正，包括拼写错误、语法错误、逻辑错误等。保持Markdown格式，直接输出修正后的完整文档内容：'
  };

  isGenerating.value = true;
  generatedContent.value = '';
  displayedContent.value = '';
  errorMessage.value = '';
  aiSuggestions.value = null; // 清除之前的建议

  try {
    const options: GenerateOptions = {
      userInput: `${actionPrompts[action]}\n\n${editTargetDoc.value.content}`,
      systemPrompt: '你是一个专业的文档编辑助手，擅长优化Markdown文档。请直接输出优化后的完整文档，不要添加任何解释性文字。',
      temperature: 0.3, // 降低创造性，提高准确性
      maxTokens: maxTokens.value,
      onChunk: (chunk: string) => {
        displayedContent.value += chunk;
        generatedContent.value += chunk;
      }
    };

    await props.onGenerate(options);

    showMessage('✓ AI编辑完成', 2000, 'info');
  } catch (error) {
    console.error('AI编辑失败:', error);
    errorMessage.value = (error as Error).message || 'AI编辑失败';
    showMessage('AI编辑失败: ' + errorMessage.value, 3000, 'error');
  } finally {
    isGenerating.value = false;
  }
};

/**
 * AI文档分析和建议
 */
const analyzeDocument = async () => {
  if (!editTargetDoc.value) {
    showMessage('请先选择要分析的文档', 2000, 'info');
    return;
  }

  isAnalyzing.value = true;
  try {
    const options: GenerateOptions = {
      userInput: `请分析以下文档，提供具体的优化建议，包括但不限于：
1. 结构优化建议
2. 内容完善建议
3. 语言表达改进点
4. 逻辑性和连贯性建议

请用简洁的语言给出分析报告和可执行的建议。\n\n文档内容：\n${editTargetDoc.value.content}`,
      systemPrompt: '你是一个专业的文档分析专家，擅长发现文档中的问题并提供建设性的优化意见。',
      temperature: 0.5,
      maxTokens: 1500,
      onChunk: (chunk: string) => {
        if (!aiSuggestions.value) {
          aiSuggestions.value = chunk;
        } else {
          aiSuggestions.value += chunk;
        }
      }
    };

    await props.onGenerate(options);
    showMessage('✓ 分析完成', 2000, 'info');
  } catch (error) {
    console.error('文档分析失败:', error);
    showMessage('文档分析失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    isAnalyzing.value = false;
  }
};

/**
 * 应用AI建议进行优化
 */
const applySuggestions = async () => {
  if (!editTargetDoc.value || !aiSuggestions.value) return;

  isGenerating.value = true;
  generatedContent.value = '';
  displayedContent.value = '';
  errorMessage.value = '';

  try {
    const options: GenerateOptions = {
      userInput: `请根据以下分析建议，对文档进行优化。直接输出优化后的完整文档内容，保持Markdown格式。

分析建议：
${aiSuggestions.value}

原文档：
${editTargetDoc.value.content}`,
      systemPrompt: '你是一个专业的文档编辑助手。请根据建议优化文档，直接输出结果，不要添加解释。',
      temperature: 0.3,
      maxTokens: maxTokens.value,
      onChunk: (chunk: string) => {
        displayedContent.value += chunk;
        generatedContent.value += chunk;
      }
    };

    await props.onGenerate(options);

    hasContentChanged.value = true;
    aiSuggestions.value = null; // 应用后清除建议
    showMessage('✓ 已应用优化建议', 2000, 'info');
  } catch (error) {
    console.error('应用建议失败:', error);
    errorMessage.value = (error as Error).message || '应用建议失败';
    showMessage('应用建议失败: ' + errorMessage.value, 3000, 'error');
  } finally {
    isGenerating.value = false;
  }
};

// 保存当前提示词配置
const saveCurrentPrompt = async () => {
  if (!newPromptName.value.trim()) {
    showMessage(props.i18n.enterPromptName || '请输入配置名称', 2000, 'info');
    return;
  }

  const promptConfig: AIPromptConfig = {
    id: Date.now().toString(),
    name: newPromptName.value.trim(),
    systemPrompt: systemPrompt.value,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    enableMarkdown: enableMarkdown.value,
    enableTypewriter: enableTypewriter.value,
    contextMessageLimit: contextMessageLimit.value,
    createdAt: Date.now()
  };

  savedPrompts.value.push(promptConfig);

  try {
    if (storage) {
      await storage.savePrompts(savedPrompts.value);
    } else {
      // 降级使用localStorage
      localStorage.setItem('ai-content-generator-prompts', JSON.stringify(savedPrompts.value));
    }
  } catch (error) {
    console.error('保存提示词配置失败:', error);
  }

  newPromptName.value = '';
  showMessage(`✓ 已保存配置: ${promptConfig.name}`, 2000, 'info');
};

// 清除当前提示词选择
const clearCurrentPrompt = async () => {
  currentPromptName.value = '';

  try {
    if (storage) {
      await storage.clearCurrentPrompt();
    } else {
      // 降级使用localStorage
      localStorage.removeItem('ai-content-generator-current-prompt');
    }
    showMessage('✓ 已清除提示词选择', 1500, 'info');
  } catch (error) {
    console.error('清除当前提示词失败:', error);
  }
};

/**
 * 获取当前光标所在的块ID
 */
function getCurrentBlockId(): string | null {
  // 方法1: 获取当前选中的块
  const selectedBlock = document.querySelector('.protyle-wysiwyg--select');
  if (selectedBlock) {
    return selectedBlock.getAttribute('data-node-id');
  }

  // 方法2: 获取光标所在的块（聚焦的块）
  const focusedBlock = document.querySelector('.protyle-wysiwyg [data-node-id].protyle-wysiwyg--focus');
  if (focusedBlock) {
    return focusedBlock.getAttribute('data-node-id');
  }

  // 方法3: 通过 window.getSelection() 精确获取光标位置
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    let node: Node | null = range.startContainer;

    // 向上查找直到找到带有 data-node-id 和 data-type 的元素
    while (node) {
      if (node instanceof Element) {
        const nodeId = node.getAttribute('data-node-id');
        const dataType = node.getAttribute('data-type');

        // 必须同时有 data-node-id 和 data-type 才是有效的块
        if (nodeId && dataType) {
          return nodeId;
        }
      }
      node = node.parentNode;
    }
  }

  return null;
}

/**
 * 通过块ID获取其所属的文档ID
 */
async function getDocIdByBlockId(blockId: string): Promise<string | null> {
  try {
    const block = await api.getBlockByID(blockId);
    return block?.root_id || null;
  } catch (error) {
    console.error('获取文档ID失败:', error);
    return null;
  }
}

/**
 * 插入当前文档引用（修复问题2）
 */
const insertCurrentDocReference = async () => {
  try {
    // 1. 获取当前光标所在的块ID
    const currentBlockId = getCurrentBlockId();
    if (!currentBlockId) {
      // 备用方案：使用激活窗口的文档
      const protyle = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)');
      const docId = protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id');

      if (!docId) {
        showMessage('无法获取当前文档，请将光标放在文档中', 3000, 'error');
        return;
      }

      await loadDocumentContent(docId);
      return;
    }

    // 2. 通过块ID获取文档ID
    const docId = await getDocIdByBlockId(currentBlockId);
    if (!docId) {
      showMessage('无法获取当前文档信息', 3000, 'error');
      return;
    }

    await loadDocumentContent(docId);
  } catch (error) {
    console.error('引用文档失败:', error);
    showMessage('引用文档失败: ' + (error as Error).message, 3000, 'error');
  }
};

/**
 * 加载文档内容
 */
async function loadDocumentContent(docId: string) {
  try {
    // 3. 获取文档块信息
    const docBlock = await api.getBlockByID(docId);
    if (!docBlock) {
      showMessage('无法获取文档信息', 3000, 'error');
      return;
    }

    // 4. 获取文档的Markdown内容
    const docContent = await api.exportMdContent(docId);
    if (!docContent || !docContent.content) {
      showMessage('无法获取文档内容', 3000, 'error');
      return;
    }

    // 5. 保存引用的文档信息
    referencedDocTitle.value = docBlock.content || '未命名文档';
    referencedDocContent.value = docContent.content;

    console.log('文档引用成功:', {
      title: referencedDocTitle.value,
      contentLength: referencedDocContent.value.length,
      contentPreview: referencedDocContent.value.substring(0, 200)
    });

    showMessage(`✓ 已引用文档: ${referencedDocTitle.value}`, 2000, 'info');
  } catch (error) {
    console.error('加载文档内容失败:', error);
    throw error;
  }
}

// 加载提示词配置（需求3：持久化保存）
const loadPrompt = (index: number) => {
  const prompt = savedPrompts.value[index];
  if (!prompt) return;

  systemPrompt.value = prompt.systemPrompt;
  temperature.value = prompt.temperature;
  maxTokens.value = prompt.maxTokens;
  enableMarkdown.value = prompt.enableMarkdown;
  enableTypewriter.value = prompt.enableTypewriter;

  // 设置当前选中的提示词名称
  currentPromptName.value = prompt.name;

  // 需求3：保存到localStorage
  localStorage.setItem(CURRENT_PROMPT_STORAGE_KEY, prompt.name);

  showPromptSelector.value = false;
  showMessage(`✓ 已加载配置: ${prompt.name}`, 2000, 'info');
};

// 删除提示词配置
const deletePrompt = (index: number) => {
  const prompt = savedPrompts.value[index];
  if (!prompt) return;

  if (confirm(`${props.i18n.confirmDelete || '确定删除配置'}: ${prompt.name}?`)) {
    savedPrompts.value.splice(index, 1);
    savePromptsToStorage();
    showMessage(`✓ 已删除配置: ${prompt.name}`, 2000, 'info');
  }
};

// 获取提示词预览
const getPromptPreview = (text: string): string => {
  const maxLength = 60;
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// 保存提示词到存储
const savePromptsToStorage = async () => {
  if (!storage) return;

  try {
    await storage.savePrompts(savedPrompts.value);
  } catch (error) {
    console.error('保存提示词配置失败:', error);
    // 降级使用localStorage
    try {
      localStorage.setItem('ai-content-generator-prompts', JSON.stringify(savedPrompts.value));
    } catch (localError) {
      console.error('localStorage保存也失败:', localError);
    }
  }
};

// 从存储加载提示词配置
const loadPromptsFromStorage = async () => {
  if (!storage) {
    // 降级使用localStorage
    try {
      const stored = localStorage.getItem('ai-content-generator-prompts');
      if (stored) {
        savedPrompts.value = JSON.parse(stored);
      }

      const currentPrompt = localStorage.getItem('ai-content-generator-current-prompt');
      if (currentPrompt) {
        const promptIndex = savedPrompts.value.findIndex(p => p.name === currentPrompt);
        if (promptIndex !== -1) {
          loadPrompt(promptIndex);
        }
      }
    } catch (error) {
      console.error('从localStorage加载提示词配置失败:', error);
    }
    return;
  }

  try {
    const prompts = await storage.loadPrompts();
    if (prompts) {
      savedPrompts.value = prompts;
    }

    const currentPromptName = await storage.loadCurrentPrompt();
    if (currentPromptName) {
      const promptIndex = savedPrompts.value.findIndex(p => p.name === currentPromptName);
      if (promptIndex !== -1) {
        loadPrompt(promptIndex);
      }
    }
  } catch (error) {
    console.error('从插件存储加载提示词配置失败:', error);
    // 降级尝试localStorage
    try {
      const stored = localStorage.getItem('ai-content-generator-prompts');
      if (stored) {
        savedPrompts.value = JSON.parse(stored);
      }

      const currentPrompt = localStorage.getItem('ai-content-generator-current-prompt');
      if (currentPrompt) {
        const promptIndex = savedPrompts.value.findIndex(p => p.name === currentPrompt);
        if (promptIndex !== -1) {
          loadPrompt(promptIndex);
        }
      }
    } catch (localError) {
      console.error('从localStorage加载也失败:', localError);
    }
  }
};

// 组件挂载时加载保存的提示词
onMounted(async () => {
  // 初始化存储实例
  if (props.plugin) {
    storage = new AIGeneratorStorage(props.plugin);
    await storage.init();
    loadPromptsFromStorage();
    loadSettings();
  } else {
    // 降级使用localStorage
    loadPromptsFromStorage();
    loadSettings();
  }
});

// 使用模板
const useTemplate = (templateType: string) => {
  const templates: Record<string, string> = {
    article: '请为以下主题生成一个详细的文章大纲，包含引言、主要章节和结论：',
    summary: '请总结以下内容的核心要点，使用简洁的列表形式：',
    todo: '请根据以下项目目标生成一个详细的待办事项清单：',
    ideas: '请针对以下主题进行头脑风暴，生成至少10个创意想法：'
  };

  userInput.value = templates[templateType] || '';
};

// 保存设置到存储
const saveSettings = async () => {
  if (!storage) return;

  const settings = {
    systemPrompt: systemPrompt.value,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    enableMarkdown: enableMarkdown.value,
    enableTypewriter: enableTypewriter.value,
    contextMessageLimit: contextMessageLimit.value
  };

  try {
    const success = await storage.saveSettings(settings);
    if (success) {
      console.log('AI生成器设置已保存');
    }
  } catch (error) {
    console.error('保存设置失败:', error);
    // 降级使用localStorage
    try {
      localStorage.setItem('ai-content-generator-settings', JSON.stringify(settings));
    } catch (localError) {
      console.error('localStorage保存也失败:', localError);
    }
  }
};

// 加载设置
const loadSettings = async () => {
  if (!storage) {
    // 降级使用localStorage
    try {
      const saved = localStorage.getItem('ai-content-generator-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        systemPrompt.value = settings.systemPrompt || systemPrompt.value;
        temperature.value = settings.temperature ?? temperature.value;
        maxTokens.value = settings.maxTokens || maxTokens.value;
        enableMarkdown.value = settings.enableMarkdown ?? enableMarkdown.value;
        enableTypewriter.value = settings.enableTypewriter ?? enableTypewriter.value;
        contextMessageLimit.value = settings.contextMessageLimit ?? contextMessageLimit.value;
      }
    } catch (error) {
      console.error('从localStorage加载设置失败:', error);
    }
    return;
  }

  try {
    const settings = await storage.loadSettings();
    if (settings) {
      systemPrompt.value = settings.systemPrompt || systemPrompt.value;
      temperature.value = settings.temperature ?? temperature.value;
      maxTokens.value = settings.maxTokens || maxTokens.value;
      enableMarkdown.value = settings.enableMarkdown ?? enableMarkdown.value;
      enableTypewriter.value = settings.enableTypewriter ?? enableTypewriter.value;
      contextMessageLimit.value = settings.contextMessageLimit ?? contextMessageLimit.value;
    }
  } catch (error) {
    console.error('从插件存储加载设置失败:', error);
    // 降级尝试localStorage
    try {
      const saved = localStorage.getItem('ai-content-generator-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        systemPrompt.value = settings.systemPrompt || systemPrompt.value;
        temperature.value = settings.temperature ?? temperature.value;
        maxTokens.value = settings.maxTokens || maxTokens.value;
        enableMarkdown.value = settings.enableMarkdown ?? enableMarkdown.value;
        enableTypewriter.value = settings.enableTypewriter ?? enableTypewriter.value;
        contextMessageLimit.value = settings.contextMessageLimit ?? contextMessageLimit.value;
      }
    } catch (localError) {
      console.error('从localStorage加载设置也失败:', localError);
    }
  }
};

// 监听设置变化（需求5：包含contextMessageLimit）
watch([systemPrompt, temperature, maxTokens, enableMarkdown, enableTypewriter, contextMessageLimit], () => {
  saveSettings();
});

// 初始化
loadSettings();
</script>

<style scoped lang="scss">
 @import "./index.scss";
</style>
