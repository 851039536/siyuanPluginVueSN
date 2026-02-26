<template>
  <div
    class="ai-content-panel"
    :class="{ 'is-dragging': isDragging, ['drag-over-' + dragOverType]: dragOverType }"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    @dragend="handleDragEnd"
  >
    <!-- 拖拽提示遮罩 -->
    <div v-if="isDragging" class="drag-overlay">
      <div class="drag-overlay-content">
        <svg width="48" height="48">
          <use xlink:href="#iconDownload"></use>
        </svg>
        <p class="drag-text">{{ getDragText() }}</p>
        <p class="drag-hint">松开鼠标加载文档</p>
      </div>
    </div>

    <!-- 顶部工具栏 -->
    <PanelHeader @toggle-settings="toggleSettings" />

    <!-- 提示词配置面板 -->
    <SettingsPanel
      :showSettings="showSettings"
      :collapsed="collapsedSections.settings"
      v-model:systemPrompt="systemPrompt"
      v-model:temperature="temperature"
      v-model:maxTokens="maxTokens"
      v-model:contextMessageLimit="contextMessageLimit"
      :currentPromptName="currentPromptName"
      v-model:newPromptName="newPromptName"
      @toggle-settings="toggleSettings"
      @toggle-collapse="toggleCollapse('settings')"
      @save-current-prompt="saveCurrentPrompt"
      @on-prompt-name-focus="onPromptNameFocus"
    />

    <!-- 内容显示区域（移到上方） -->
    <div class="content-display-section">
    <!-- AI查重结果面板 -->
    <PlagiarismResultPanel
      v-if="plagiarismResult"
      :plagiarismResult="plagiarismResult"
      :collapsed="collapsedSections.plagiarism"
      :renderedHtml="renderPlagiarismMarkdown"
      @toggle-collapse="toggleCollapse('plagiarism')"
      @close="plagiarismResult = null"
    />

      <!-- 主内容显示区域 -->
      <MainContentArea
        :is-generating="isGenerating"
        :is-applying="isApplying"
        :is-undoing="isUndoing"
        :is-inserting-sub-doc="isInsertingSubDoc"
        :error-message="errorMessage"
        :displayed-content="displayedContent"
        :generated-content="generatedContent"
        :original-content="originalContent"
        :rendered-markdown="renderedDisplayedMarkdown"
        :show-diff-mode="showDiffMode"
        :diff-mode="diffMode"
        :can-apply="!!editTargetDoc && !isApplying && !isGenerating"
        :can-show-diff="!!editTargetDoc && !!originalContent && !!generatedContent && originalContent !== generatedContent"
        :can-insert-sub-doc="!!editTargetDoc && !isInsertingSubDoc && !isGenerating"
        :can-undo="!!lastEditHistory"
        @stop="handleStop"
        @apply-edit="applyEdit"
        @toggle-diff="showDiffMode = !showDiffMode"
        @insert-subdoc="insertSubDocument"
        @undo-edit="undoEdit"
        @copy="copyContent"
        @clear="clearContent"
        @update:diff-mode="diffMode = $event"
      />
    </div>

    <!-- 底部输入区域 -->
    <div class="bottom-input-section">
      <!-- AI智能编辑工具栏 -->
      <div v-if="editTargetDoc" class="ai-edit-toolbar">
        <div class="toolbar-label">
          <div class="section-title-wrapper">
            <svg width="14" height="14">
              <use xlink:href="#iconSparkles"></use>
            </svg>
            <span>{{'AI智能编辑' }}:</span>
            <Button
              :class="['btn-collapse', { 'collapsed': collapsedSections.aiToolbar }]"
              @click="toggleCollapse('aiToolbar')"
              :title="collapsedSections.aiToolbar ? '展开工具栏' : '折叠工具栏'"
              variant="ghost"
              size="small"
            >
              <svg width="14" height="14" class="collapse-icon">
                <use :xlink:href="collapsedSections.aiToolbar ? '#iconRight' : '#iconDown'"></use>
              </svg>
            </Button>
          </div>
        </div>
        <div class="toolbar-actions" :class="{ 'collapsed': collapsedSections.aiToolbar }">
          <Button  @click="aiEditAction('polish')" :disabled="isGenerating" :title="'AI润色'" variant="ghost" size="small">
            <svg width="14" height="14"><use xlink:href="#iconEdit"></use></svg>
            {{'润色' }}
          </Button>
          <Button  @click="aiEditAction('expand')" :disabled="isGenerating" :title="'扩写内容'" variant="ghost" size="small">
            <svg width="14" height="14"><use xlink:href="#iconAdd"></use></svg>
            {{'扩写' }}
          </Button>
          <Button  @click="aiEditAction('condense')" :disabled="isGenerating" :title="'精简内容'" variant="ghost" size="small">
            <svg width="14" height="14"><use xlink:href="#iconMin"></use></svg>
            {{'精简' }}
          </Button>
          <Button  @click="aiEditAction('fix')" :disabled="isGenerating" :title="'修正错误'" variant="ghost" size="small">
            <svg width="14" height="14"><use xlink:href="#iconCheck"></use></svg>
            {{'纠错' }}
          </Button>
          <Button  @click="aiEditAction('translate')" :disabled="isGenerating" :title="'翻译文档'" variant="ghost" size="small">
            <svg width="14" height="14"><use xlink:href="#iconLanguage"></use></svg>
            {{'翻译' }}
          </Button>
          <Button  @click="aiEditAction('rewrite')" :disabled="isGenerating" :title="'改写文档'" variant="ghost" size="small">
            <svg width="14" height="14"><use xlink:href="#iconRefresh"></use></svg>
            {{'改写' }}
          </Button>
          <Button  @click="aiEditAction('summary')" :disabled="isGenerating" :title="'AI总结文档'" variant="ghost" size="small">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M13,12.5L11.5,14L10,12.5V16H8V12.5L10,14L11.5,12.5L13,14V16H15V12.5L13,12.5Z" />
            </svg>
            {{'总结' }}
          </Button>

          <Button v-if="!isCheckingPlagiarism" @click="checkPlagiarism" :disabled="isGenerating" :title="'AI查重'" variant="ghost" size="small">
            <svg width="14" height="14"><use xlink:href="#iconSearch"></use></svg>
            {{'查重' }}
          </Button>
          <Button v-else @click="handleStop" :title="'停止生成'" variant="danger" size="small">
            <svg width="14" height="14"><use xlink:href="#iconClose"></use></svg>
            {{'停止' }}
          </Button>
        </div>
      </div>

      <!-- 编辑模式：紧凑工具栏（提示词选择 + 目标文档选择 + 输入框 + 执行按钮） -->
      <div class="compact-toolbar edit-mode">
        <!-- 提示词选择按钮 -->
        <div class="prompt-selector-wrapper">
          <Button  variant="ghost" size="small" @click="showPromptSelector = !showPromptSelector" :title="currentPromptName || ('选择提示词')">
            <svg width="14" height="14">
              <use xlink:href="#iconList"></use>
            </svg>
            <span v-if="currentPromptName" class="prompt-name-compact">{{ currentPromptName }}</span>
            <span v-else>{{ '提示词' }}</span>
            <span v-if="savedPrompts.length > 0 && !currentPromptName" class="prompt-count-compact">{{ savedPrompts.length }}</span>
            <Button v-if="currentPromptName" variant="ghost" size="small"  @click.stop="clearCurrentPrompt" :title="'清除'">
              <svg width="10" height="10">
                <use xlink:href="#iconClose"></use>
              </svg>
            </Button>
          </Button>

          <!-- 提示词选择面板 -->
          <div v-if="showPromptSelector" class="prompt-selector-panel">
            <div class="prompt-selector-header">
              <Button @click="showPromptSelector = false" variant="ghost" size="small">
                <svg width="12" height="12">
                  <use xlink:href="#iconClose"></use>
                </svg>
              </Button>
            </div>

            <!-- 搜索框 -->
            <div v-if="savedPrompts.length > 5" class="prompt-search-wrapper">
              <Input
                v-model="promptSearchQuery"
                type="text"
                :placeholder="'搜索提示词...'"
              />
            </div>

            <div v-if="filteredPrompts.length === 0" class="empty-prompts">
              <p v-if="savedPrompts.length === 0">{{'暂无保存的提示词，请在对话设置中保存' }}</p>
              <p v-else>{{'没有找到匹配的提示词' }}</p>
            </div>

            <div v-else class="prompt-list">
              <div
                v-for="(prompt, index) in paginatedPrompts"
                :key="prompt.id || index"
                class="prompt-item"
                @click="loadPrompt(getOriginalIndex(prompt))"
              >
                <div class="prompt-item-header">
                  <span class="prompt-name">{{ prompt.name }}</span>
                  <div class="prompt-item-actions">
                    <Button
                      @click.stop="editPrompt(getOriginalIndex(prompt))"
                      :title="'编辑'"
                      variant="ghost"
                      size="small"
                    >
                      <svg width="14" height="14">
                        <use xlink:href="#iconEdit"></use>
                      </svg>
                    </Button>
                    <Button
                      @click.stop="deletePrompt(getOriginalIndex(prompt))"
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
                  <span>{{'创造性' }}: {{ prompt.temperature }}</span>
                  <span>{{'最大长度' }}: {{ prompt.maxTokens }}</span>
                </div>
              </div>

              <!-- 分页控制 -->
              <div v-if="totalPages > 1" class="prompt-pagination">
                <Button
                  @click="currentPage = Math.max(1, currentPage - 1)"
                  :disabled="currentPage === 1"
                  :title="'上一页'"
                  variant="ghost"
                  size="small"
                >
                  ‹
                </Button>
                <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
                <Button
                  @click="currentPage = Math.min(totalPages, currentPage + 1)"
                  :disabled="currentPage === totalPages"
                  :title="'下一页'"
                  variant="ghost"
                  size="small"
                >
                  ›
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- 目标文档选择 -->
        <div class="doc-selector-wrapper">
          <Button  variant="ghost" size="small" @click="selectTargetDocument" :title="editTargetDoc ? editTargetDoc.title : ('选择文档')">
            <svg width="14" height="14">
              <use xlink:href="#iconFile"></use>
            </svg>
            <span v-if="editTargetDoc" class="doc-name-compact">
              {{ editTargetDoc.title }}
              <Tag v-if="editTargetDoc.isBlock" size="small" variant="primary" title="块内容">块</Tag>
            </span>
            <span v-else>{{ '选择文档' }}</span>
            <Button v-if="editTargetDoc" variant="ghost" size="small"  @click.stop="clearTargetDocument" :title="'清除'">
              <svg width="10" height="10">
                <use xlink:href="#iconClose"></use>
              </svg>
            </Button>
          </Button>
        </div>

        <!-- 编辑模式：自定义输入框 -->
        <Textarea
          v-if="editTargetDoc"
          v-model="editCustomInput"
          :placeholder="'输入编辑指令...'"
          :rows="1"
          :autosize="true"
          :disabled="isGenerating"
          @keydown.ctrl.enter="handleCustomEdit"
        />

        <!-- 执行/停止按钮 -->
        <Button
          v-if="!isGenerating && editTargetDoc"
          @click="handleCustomEdit"
          :disabled="!editCustomInput.trim() && !currentPromptName"
          :title="!editCustomInput.trim() && currentPromptName ? '使用当前提示词生成' : '执行'"
          variant="primary"
          size="small"
        >
          <svg width="16" height="16">
            <use xlink:href="#iconSparkles"></use>
          </svg>
        </Button>
        <Button
          v-else-if="isGenerating"
          @click="handleStop"
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
import PanelHeader from './components/PanelHeader.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import PlagiarismResultPanel from './components/PlagiarismResultPanel.vue';
import MainContentArea from './components/MainContentArea.vue';
import Button from '@/components/Button.vue';
import Input from '@/components/Input.vue';
import Textarea from '@/components/Textarea.vue';
import Tag from '@/components/Tag.vue';

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
  onChunk?: (chunk: string) => void; // 流式输出回调
}

const props = withDefaults(defineProps<Props>(), {
  plugin: null
});

// 存储实例
let storage: AIGeneratorStorage | null = null;

// 状态
const generatedContent = ref('');
const isGenerating = ref(false);
const errorMessage = ref('');
const showSettings = ref(false);
const abortController = ref<AbortController | null>(null);

// 折叠状态管理
const collapsedSections = ref({
  settings: false,
  aiToolbar: false,
  plagiarism: false,
  promptSelector: false
});

// 编辑模式状态
interface TargetDoc {
  id: string;
  title: string;
  content: string;
  isBlock?: boolean; // 是否为块内容（区别于整个文档）
}
const editTargetDoc = ref<TargetDoc | null>(null);
const originalContent = ref(''); // 文档原始内容
const isApplying = ref(false);
const isUndoing = ref(false);
const isInsertingSubDoc = ref(false); // 插入子文档状态

// 拖拽相关状态
const isDragging = ref(false); // 是否正在拖拽
const dragOverType = ref<'block' | 'tab' | 'tree' | null>(null); // 拖拽类型

// AI智能编辑状态
const isCheckingPlagiarism = ref(false);
const plagiarismResult = ref<{
  riskLevel: 'low' | 'medium' | 'high';
  similarityRate: number;
  details: string;
} | null>(null);
const editCustomInput = ref(''); // 编辑模式自定义提问输入

// 编辑历史（用于撤回/重做）
interface EditHistory {
  docId: string;
  docTitle: string;
  originalContent: string;
  timestamp: number;
}
const lastEditHistory = ref<EditHistory | null>(null);

// 差异显示模式
const showDiffMode = ref(false); // 是否显示差异对比模式
const diffMode = ref<'split' | 'unified'>('split'); // 差异显示模式：分栏或统一

// 对话设置
const systemPrompt = ref('你是一个专业的内容创作助手，擅长生成结构清晰、格式规范的Markdown文档。请确保输出内容使用标准的Markdown语法。');
const temperature = ref(0.7);
const maxTokens = ref(10000);

// 上下文消息数量配置
const contextMessageLimit = ref(1);

// 上下文配置已删除
const displayedContent = ref(''); // 用于打字机效果显示的内容
// 提示词管理（与 AIPromptConfig 保持一致）
interface SavedPrompt {
  id: string;
  name: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  contextMessageLimit: number;
  createdAt: number;
}

const savedPrompts = ref<SavedPrompt[]>([]);
const showPromptSelector = ref(false);
const newPromptName = ref('');
const currentPromptName = ref(''); // 当前选中的提示词名称

// 提示词搜索和分页状态
const promptSearchQuery = ref('');
const currentPage = ref(1);

// ============ 常量定义 ============
const ITEMS_PER_PAGE = 10; // 每页显示数量

// 过滤后的提示词
const filteredPrompts = computed(() => {
  if (!promptSearchQuery.value.trim()) {
    return savedPrompts.value;
  }

  const query = promptSearchQuery.value.toLowerCase().trim();
  return savedPrompts.value.filter(prompt =>
    prompt.name.toLowerCase().includes(query) ||
    prompt.systemPrompt.toLowerCase().includes(query)
  );
});

// 分页后的提示词
const paginatedPrompts = computed(() => {
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  return filteredPrompts.value.slice(start, end);
});

// 总页数
const totalPages = computed(() => {
  return Math.ceil(filteredPrompts.value.length / ITEMS_PER_PAGE) || 1;
});

// 获取原始索引（用于处理过滤后的列表）
const getOriginalIndex = (prompt: SavedPrompt) => {
  return savedPrompts.value.findIndex(p => p.id === prompt.id);
};

// 监听搜索查询变化，重置页码
watch(promptSearchQuery, () => {
  currentPage.value = 1;
});

// 监听提示词选择面板显示状态，重置搜索
watch(showPromptSelector, (newVal) => {
  if (newVal) {
    promptSearchQuery.value = '';
    currentPage.value = 1;
  }
});

// ============ 公共工具函数 ============

/**
 * 开始生成内容的公共初始化
 */
const startGeneration = () => {
  abortController.value = new AbortController();
  isGenerating.value = true;
  generatedContent.value = '';
  displayedContent.value = '';
  errorMessage.value = '';
  plagiarismResult.value = null;
};

/**
 * 结束生成内容的公共清理
 */
const finishGeneration = () => {
  isGenerating.value = false;
  abortController.value = null;
  isCheckingPlagiarism.value = false;
};

/**
 * 处理生成过程中的错误
 * @returns true 表示是用户取消，调用方应直接返回
 */
const handleGenerationError = (error: Error, context: string, skipMessage = false): boolean => {
  if (error.name === 'AbortError') {
    return true;
  }
  console.error(`${context}失败:`, error);
  if (!skipMessage) {
    const message = error.message || `${context}失败`;
    errorMessage.value = message;
  }
  return false;
};

/**
 * 统一的文档加载函数
 */
const loadDocument = async (docId: string): Promise<{ title: string; content: string } | null> => {
  try {
    const docBlock = await api.getBlockByID(docId);
    if (!docBlock) {
      showMessage('无法获取文档信息', 3000, 'error');
      return null;
    }

    const docContent = await api.exportMdContent(docId);
    if (!docContent || !docContent.content) {
      showMessage('无法获取文档内容', 3000, 'error');
      return null;
    }

    return {
      title: docBlock.content || '未命名文档',
      content: docContent.content
    };
  } catch (error) {
    console.error('加载文档失败:', error);
    showMessage('加载文档失败: ' + (error as Error).message, 3000, 'error');
    return null;
  }
};

/**
 * 默认的流式输出回调（同时更新显示内容和生成内容）
 */
const defaultOnChunk = (chunk: string) => {
  displayedContent.value += chunk;
  generatedContent.value += chunk;
};

/**
 * 创建带自定义处理的流式回调
 * @param onUpdate 自定义更新函数，接收累积的内容
 * @returns 流式输出回调函数
 */
const createCustomStreamCallback = (onUpdate: (accumulatedContent: string) => void) => {
  let accumulated = '';
  return (chunk: string) => {
    accumulated += chunk;
    onUpdate(accumulated);
  };
};

/**
 * 获取激活窗口的文档ID
 */
const getActiveDocId = (): string | null => {
  const protyle = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)');
  return protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id') || null;
};

/**
 * 拖拽进入处理
 */
const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // 简化：只要进入面板就显示拖拽状态
  isDragging.value = true;
  dragOverType.value = 'block'; // 默认为块类型
};

/**
 * 拖拽悬停处理
 */
const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

/**
 * 拖拽离开处理
 */
const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  const target = e.target as HTMLElement;
  const panel = target.closest('.ai-content-panel');

  // 只有离开整个面板时才清除状态
  if (panel && !panel.contains(e.relatedTarget as Node)) {
    isDragging.value = false;
    dragOverType.value = null;
  }
};

/**
 * 拖拽放置处理
 * 支持：块拖拽、文档标签拖拽、文档树拖拽
 */
const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  isDragging.value = false;
  dragOverType.value = null;

  // 获取拖拽数据
  const transfer = e.dataTransfer;
  if (!transfer) {
    console.warn('⚠️ dataTransfer 为空');
    return;
  }

  // 尝试多种方式提取块 ID
  let blockId: string | null = null;
  let isBlockDrag = false;

  // 方式 1: 从 dataTransfer.types 中提取块 ID
  const typeResult = extractBlockIdFromTypes(transfer.types);
  if (typeResult.blockId) {
    blockId = typeResult.blockId;
    isBlockDrag = typeResult.isBlockDrag;
  }

  // 方式 2: 从数据内容提取
  if (!blockId) {
    blockId = extractBlockIdFromData(transfer);
  }

  // 方式 3: 从 items 异步获取
  if (!blockId && transfer.items.length > 0) {
    blockId = await extractBlockIdFromItems(transfer.items);
  }

  // 方式 4: 从当前激活文档获取（备用方案）
  if (!blockId) {
    blockId = getActiveDocId();
  }

  // 根据获取到的 ID 加载内容
  if (blockId) {
    // 如果还未确定是否为块拖拽，进行检测
    if (!isBlockDrag) {
      isBlockDrag = await detectDragType(blockId, transfer);
    }

    if (isBlockDrag) {
      await loadTargetBlock(blockId);
      showMessage('✓ 已加载块内容', 2000, 'info');
    } else {
      await loadTargetDocument(blockId);
      showMessage('✓ 已加载文档', 2000, 'info');
    }
  } else {
    console.error('❌ 无法获取 ID');
    showMessage('⚠️ 无法识别拖拽的内容', 3000, 'error');
  }
};

/**
 * 拖拽结束处理
 */
const handleDragEnd = () => {
  isDragging.value = false;
  dragOverType.value = null;
};

/**
 * 获取拖拽提示文本
 */
const getDragText = () => {
  const typeMap = {
    block: '拖拽块',
    tab: '拖拽标签页',
    tree: '拖拽文档'
  };
  return typeMap[dragOverType.value || 'block'] || '拖拽文档';
};

/**
 * 从 dataTransfer.types 中提取块 ID
 */
const extractBlockIdFromTypes = (types: readonly string[]): { blockId: string | null; isBlockDrag: boolean } => {
  for (const type of types) {
    // 匹配思源块拖拽的类型格式
    const blockIdMatch = type.match(/application\/siyuan-gutternodeparagraph\S+(\d{14}-[a-z0-9]+)/);
    if (blockIdMatch) {
      return { blockId: blockIdMatch[1], isBlockDrag: true };
    }

    // 备用：直接匹配块 ID 格式
    const idMatch = type.match(/(\d{14}-[a-z0-9]{7})/);
    if (idMatch) {
      return { blockId: idMatch[1], isBlockDrag: true };
    }
  }
  return { blockId: null, isBlockDrag: false };
};

/**
 * 从拖拽数据内容中提取块 ID
 */
const extractBlockIdFromData = (transfer: DataTransfer): string | null => {
  const possibleTypes = ['siyuan/block', 'text/plain', 'text/html', 'Files'];

  for (const type of possibleTypes) {
    if (transfer.types.includes(type)) {
      try {
        const data = transfer.getData(type);

        // 尝试解析 JSON
        try {
          const jsonData = JSON.parse(data);
          if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].id) {
            return jsonData[0].id;
          } else if (jsonData.id) {
            return jsonData.id;
          }
        } catch {
          // 不是 JSON 格式，继续尝试其他方式
        }

        // 尝试提取 ID（可能是块 ID 或文档 ID）
        const jsonMatch = data.match(/"id":"([^"]+)"/);
        if (jsonMatch) {
          return jsonMatch[1];
        }

        // HTML 格式
        const htmlIdMatch = data.match(/data-node-id="([^"]+)"/);
        if (htmlIdMatch) {
          return htmlIdMatch[1];
        }
      } catch (error) {
        console.warn(`⚠️ 读取 ${type} 数据失败:`, error);
      }
    }
  }
  return null;
};

/**
 * 异步从 dataTransfer.items 中提取块 ID
 */
const extractBlockIdFromItems = async (items: DataTransferItemList): Promise<string | null> => {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.kind === 'string') {
      try {
        const data = await new Promise<string>((resolve) => {
          item.getAsString(resolve);
        });

        const idMatch = data.match(/"id":"([^"]+)"/) || data.match(/data-node-id="([^"]+)"/);
        if (idMatch) {
          return idMatch[1];
        }
      } catch (error) {
        console.warn('⚠️ 读取 item 数据失败:', error);
      }
    }
  }
  return null;
};

/**
 * 检测拖拽类型（块还是文档）
 */
const detectDragType = async (blockId: string, transfer: DataTransfer): Promise<boolean> => {
  // 方法 1: 检查 dataTransfer.types 是否包含 'siyuan/block'
  if (transfer.types.includes('siyuan/block')) {
    return true;
  }

  // 方法 2: 通过获取块信息，检查 type 是否为文档类型
  try {
    const block = await api.getBlockByID(blockId);
    if (block) {
      // 如果 type 不是 'd'（文档类型），则是块拖拽
      if (block.type !== 'd') {
        return true;
      } else if (transfer.types.includes('text/html') && transfer.types.includes('text/plain')) {
        // 进一步检查：文档根节点的 content 通常为空或较短
        const data = transfer.getData('text/plain');
        if (data && data.length > 0 && !data.startsWith('{')) {
          return true;
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ 检查块类型失败:', error);
  }

  return false;
};

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

/**
 * 移除Markdown内容中的标题
 * @param content 原始内容
 * @returns 移除标题后的内容
 */
const removeHeadings = (content: string): string => {
  // 移除第一行（通常是对应标题）
  const lines = content.split('\n');
  if (lines.length <= 1) {
    return '';
  }
  // 移除第一行后返回剩余内容
  return lines.slice(1).join('\n').trim();
};


/**
 * 统一的 Markdown 渲染函数
 */
const renderMarkdown = (content: string, highlightKeywords: string[] = []): string => {
  if (!content) return '';

  try {
    // 配置 marked 选项（全局配置一次）
    marked.setOptions({
      breaks: true,
      gfm: true,
    });

    let processedContent = content;

    // 对特定关键词进行高亮标记
    const boldKeywords = highlightKeywords.filter(k => k.startsWith('bold:')).map(k => k.slice(6));
    const italicKeywords = highlightKeywords.filter(k => k.startsWith('italic:')).map(k => k.slice(8));

    boldKeywords.forEach(keyword => {
      processedContent = processedContent.replace(new RegExp(keyword, 'gi'), `**${keyword}**`);
    });
    italicKeywords.forEach(keyword => {
      processedContent = processedContent.replace(new RegExp(keyword, 'gi'), `*${keyword}*`);
    });

    // 移除标题中的粗体标记（对主内容）
    processedContent = processedContent.replace(/^(#{1,6})\s+\*\*(.+?)\*\*\s*$/gm, '$1 $2');

    return marked.parse(processedContent) as string;
  } catch (error) {
    console.error('Markdown渲染失败:', error);
    return `<pre>${content}</pre>`;
  }
};

// 渲染主内容 Markdown
const renderedDisplayedMarkdown = computed(() => {
  return renderMarkdown(displayedContent.value);
});

// 渲染查重结果 Markdown（带关键词高亮）
const renderPlagiarismMarkdown = computed(() => {
  if (!plagiarismResult.value?.details) return '';
  const highlightKeywords = [
    'bold:重复',
    'bold:相似',
    'italic:原创',
    'bold:建议',
    'bold:位置',
    'bold:风险'
  ];
  return renderMarkdown(plagiarismResult.value.details, highlightKeywords);
});

/**
 * 统一的代码高亮应用函数
 */
const applyCodeHighlighting = async (selector: string) => {
  await nextTick();
  const preBlocks = document.querySelectorAll(selector);
  preBlocks.forEach((block) => {
    if (!(block as HTMLElement).dataset.highlighted) {
      hljs.highlightElement(block as HTMLElement);
    }
  });
};

// 监听渲染内容变化，应用代码高亮
watch(renderedDisplayedMarkdown, () => applyCodeHighlighting('.markdown-preview pre code'));

// 监听查重结果渲染，应用代码高亮
watch(renderPlagiarismMarkdown, () => applyCodeHighlighting('.plagiarism-details .markdown-preview pre code'));

// 切换设置面板
const toggleSettings = () => {
  showSettings.value = !showSettings.value;
};

// 折叠切换函数
const toggleCollapse = (section: keyof typeof collapsedSections.value) => {
  collapsedSections.value[section] = !collapsedSections.value[section];
  saveCollapsedSections();
};

// 保存折叠状态到本地存储
const saveCollapsedSections = async () => {
  if (storage) {
    try {
      await storage.saveCollapsedSections(collapsedSections.value);
    } catch (error) {
      console.error('保存折叠状态失败:', error);
    }
  }
};

// 从本地存储加载折叠状态
const loadCollapsedSections = async () => {
  if (storage) {
    try {
      const saved = await storage.loadCollapsedSections();
      if (saved) {
        Object.assign(collapsedSections.value, saved);
      }
    } catch (error) {
      console.error('加载折叠状态失败:', error);
    }
  }
};

// 清理编辑模式状态
const clearEditState = () => {
  editTargetDoc.value = null;
  originalContent.value = '';
  resetEditRelatedState();
};

// 停止生成
const handleStop = () => {
  if (abortController.value) {
    abortController.value.abort();
  }
  // 重置所有相关状态
  isGenerating.value = false;
  isApplying.value = false;
  isUndoing.value = false;
  isInsertingSubDoc.value = false;
  isCheckingPlagiarism.value = false;
};

/**
 * 统一的内容处理函数
 * 移除 frontmatter 和标题，并转换为思源兼容格式
 */
const processContent = (content: string): string => {
  const withoutFrontmatter = removeFrontmatter(content);
  const withoutHeadings = removeHeadings(withoutFrontmatter);
  return convertToSiyuanMarkdown(withoutHeadings);
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
  const headingStart = /([^\n])\n(#{1,6}\s)/g;
  const headingEnd = /(#{1,6}\s[^\n]+)\n([^\n#])/g;
  converted = converted.replace(headingStart, '$1\n\n$2');
  converted = converted.replace(headingEnd, '$1\n\n$2');

  // 2. 处理粗体格式
  // 思源笔记在使用 markdown 模式时，粗体标记可能被解析但不显示效果
  // 临时解决方案：移除粗体标记，保留文本内容
  // TODO: 找到更好的方法让思源正确显示粗体
  converted = converted.replace(/\*\*([^*]+?)\*\*/g, '$1'); // 移除粗体标记
  converted = converted.replace(/__([^_]+?)__/g, '$1'); // 移除另一种粗体标记

  // 3. 处理斜体格式（同样可能有显示问题，暂时保留）
  // converted = converted.replace(/\*([^*]+?)\*/g, '$1'); // 如需移除斜体，取消注释

  // 4. 确保代码块前后有空行
  const codeBlockStart = /([^\n])\n```/g;
  const codeBlockEnd = /```\n([^\n])/g;
  converted = converted.replace(codeBlockStart, '$1\n\n```');
  converted = converted.replace(codeBlockEnd, '```\n\n$1');

  // 5. 确保列表前后有空行
  const listUnordered = /([^\n])\n([-*+]\s)/g;
  const listOrdered = /([^\n])\n(\d+\.\s)/g;
  converted = converted.replace(listUnordered, '$1\n\n$2');
  converted = converted.replace(listOrdered, '$1\n\n$2');

  // 6. 清理多余的连续空行（最多保留两个换行符）
  converted = converted.replace(/\n{3,}/g, '\n\n');

  return converted;
};

// 复制内容
const copyContent = async () => {
  if (!generatedContent.value) return;

  try {
    // 转换为思源兼容的 Markdown 格式
    const siyuanContent = convertToSiyuanMarkdown(generatedContent.value);
    await navigator.clipboard.writeText(siyuanContent);
    // showMessage('✓ 已复制Markdown到剪贴板', 2000, 'info');
  } catch (error) {
    console.error('复制失败:', error);
    showMessage('复制失败', 2000, 'error');
  }
};

// 清除内容
const clearContent = () => {
  generatedContent.value = '';
  displayedContent.value = '';
  errorMessage.value = '';
};

// 选择目标文档
const selectTargetDocument = async () => {
  try {
    // 优先使用激活窗口的文档ID，而不是依赖光标位置
    // 这样可以确保选择的是用户当前正在查看的文档
    const protyle = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)');
    let docId = protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id') || null;

    // 如果激活窗口方法失败，再通过光标位置获取
    if (!docId) {
      const currentBlockId = getCurrentBlockId();
      if (currentBlockId) {
        docId = await getDocIdByBlockId(currentBlockId);
      }
    }

    if (!docId) {
      showMessage('无法获取当前文档，请将光标放在文档中', 2000, 'error');
      return;
    }

    await loadTargetDocument(docId);
  } catch (error) {
    console.error('选择文档失败:', error);
  }
};

/**
 * 清理编辑模式相关的状态（通用清理函数）
 */
const resetEditRelatedState = () => {
  editCustomInput.value = '';
  plagiarismResult.value = null;
  lastEditHistory.value = null;
};

/**
 * 设置目标文档状态
 */
const setTargetDocState = (doc: TargetDoc, content: string) => {
  editTargetDoc.value = doc;
  originalContent.value = content;
  generatedContent.value = content;
  displayedContent.value = content;
  resetEditRelatedState();
};

// 加载目标文档
const loadTargetDocument = async (docId: string) => {
  const result = await loadDocument(docId);
  if (!result) return;

  // 移除frontmatter，获取纯净的Markdown内容
  const cleanContent = removeFrontmatter(result.content);

  // 设置目标文档状态
  setTargetDocState(
    {
      id: docId,
      title: result.title,
      content: cleanContent,
      isBlock: false
    },
    cleanContent
  );
};

/**
 * 加载目标块（用于拖拽块时只加载块内容）
 */
const loadTargetBlock = async (blockId: string) => {
  try {
    // 获取块信息
    const block = await api.getBlockByID(blockId);
    if (!block) {
      console.error('❌ 无法获取块信息');
      showMessage('无法获取块信息', 3000, 'error');
      return;
    }

    // 获取块的 Markdown 内容
    let blockContent = await api.getBlockMarkdown(blockId);

    // 备用方案：如果 getBlockMarkdown 失败，尝试使用 block.content
    if (!blockContent && block.content) {
      console.warn('⚠️ getBlockMarkdown 返回空，使用 block.content 作为备用');
      blockContent = block.content;

      // 对于标题块，添加标题标记
      if (block.type === 'h') {
        const level = (block as any).headingLevel || 1;
        const headingPrefix = '#'.repeat(level) + ' ';
        if (!blockContent.startsWith('#')) {
          blockContent = headingPrefix + blockContent;
        }
      }
    }

    if (!blockContent) {
      console.error('❌ 无法获取块内容，blockContent 为空');
      showMessage('无法获取块内容', 3000, 'error');
      return;
    }

    // 获取块所属文档的路径（用于显示）
    const hPath = await api.getHPathByID(block.root_id || blockId);
    const docName = hPath ? hPath.split('/').pop() : '未命名';

    // 构建块标题
    const blockTitle = block.content
      ? `${block.content.substring(0, 30)}${block.content.length > 30 ? '...' : ''}`
      : '块内容';

    // 移除 frontmatter
    const cleanContent = removeFrontmatter(blockContent);

    // 设置目标文档状态
    setTargetDocState(
      {
        id: blockId,
        title: `${blockTitle} (${docName})`,
        content: cleanContent,
        isBlock: true
      },
      cleanContent
    );

  } catch (error) {
    console.error('❌ 加载块失败:', error);
    showMessage('加载块失败: ' + (error as Error).message, 3000, 'error');
  }
};

// 清除目标文档
const clearTargetDocument = () => {
  clearEditState();
  clearContent();
  // showMessage('✓ 已清除目标文档', 1500, 'info');
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

    let siyuanContent: string;

    // 区分文档和块的处理
    if (editTargetDoc.value.isBlock) {
      // 块编辑：只移除 frontmatter，不移除标题
      const withoutFrontmatter = removeFrontmatter(generatedContent.value);
      siyuanContent = convertToSiyuanMarkdown(withoutFrontmatter);
    } else {
      // 文档编辑：移除 frontmatter 和标题
      siyuanContent = processContent(generatedContent.value);
    }

    // 使用updateBlock API更新文档内容
    await api.updateBlock('markdown', siyuanContent, editTargetDoc.value.id);


    // 更新原始内容为当前内容
    originalContent.value = generatedContent.value;
    editTargetDoc.value.content = generatedContent.value;
  } catch (error) {
    console.error('应用编辑失败:', error);
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
  } finally {
    isUndoing.value = false;
  }
};

/**
 * AI智能编辑功能
 */
const aiEditAction = async (action: 'polish' | 'expand' | 'condense' | 'fix' | 'translate' | 'rewrite' | 'summary') => {
  if (!editTargetDoc.value) {
    showMessage('请先选择要编辑的文档', 2000, 'info');
    return;
  }

  showSettings.value = false;

  const actionPrompts = {
    polish: '请对以下文档进行润色优化，保持原有结构，提升语言质量和可读性，使表达更加专业、流畅。保持Markdown格式，直接输出优化后的完整文档内容：',
    expand: '请对以下文档进行扩写，增加更详细的说明、例子和补充信息，使内容更加丰富和全面。保持Markdown格式，直接输出扩写后的完整文档内容：',
    condense: '请对以下文档进行精简，去除冗余内容，保留核心要点，使表达更加简洁有力。保持Markdown格式，直接输出精简后的完整文档内容：',
    fix: '请对以下文档进行错误检查和修正，包括拼写错误、语法错误、逻辑错误等。保持Markdown格式，直接输出修正后的完整文档内容：',
    translate: '请将以下文档翻译成中文（如果原文是中文则翻译成英文）。保持原有的Markdown格式和文档结构，只翻译文本内容。直接输出翻译后的完整文档内容：',
    rewrite: '请用不同的表达方式重写以下文档，保持核心意思不变，但使用全新的语言风格和句式结构。保持Markdown格式，直接输出改写后的完整文档内容：',
    summary: '请为以下文档生成一个简洁的总结，包括主要内容和关键要点。总结应该清晰明了，突出文档的核心信息。保持Markdown格式，直接输出总结内容：'
  };

  startGeneration();

  try {
    const options: GenerateOptions = {
      userInput: `${actionPrompts[action]}\n\n${editTargetDoc.value.content}`,
      systemPrompt: '你是一个专业的文档编辑助手，擅长优化Markdown文档。请直接输出优化后的完整文档，不要添加任何解释性文字。',
      temperature: 0.3,
      maxTokens: maxTokens.value,
      signal: abortController.value?.signal,
      onChunk: defaultOnChunk
    };

    await props.onGenerate(options);
  } catch (error) {
    if (handleGenerationError(error as Error, 'AI编辑')) return;
  } finally {
    finishGeneration();
  }
};

/**
 * 编辑模式：自定义提问处理
 */
const handleCustomEdit = async () => {
  if (!editTargetDoc.value) {
    showMessage('请先选择要编辑的文档', 2000, 'info');
    return;
  }

  // 如果既没有自定义输入，又没有选择提示词，则提示用户
  if (!editCustomInput.value.trim() && !currentPromptName.value) {
    showMessage('请输入编辑指令或选择提示词', 2000, 'info');
    return;
  }

  showSettings.value = false;
  startGeneration();

  try {
    // 根据是否选择提示词来决定系统提示词
    let finalSystemPrompt = '你是一个专业的文档编辑助手，擅长根据用户指令优化Markdown文档。请直接输出编辑后的完整文档，不要添加任何解释性文字。';
    let userInput: string;

    if (editCustomInput.value.trim()) {
      // 用户有自定义输入，使用自定义输入
      if (currentPromptName.value) {
        // 同时选择了提示词，使用选中的提示词配置
        finalSystemPrompt = systemPrompt.value;

      } else {
      }

      userInput = `请根据以下指令对文档进行编辑。保持Markdown格式，直接输出编辑后的完整文档内容：

编辑指令：${editCustomInput.value}

原文档：
${editTargetDoc.value.content}`;
    } else {
      // 没有自定义输入，但选择了提示词，使用提示词配置直接生成
      finalSystemPrompt = systemPrompt.value;
      userInput = `${editTargetDoc.value.content}`;
    }

    const options: GenerateOptions = {
      userInput,
      systemPrompt: finalSystemPrompt,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      signal: abortController.value?.signal,
      onChunk: defaultOnChunk
    };

    await props.onGenerate(options);

    editCustomInput.value = '';
  } catch (error) {
    if (handleGenerationError(error as Error, '自定义编辑')) return;
  } finally {
    finishGeneration();
  }
};

/**
 * AI查重功能
 */
const checkPlagiarism = async () => {
  if (!editTargetDoc.value) {
    showMessage('请先选择要查重的文档', 2000, 'info');
    return;
  }

  showSettings.value = false;
  startGeneration();
  isCheckingPlagiarism.value = true;
  plagiarismResult.value = null;

  try {
    const options: GenerateOptions = {
      userInput: `请对以下文档进行全面的原创性分析，重点关注以下方面：

一、文档内部重复内容检测：
1. 检查同一段落、句子或表述是否在文档中反复出现
2. 识别重复的段落、章节或观点
3. 检查相同内容是否用不同方式重复表达

二、外部内容相似性检测：
1. 识别可能与已知资料、公开内容相似的部分
2. 评估语言表达和内容结构的原创性
3. 检查是否存在常见的模板化或套话内容

三、具体分析要求：
- 指出具体重复或相似的位置（段落、行数等）
- 给出相似度百分比评估（0-100%）
- 评估整体风险等级：低风险/中风险/高风险
- 提供明确的改进建议

请使用Markdown格式返回分析结果，包括：
- 使用标题组织内容
- 使用列表列出问题和建议
- 使用粗体标记重要内容
- 使用斜体标记正面内容

文档内容：
${editTargetDoc.value.content}`,
      systemPrompt: '你是一个专业的查重分析专家，擅长识别文档中的重复内容和潜在抄袭。请以Markdown格式返回详细分析结果，使用标题、列表等Markdown语法让内容更加结构化和易读。',
      temperature: 0.3,
      maxTokens: 3000,
      signal: abortController.value?.signal,
      onChunk: createCustomStreamCallback((newContent) => {
        // 简单分析文本内容，尝试提取风险等级和相似度
        const riskLevel = detectRiskLevel(newContent);
        const similarityRate = detectSimilarityRate(newContent);

        plagiarismResult.value = {
          riskLevel,
          similarityRate,
          details: newContent
        };
      })
    };

    await props.onGenerate(options);

    // 确保至少返回基本结果
    if (!plagiarismResult.value || !plagiarismResult.value.details) {
      plagiarismResult.value = {
        riskLevel: 'low',
        similarityRate: 0,
        details: '查重分析已完成，未发现明显的重复或抄袭内容。建议继续保持内容的原创性。'
      };
    }
  } catch (error) {
    if (handleGenerationError(error as Error, '查重分析', true)) {
      finishGeneration();
      isCheckingPlagiarism.value = false;
      return;
    }
    showMessage('查重分析失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    if (abortController.value) {
      finishGeneration();
      isCheckingPlagiarism.value = false;
    }
  }
};

/**
 * 检测风险等级
 */
const detectRiskLevel = (text: string): 'low' | 'medium' | 'high' => {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('高风险') || lowerText.includes('high risk') ||
      lowerText.includes('严重重复') || lowerText.includes('大量相似')) {
    return 'high';
  } else if (lowerText.includes('中风险') || lowerText.includes('medium risk') ||
             lowerText.includes('部分重复') || lowerText.includes('中等相似')) {
    return 'medium';
  }

  return 'low';
};

/**
 * 检测相似度百分比
 */
const detectSimilarityRate = (text: string): number => {
  const match = text.match(/(\d+)%?/);
  if (match) {
    const num = parseInt(match[1]);
    return Math.min(Math.max(num, 0), 100);
  }
  return 0;
};

/**
 * 插入子文档功能
 */
const insertSubDocument = async () => {
  if (!editTargetDoc.value || !generatedContent.value) {
    showMessage('请先选择文档并生成内容', 2000, 'info');
    return;
  }

  // 获取父文档的人性化路径，提取文档名
  const parentHPath = await api.getHPathByID(editTargetDoc.value.id);
  const parentDocName = parentHPath ? parentHPath.split('/').pop() || '文档' : '文档';

  // 生成子文档名称：父文档名 + 总结
  const subDocTitle = `${parentDocName}总结`;

  // 添加时间戳以避免重复
  const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
  const finalSubDocTitle = `${subDocTitle}_${timestamp}`;

  isInsertingSubDoc.value = true;

  try {
    // 使用统一的内容处理函数
    const siyuanContent = processContent(generatedContent.value);

    // 获取父文档信息
    const parentDoc = await api.getBlockByID(editTargetDoc.value.id);
    if (!parentDoc || !parentDoc.box) {
      throw new Error('无法获取父文档信息');
    }

    const notebookId = parentDoc.box;

    // 构建子文档路径：在父文档下创建子文档
    // 思源的路径格式：/笔记本/父文档路径/子文档名
    const subDocPath = `${parentHPath}/${finalSubDocTitle}`;

    // 创建子文档
    const subDocId = await api.createDocWithMd(
      notebookId,
      subDocPath,
      siyuanContent
    );

    if (subDocId) {
      showMessage(`✓ 已在文档"${parentDoc.content || editTargetDoc.value.title}"下创建子文档: ${finalSubDocTitle}`, 3000, 'info');
    } else {
      throw new Error('创建子文档失败');
    }
  } catch (error) {
    console.error('插入子文档失败:', error);
    showMessage('插入子文档失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    isInsertingSubDoc.value = false;
  }
};

// 当聚焦配置名称输入框时，自动填充当前配置名称
const onPromptNameFocus = () => {
  if (currentPromptName.value && !newPromptName.value) {
    newPromptName.value = currentPromptName.value;
  }
};

// 保存当前提示词配置
const saveCurrentPrompt = async () => {
  // 如果输入框为空但有当前配置名称，使用当前配置名称
  const promptName = newPromptName.value.trim() || currentPromptName.value;

  if (!promptName) {
    showMessage('请输入配置名称', 2000, 'info');
    return;
  }

  // 检查是否已存在同名配置（更新模式）
  const existingIndex = savedPrompts.value.findIndex(p => p.name === promptName);

  const promptConfig: AIPromptConfig = {
    id: existingIndex >= 0 ? savedPrompts.value[existingIndex].id : Date.now().toString(),
    name: promptName,
    systemPrompt: systemPrompt.value,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    contextMessageLimit: contextMessageLimit.value,
    createdAt: existingIndex >= 0 ? savedPrompts.value[existingIndex].createdAt : Date.now()
  };

  if (existingIndex >= 0) {
    // 更新现有配置
    savedPrompts.value[existingIndex] = promptConfig;
  } else {
    // 添加新配置
    savedPrompts.value.push(promptConfig);
  }

  try {
    if (storage) {
      await storage.savePrompts(savedPrompts.value);
    }
  } catch (error) {
    console.error('保存提示词配置失败:', error);
  }

  newPromptName.value = '';
  currentPromptName.value = promptName;
};

// 清除当前提示词选择
const clearCurrentPrompt = async () => {
  currentPromptName.value = '';

  try {
    if (storage) {
      await storage.clearCurrentPrompt();
    }
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
 * 应用提示词配置到当前状态
 */
const applyPromptConfig = (prompt: SavedPrompt) => {
  systemPrompt.value = prompt.systemPrompt;
  temperature.value = prompt.temperature;
  maxTokens.value = prompt.maxTokens;
  contextMessageLimit.value = prompt.contextMessageLimit || 1;
  currentPromptName.value = prompt.name;
};

// 加载提示词配置
const loadPrompt = async (index: number) => {
  const prompt = savedPrompts.value[index];
  if (!prompt) return;

  applyPromptConfig(prompt);
  showPromptSelector.value = false;

  // 保存当前选中的提示词到存储
  try {
    if (storage) {
      await storage.saveCurrentPrompt(prompt.name);
    }
  } catch (error) {
    console.error('保存当前提示词失败:', error);
  }
};

// 编辑提示词配置
const editPrompt = (index: number) => {
  const prompt = savedPrompts.value[index];
  if (!prompt) return;

  applyPromptConfig(prompt);

  // 打开设置面板以便编辑
  showSettings.value = true;
  showPromptSelector.value = false;
};

// 删除提示词配置
const deletePrompt = (index: number) => {
  const prompt = savedPrompts.value[index];
  if (!prompt) return;

  if (confirm(`确定删除配置: ${prompt.name}?`)) {
    savedPrompts.value.splice(index, 1);
    savePromptsToStorage();
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
  }
};

// 从存储加载提示词配置
const loadPromptsFromStorage = async () => {

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
  }
};

// 组件挂载时加载保存的提示词
onMounted(async () => {

  // 初始化存储实例
  if (props.plugin) {
    storage = new AIGeneratorStorage(props.plugin);
    await storage.init();
    await loadPromptsFromStorage();
    await loadSettings();
    await loadCollapsedSections();
  }
});

// 是否已完成初始设置加载（用于避免初始加载时触发保存）
let isSettingsLoaded = false;

// 保存设置到存储
const saveSettings = async () => {
  if (!storage || !isSettingsLoaded) return;

  const settings = {
    systemPrompt: systemPrompt.value,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    contextMessageLimit: contextMessageLimit.value
  };

  try {
    await storage.saveSettings(settings);
  } catch (error) {
    console.error('保存设置失败:', error);
  }
};

// 加载设置
const loadSettings = async () => {
  if (!storage) return;

  try {
    const settings = await storage.loadSettings();
    if (settings) {
      systemPrompt.value = settings.systemPrompt || systemPrompt.value;
      temperature.value = settings.temperature ?? temperature.value;
      maxTokens.value = settings.maxTokens || maxTokens.value;
      contextMessageLimit.value = settings.contextMessageLimit ?? contextMessageLimit.value;
    }
    isSettingsLoaded = true;
  } catch (error) {
    console.error('从插件存储加载设置失败:', error);
  }
};

// 监听设置变化（使用 debounce 避免频繁保存）
let settingsSaveTimer: number | null = null;
watch([systemPrompt, temperature, maxTokens, contextMessageLimit], () => {
  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer);
  }
  settingsSaveTimer = window.setTimeout(() => {
    saveSettings();
  }, 300);
});

</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
