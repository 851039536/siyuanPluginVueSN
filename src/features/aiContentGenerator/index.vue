<template>
  <div class="ai-content-panel">
    <!-- 顶部工具栏（含模式切换） -->
    <PanelHeader
      :activeMode="activeMode"
      @update:activeMode="activeMode = $event"
      @toggle-settings="toggleSettings"
    />

    <!-- ====== 生成器模式 ====== -->
    <template v-if="activeMode === 'generator'">
      <!-- 提示词配置面板 -->
      <SettingsPanel
        :showSettings="showSettings"
        v-model:systemPrompt="systemPrompt"
        v-model:temperature="temperature"
        v-model:maxTokens="maxTokens"
        :currentPromptName="currentPromptName"
        v-model:newPromptName="newPromptName"
        :savedPrompts="savedPrompts"
        @toggle-settings="toggleSettings"
        @save-current-prompt="saveCurrentPrompt"
        @on-prompt-name-focus="onPromptNameFocus"
        @load-prompt="loadPrompt"
        @delete-prompt="deletePrompt"
      />

      <!-- 内容显示区域 -->
      <div class="content-display-section">
        <MainContentArea
          :is-generating="isGenerating"
          :is-applying="isApplying"
          :is-undoing="isUndoing"
          :is-inserting-sub-doc="isInsertingSubDoc"
          :error-message="errorMessage"
          :displayed-content="displayedContent"
          :generated-content="generatedContent"
          :rendered-markdown="renderedDisplayedMarkdown"
          :original-content="originalContent"
          :search-results="searchResults"
          :show-search-results="showSearchResults"
          :search-status="searchStatus"
          :reasoning-content="reasoningContent"
          :show-reasoning="showReasoning"
          :generation-elapsed="generationElapsed"
          :is-reviewing="isReviewing"
          :review-result="reviewResult"
          :can-apply="!!editTargetDoc && !isApplying && !isGenerating && !isReviewing"
          :can-insert-sub-doc="!!editTargetDoc && !isInsertingSubDoc && !isGenerating"
          :can-undo="canUndoEdit"
          @stop="handleStop"
          @apply-edit="applyEdit"
          @insert-subdoc="insertSubDocument"
          @undo-edit="undoEdit"
          @copy="copyContent"
          @clear="clearContent"
          @toggle-reasoning="showReasoning = !showReasoning"
        />
      </div>

      <!-- 底部输入区域 -->
      <BottomInputArea
        :is-generating="isGenerating"
        :edit-target-doc="editTargetDoc"
        :show-prompt-selector="showPromptSelector"
        :current-prompt-name="currentPromptName"
        :saved-prompts="savedPrompts"
        :paginated-prompts="paginatedPrompts"
        :edit-custom-input="editCustomInput"
        :skills="skills"
        :current-skill="currentSkill"
        :current-skill-index="currentSkillIndex"
        :filtered-skills="filteredSkills"
        :skill-search-query="skillSearchQuery"
        :web-search="webSearch"
        :selected-model="selectedModel"
        :custom-model="customModel"
        :available-models="availableModels"
        :supports-thinking="supportsThinking"
        :enable-thinking="enableThinking"
        :enable-review="enableReview"
        @ai-edit="aiEditAction"
        @stop="handleStop"
        @toggle-prompt-selector="showPromptSelector = !showPromptSelector"
        @clear-current-prompt="clearCurrentPrompt"
        @load-prompt="loadPrompt"
        @edit-prompt="editPrompt"
        @delete-prompt="deletePrompt"
        @select-target-doc="selectTargetDocument"
        @select-target-block="selectTargetBlock"
        @clear-target-doc="clearTargetDocument"
        @custom-edit="handleCustomEdit"
        @update:edit-custom-input="editCustomInput = $event"
        @update:current-skill-index="currentSkillIndex = $event"
        @update:skill-search-query="skillSearchQuery = $event"
        @update:web-search="webSearch = $event"
        @update:selected-model="selectedModel = $event"
        @update:custom-model="customModel = $event"
        @update:enable-thinking="enableThinking = $event"
        @update:enable-review="enableReview = $event"
      />
    </template>

    <!-- ====== 自动化任务模式 ====== -->
    <AutomationView
      v-if="activeMode === 'automation'"
      :plugin="plugin"
      :on-generate="props.onGenerate"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import type { Plugin } from "siyuan";
import { showMessage } from "siyuan";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import * as api from "@/api";
import { AIGeneratorStorage } from "./types/storage";
import type { GenerateOptions, ReviewResult, SavedPrompt, TargetDoc } from "@/types/ai";
import { useSkillsLoader } from "./composables/useSkillsLoader";
import { renderMarkdown } from "./utils";
import PanelHeader from "./components/PanelHeader.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import MainContentArea from "./components/MainContentArea.vue";
import BottomInputArea from "./components/BottomInputArea.vue";
import AutomationView from "./components/AutomationView.vue";

interface Props {
  i18n: Record<string, string>;
  plugin: Plugin;
  onGenerate: (options: GenerateOptions) => Promise<string>;
  onReview?: (userRequest: string, generatedContent: string) => Promise<ReviewResult>;
}

const props = withDefaults(defineProps<Props>(), {});

// 存储实例
let storage: AIGeneratorStorage | null = null;

// 状态
const generatedContent = ref("");
const isGenerating = ref(false);
const errorMessage = ref("");
const generationElapsed = ref(""); // 生成耗时显示（如 "3.2s"），空字符串表示不显示
let generationStartTime = 0;       // 生成开始时间戳（非响应式）
const showSettings = ref(false);
const abortController = ref<AbortController | null>(null);

// ============ 审核系统 ============
const enableReview = ref(false);
const isReviewing = ref(false);
const reviewResult = ref<ReviewResult | null>(null);

// 模式切换
const activeMode = ref<"generator" | "automation">("generator");

// ============ 技能系统 ============
const { skills, currentSkillIndex, currentSkill, loadSkills, skillSearchQuery, filteredSkills } = useSkillsLoader(props.plugin)

// 编辑模式状态
const editTargetDoc = ref<TargetDoc | null>(null);
const originalContent = ref(""); // 文档原始内容
const isApplying = ref(false);
const isUndoing = ref(false);
const isInsertingSubDoc = ref(false); // 插入子文档状态

// 编辑模式自定义提问输入
const editCustomInput = ref("");

// 编辑历史（用于撤回/重做）
interface EditHistory {
  docId: string;
  docTitle: string;
  originalContent: string;
  timestamp: number;
  isBlock?: boolean;
  insertedBlockIds?: string[]; // 块模式下通过 insertBlock 追加的块ID，撤回时需要删除
}
const MAX_EDIT_HISTORY = 20; // 最大历史记录数
const editHistoryStack = ref<EditHistory[]>([]);

// 对话设置
const systemPrompt = ref(
  "你是一个专业的内容创作助手，擅长生成结构清晰、格式规范的Markdown文档。请确保输出内容使用标准的Markdown语法。",
);
const temperature = ref(0.7);
const maxTokens = ref(10000);

// 模型选择状态
const selectedModel = ref("");
const customModel = ref("");
const enableThinking = ref(false);
const webSearch = ref(false);
const searchStatus = ref(""); // 搜索状态文字（如"正在搜索..."）
const searchResults = ref<Array<{ title: string; url: string; content: string; score?: number }>>([]);
const showSearchResults = ref(false);

// 思考过程状态
const reasoningContent = ref("");  // 完整推理内容（汇总后）
const showReasoning = ref(false);  // 是否展开显示思考过程
let reasoningBuffer = "";           // 推理流式缓冲区（非响应式，避免频繁重渲染）

const displayedContent = ref(""); // 用于打字机效果显示的内容
// 提示词管理
const savedPrompts = ref<SavedPrompt[]>([]);
const showPromptSelector = ref(false);
const newPromptName = ref("");
const currentPromptName = ref(""); // 当前选中的提示词名称

// ============ 常量定义 ============
const SETTINGS_SAVE_DEBOUNCE_MS = 300; // 设置保存防抖时间(毫秒)

// 是否有可撤回的编辑历史
const canUndoEdit = computed(() => editHistoryStack.value.length > 0);

// 提示词列表（直接使用，无需过滤/分页）
const paginatedPrompts = computed(() => savedPrompts.value);

// ============ AI 模型配置 ============
import { AI_MODELS_CONFIG } from "./types/models";

const currentProvider = computed(() => (props.plugin as any)?.settings?.aiApiProvider || "tongyi")

const availableModels = computed(() => {
  return AI_MODELS_CONFIG[currentProvider.value] || { common: [], all: [] }
})

const resolvedModel = computed(() =>
  selectedModel.value === "custom" ? customModel.value : selectedModel.value
)

const supportsThinking = computed(() =>
  currentProvider.value === "deepseek" &&
  (selectedModel.value === "deepseek-reasoner" || selectedModel.value.startsWith("deepseek-v4-"))
)

// ============ 公共工具函数 ============

/**
 * 开始生成内容的公共初始化
 */
const startGeneration = () => {
  generationStartTime = performance.now();
  generationElapsed.value = "";
  abortController.value = new AbortController();
  isGenerating.value = true;
  generatedContent.value = "";
  displayedContent.value = "";
  reasoningContent.value = "";
  showReasoning.value = false;
  chunkBuffer = "";
  reasoningBuffer = "";
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  errorMessage.value = "";
  searchStatus.value = "";
  searchResults.value = [];
  showSearchResults.value = false;
  reviewResult.value = null;
  isReviewing.value = false;
};

/**
 * 重置生成相关状态
 * 仅重置 AI 生成流程的状态，不影响 apply/undo/insert 等操作状态
 */
const resetAllGenerationStates = () => {
  isGenerating.value = false;
  abortController.value = null;
};

/**
 * 记录生成耗时并格式化显示
 */
const recordGenerationElapsed = () => {
  if (!generationStartTime) return;
  const elapsed = performance.now() - generationStartTime;
  if (elapsed >= 1000) {
    generationElapsed.value = `${(elapsed / 1000).toFixed(1)}s`;
  } else {
    generationElapsed.value = `${Math.round(elapsed)}ms`;
  }
  generationStartTime = 0;
};

/**
 * 处理生成过程中的错误
 * @returns true 表示是用户取消，调用方应直接返回
 */
const handleGenerationError = (
  error: Error,
  context: string,
  skipMessage = false,
): boolean => {
  if (error.name === "AbortError") {
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
const loadDocument = async (
  docId: string,
): Promise<{ title: string; content: string } | null> => {
  try {
    const docBlock = await api.getBlockByID(docId);
    if (!docBlock) {
      showMessage("无法获取文档信息", 3000, "error");
      return null;
    }

    const docContent = await api.exportMdContent(docId);
    if (!docContent || !docContent.content) {
      showMessage("无法获取文档内容", 3000, "error");
      return null;
    }

    return {
      title: docBlock.content || "未命名文档",
      content: docContent.content,
    };
  } catch (error) {
    console.error("加载文档失败:", error);
    showMessage("加载文档失败: " + (error as Error).message, 3000, "error");
    return null;
  }
};

/**
 * 流式输出缓冲区与节流渲染
 * 使用 requestAnimationFrame 批量更新，避免高频 chunk 导致频繁 DOM 重渲染
 */
let chunkBuffer = "";
let rafId: number | null = null;

const flushChunkBuffer = () => {
  if (chunkBuffer) {
    displayedContent.value += chunkBuffer;
    chunkBuffer = "";
  }
  if (reasoningBuffer) {
    reasoningContent.value += reasoningBuffer;
    reasoningBuffer = "";
  }
  rafId = null;
};

/**
 * 默认的流式输出回调（节流更新显示内容，即时更新生成内容）
 */
const defaultOnChunk = (chunk: string) => {
  generatedContent.value += chunk;
  chunkBuffer += chunk;
  if (!rafId) {
    rafId = requestAnimationFrame(flushChunkBuffer);
  }
};

/**
 * 思考过程回调（DeepSeek reasoning_content，与内容共用同一 RAF 节流）
 */
const defaultOnReasoningChunk = (chunk: string) => {
  reasoningBuffer += chunk;
  if (!rafId) {
    rafId = requestAnimationFrame(flushChunkBuffer);
  }
};

/**
 * 构建生成请求的公共 options，避免 aiEditAction / handleCustomEdit 重复
 */
const buildGenerateOptions = (userInput: string, systemPrompt: string, searchQueryOverride?: string): GenerateOptions => ({
  userInput,
  systemPrompt,
  temperature: temperature.value,
  maxTokens: maxTokens.value,
  signal: abortController.value?.signal,
  onChunk: defaultOnChunk,
  ...(enableThinking.value ? { onReasoningChunk: defaultOnReasoningChunk } : {}),
  model: resolvedModel.value || undefined,
  enableThinking: enableThinking.value,
  webSearch: webSearch.value,
  ...(searchQueryOverride ? { searchQuery: searchQueryOverride } : {}),
  onSearchStart: () => {
    searchStatus.value = "正在搜索网络...";
  },
  onSearchResults: (results) => {
    searchResults.value = results;
    showSearchResults.value = true;
    searchStatus.value = `已获取 ${results.length} 条搜索结果`;
  },
  onSearchError: (error) => {
    searchStatus.value = `搜索失败: ${error}`;
    showMessage(`联网搜索失败: ${error}`, 3000, "info");
  },
})

/**
 * 统一的生成执行封装
 * 处理 startGeneration → try/catch/finally → resetAllGenerationStates/recordGenerationElapsed/performReview
 * @param context 错误上下文标识（如 "AI编辑"、"自定义编辑"）
 * @param buildOptions 构建 GenerateOptions 的回调
 * @param onSuccess 生成成功后的可选回调
 */
const executeGeneration = async (
  context: string,
  buildOptions: () => GenerateOptions,
  onSuccess?: () => void,
) => {
  showSettings.value = false;
  startGeneration();
  try {
    const options = buildOptions();
    await props.onGenerate(options);
    onSuccess?.();
  } catch (error) {
    if (handleGenerationError(error as Error, context)) return;
  } finally {
    resetAllGenerationStates();
    recordGenerationElapsed();
    performReview();
  }
};

/**
 * 移除Markdown内容中的Frontmatter（YAML元数据）
 * @param content 原始内容
 * @returns 移除frontmatter后的内容
 */
const removeFrontmatter = (content: string): string => {
  // 匹配开头的 --- ... --- 格式的YAML frontmatter
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
  return content.replace(frontmatterRegex, "").trim();
};

// 渲染主内容 Markdown
const renderedDisplayedMarkdown = computed(() => {
  return renderMarkdown(displayedContent.value);
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
watch(renderedDisplayedMarkdown, () =>
  applyCodeHighlighting(".markdown-preview pre code"),
);

// 切换设置面板
const toggleSettings = () => {
  showSettings.value = !showSettings.value;
};

/**
 * 安全执行存储操作的辅助函数
 */
const safeStorageOperation = async <T>(
  operation: () => Promise<T>,
  errorMessage: string,
): Promise<T | null> => {
  if (!storage) return null;
  try {
    return await operation();
  } catch (error) {
    console.error(errorMessage, error);
    return null;
  }
};

// 清理编辑模式状态
const clearEditState = () => {
  editTargetDoc.value = null;
  originalContent.value = "";
  editCustomInput.value = "";
  editHistoryStack.value = [];
};

// 停止生成（生成器模式）
const handleStop = () => {
  if (abortController.value) {
    abortController.value.abort();
  }
  resetAllGenerationStates();
  generationElapsed.value = "";
  generationStartTime = 0;
};

/**
 * 交叉审核：生成完成后，使用 V4 Pro 审核生成内容
 */
const performReview = async () => {
  if (!enableReview.value || !generatedContent.value) return;
  if (!props.onReview) return;

  // 构建用户原始请求（从当前上下文推断）
  const userRequest = editCustomInput.value
    || (editTargetDoc.value ? `对文档"${editTargetDoc.value.title}"进行编辑` : "AI 内容生成")

  isReviewing.value = true;
  reviewResult.value = null;

  reviewResult.value = await props.onReview(userRequest, generatedContent.value);
  isReviewing.value = false;
};

/**
 * 根据内容类型处理内容
 * - 文档模式：移除 frontmatter 和标题，转换为思源兼容格式
 * - 块模式：仅移除 frontmatter，转换为思源兼容格式
 */
const processContentByType = (content: string, isBlock: boolean): string => {
  const withoutFrontmatter = removeFrontmatter(content);
  if (isBlock) {
    return convertToSiyuanMarkdown(withoutFrontmatter);
  }
  // 文档模式：额外移除第一行标题
  const lines = withoutFrontmatter.split("\n");
  const withoutHeading = lines.length <= 1 ? "" : lines.slice(1).join("\n").trim();
  return convertToSiyuanMarkdown(withoutHeading);
};

/**
 * 转换 Markdown 为思源兼容格式
 * 确保各语法块前后有空行，清理多余连续空行
 */
const convertToSiyuanMarkdown = (content: string): string => {
  let converted = content;

  // 1. 确保标题前后有空行
  const headingStart = /([^\n])\n(#{1,6}\s)/g;
  const headingEnd = /(#{1,6}\s[^\n]+)\n([^\n#])/g;
  converted = converted.replace(headingStart, "$1\n\n$2");
  converted = converted.replace(headingEnd, "$1\n\n$2");

  // 2. 确保代码块前后有空行
  const codeBlockStart = /([^\n])\n```/g;
  const codeBlockEnd = /```\n([^\n])/g;
  converted = converted.replace(codeBlockStart, "$1\n\n```");
  converted = converted.replace(codeBlockEnd, "```\n\n$1");

  // 3. 确保列表前后有空行
  const listUnordered = /([^\n])\n([-*+]\s)/g;
  const listOrdered = /([^\n])\n(\d+\.\s)/g;
  converted = converted.replace(listUnordered, "$1\n\n$2");
  converted = converted.replace(listOrdered, "$1\n\n$2");

  // 4. 清理多余的连续空行（最多保留两个换行符）
  converted = converted.replace(/\n{3,}/g, "\n\n");

  return converted;
};

// 复制内容
const copyContent = async () => {
  if (!generatedContent.value) return;

  try {
    // 转换为思源兼容的 Markdown 格式
    const siyuanContent = convertToSiyuanMarkdown(generatedContent.value);
    await navigator.clipboard.writeText(siyuanContent);
  } catch (error) {
    console.error("复制失败:", error);
    showMessage("复制失败", 2000, "error");
  }
};

// 清除内容
const clearContent = () => {
  generatedContent.value = "";
  displayedContent.value = "";
  errorMessage.value = "";
  generationElapsed.value = "";
};

// 选择目标文档
const selectTargetDocument = async () => {
  try {
    // 优先使用激活窗口的文档ID，而不是依赖光标位置
    // 这样可以确保选择的是用户当前正在查看的文档
    const protyle = document.querySelector(
      ".layout__wnd--active .protyle:not(.fn__none)",
    );
    let docId =
      protyle
        ?.querySelector(".protyle-background")
        ?.getAttribute("data-node-id") || null;

    // 如果激活窗口方法失败，再通过光标位置获取
    if (!docId) {
      const currentBlockId = getCurrentBlockId();
      if (currentBlockId) {
        docId = await getDocIdByBlockId(currentBlockId);
      }
    }

    if (!docId) {
      showMessage("无法获取当前文档，请将光标放在文档中", 2000, "error");
      return;
    }

    await loadTargetDocument(docId);
  } catch (error) {
    console.error("选择文档失败:", error);
  }
};

// 选择当前光标所在的块
const selectTargetBlock = async () => {
  try {
    const blockId = getCurrentBlockId();
    if (!blockId) {
      showMessage("无法获取当前块，请将光标放在目标块中", 2000, "error");
      return;
    }

    // 获取块的 Markdown 内容
    const blockContent = await api.getBlockMarkdown(blockId);
    if (!blockContent) {
      showMessage("无法获取块内容", 2000, "error");
      return;
    }

    // 获取块所属的文档信息（用于标题显示）
    const blockInfo = await api.getBlockByID(blockId);
    const docTitle = blockInfo?.content || "块内容";

    // 设置目标文档状态（标记为块）
    setTargetDocState(
      {
        id: blockId,
        title: docTitle,
        content: blockContent,
        isBlock: true,
      },
      blockContent,
    );
  } catch (error) {
    console.error("选择块失败:", error);
    showMessage("选择块失败: " + (error as Error).message, 3000, "error");
  }
};

/**
 * 设置目标文档状态
 */
const setTargetDocState = (doc: TargetDoc, content: string) => {
  editTargetDoc.value = doc;
  originalContent.value = content;
  generatedContent.value = content;
  displayedContent.value = content;
  editCustomInput.value = "";
  editHistoryStack.value = [];
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
      isBlock: false,
    },
    cleanContent,
  );
};

// 清除目标文档
const clearTargetDocument = () => {
  clearEditState();
  clearContent();
};

/**
 * 将Markdown内容按顶层块分割
 * 思源笔记中，每个Markdown块（段落、标题、列表、代码块等）都是独立的
 * 需要按双换行符分割，同时保留代码块等跨行结构不被错误分割
 */
const splitMarkdownBlocks = (content: string): string[] => {
  if (!content.trim()) return [];

  const blocks: string[] = [];
  let currentBlock = "";
  let inCodeBlock = false;

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 跟踪代码块状态
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
    }

    if (!inCodeBlock && line.trim() === "" && currentBlock.trim()) {
      // 空行且不在代码块中，且当前块有内容，则分割
      blocks.push(currentBlock.trim());
      currentBlock = "";
    } else {
      currentBlock += (currentBlock ? "\n" : "") + line;
    }
  }

  // 添加最后一个块
  if (currentBlock.trim()) {
    blocks.push(currentBlock.trim());
  }

  return blocks;
};

// 应用编辑
const applyEdit = async () => {
  if (!editTargetDoc.value) return;

  isApplying.value = true;

  // 用于记录块模式下追加的块ID
  let insertedBlockIds: string[] = [];

  try {
    // 区分文档和块的处理
    const siyuanContent = processContentByType(
      generatedContent.value,
      editTargetDoc.value.isBlock ?? false,
    );

    const docId = editTargetDoc.value.id;

    if (editTargetDoc.value.isBlock) {
      // 块模式：AI生成的内容可能包含多个Markdown块
      // updateBlock 只能更新当前块，多余的内容需要用 insertBlock 追加
      const blocks = splitMarkdownBlocks(siyuanContent);

      if (blocks.length === 0) {
        throw new Error("生成的内容为空");
      }

      // 第一个块：更新原始块
      const firstBlock = blocks[0];
      const result = await api.updateBlock("markdown", firstBlock, docId);
      if (!result) {
        throw new Error("updateBlock API 返回为空，更新可能未生效");
      }

      // 剩余块：逐个插入到当前块之后，确保正确记录每个插入块的ID
      if (blocks.length > 1) {
        let prevId = docId;
        for (let i = 1; i < blocks.length; i++) {
          const insertResult = await api.insertBlock(
            "markdown",
            blocks[i],
            undefined, // nextID
            prevId,    // previousID
          );
          if (!insertResult || insertResult.length === 0) {
            throw new Error("insertBlock API 返回为空，追加内容可能未生效");
          }
          // 记录插入的块ID，用于撤回时删除
          const newBlockId = insertResult[0]?.doOperations?.[0]?.id;
          if (newBlockId) {
            insertedBlockIds.push(newBlockId);
            prevId = newBlockId;
          }
        }
      }
    } else {
      // 文档模式：updateBlock 对文档块（根块）会替换全部子块
      const result = await api.updateBlock("markdown", siyuanContent, docId);
      if (!result) {
        throw new Error("updateBlock API 返回为空，更新可能未生效");
      }
    }

    // 保存编辑历史（用于撤回）- 在成功应用后保存，包含插入的块ID
    editHistoryStack.value.push({
      docId: editTargetDoc.value.id,
      docTitle: editTargetDoc.value.title,
      originalContent: originalContent.value,
      timestamp: Date.now(),
      isBlock: editTargetDoc.value.isBlock,
      insertedBlockIds: insertedBlockIds.length > 0 ? insertedBlockIds : undefined,
    });
    // 限制历史记录数量
    if (editHistoryStack.value.length > MAX_EDIT_HISTORY) {
      editHistoryStack.value.shift();
    }

    // 更新原始内容为当前内容
    originalContent.value = generatedContent.value;
    editTargetDoc.value.content = generatedContent.value;
  } catch (error) {
    console.error("应用编辑失败:", error);
    showMessage("应用编辑失败: " + (error as Error).message, 3000, "error");
  } finally {
    isApplying.value = false;
  }
};

// 撤回编辑
const undoEdit = async () => {
  if (editHistoryStack.value.length === 0) return;

  isUndoing.value = true;
  try {
    // 从栈顶弹出最近的历史记录
    const lastHistory = editHistoryStack.value.pop()!;
    const historyDocId = lastHistory.docId;

    // 如果是块模式且有追加的块，先删除追加的块
    if (lastHistory.isBlock && lastHistory.insertedBlockIds && lastHistory.insertedBlockIds.length > 0) {
      for (const blockId of lastHistory.insertedBlockIds) {
        try {
          await api.deleteBlock(blockId);
        } catch (e) {
          console.warn("删除追加块失败，可能已被手动删除:", blockId, e);
        }
      }
    }

    // 恢复原始内容
    // 对于文档模式：updateBlock 对文档块会替换全部子块
    // 对于块模式：仅恢复原始块的内容（追加块已在上方删除）
    const result = await api.updateBlock(
      "markdown",
      lastHistory.originalContent,
      historyDocId,
    );
    if (!result) {
      throw new Error("updateBlock API 返回为空，恢复可能未生效");
    }

    showMessage(
      `✓ 已撤回对文档的编辑: ${lastHistory.docTitle}`,
      2000,
      "info",
    );

    // 如果当前编辑的是同一个文档，更新界面
    if (
      editTargetDoc.value &&
      editTargetDoc.value.id === lastHistory.docId
    ) {
      generatedContent.value = lastHistory.originalContent;
      displayedContent.value = lastHistory.originalContent;
      originalContent.value = lastHistory.originalContent;
      editTargetDoc.value.content = lastHistory.originalContent;
    }
  } catch (error) {
    console.error("撤回编辑失败:", error);
  } finally {
    isUndoing.value = false;
  }
};

/**
 * AI智能编辑功能
 */
const aiEditAction = async (
  action:
    | "polish"
    | "expand"
    | "condense"
    | "fix"
    | "rewrite"
    | "summary",
) => {
  if (!editTargetDoc.value) {
    showMessage("请先选择要编辑的文档", 2000, "info");
    return;
  }

  const actionPrompts = {
    polish:
      "请对以下文档进行润色优化，保持原有结构，提升语言质量和可读性，使表达更加专业、流畅。保持Markdown格式，直接输出优化后的完整文档内容：",
    expand:
      "请对以下文档进行扩写，增加更详细的说明、例子和补充信息，使内容更加丰富和全面。保持Markdown格式，直接输出扩写后的完整文档内容：",
    condense:
      "请对以下文档进行精简，去除冗余内容，保留核心要点，使表达更加简洁有力。保持Markdown格式，直接输出精简后的完整文档内容：",
    fix: "请对以下文档进行错误检查和修正，包括拼写错误、语法错误、逻辑错误等。保持Markdown格式，直接输出修正后的完整文档内容：",
    rewrite:
      "请用不同的表达方式重写以下文档，保持核心意思不变，但使用全新的语言风格和句式结构。保持Markdown格式，直接输出改写后的完整文档内容：",
    summary:
      "请为以下文档生成一个简洁的总结，包括主要内容和关键要点。总结应该清晰明了，突出文档的核心信息。保持Markdown格式，直接输出总结内容：",
  };

  await executeGeneration("AI编辑", () => {
    const skillSystemPrompt = currentSkill.value
      ? `${currentSkill.value.content}\n\n你是一个专业的文档编辑助手，擅长优化Markdown文档。请直接输出优化后的完整文档，不要添加任何解释性文字。`
      : "你是一个专业的文档编辑助手，擅长优化Markdown文档。请直接输出优化后的完整文档，不要添加任何解释性文字。"
    return buildGenerateOptions(
      `${actionPrompts[action]}\n\n${editTargetDoc.value!.content}`,
      skillSystemPrompt,
    )
  });
};

/**
 * 编辑模式：自定义提问处理
 * 支持两种模式：
 * 1. 有目标文档：编辑指令 + 文档内容
 * 2. 无文档但选了技能：直接向技能提问
 */
const handleCustomEdit = async () => {
  // 无文档且无技能时，提示选择
  if (!editTargetDoc.value && !currentSkill.value) {
    showMessage("请先选择要编辑的文档或选择技能", 2000, "info");
    return;
  }

  // 无输入时，必须有技能+文档 或 提示词+文档 才能继续
  if (!editCustomInput.value.trim()) {
    if (editTargetDoc.value && currentSkill.value) {
      // 有文档+技能：直接用技能处理文档，无需输入
    } else if (editTargetDoc.value && currentPromptName.value) {
      // 有文档+提示词，允许继续
    } else {
      showMessage("请输入提问内容", 2000, "info");
      return;
    }
  }

  await executeGeneration("自定义编辑", () => {
    let finalSystemPrompt: string;
    let userInput: string;

    if (!editTargetDoc.value) {
      // 无文档模式：技能直接提问
      finalSystemPrompt = currentSkill.value!.content;
      userInput = editCustomInput.value;
    } else {
      // 有文档模式：编辑指令 + 文档内容
      let baseSystemPrompt: string;

      if (currentSkill.value) {
        baseSystemPrompt = currentSkill.value.content;
      } else if (currentPromptName.value) {
        baseSystemPrompt = systemPrompt.value;
      } else {
        baseSystemPrompt = "你是一个专业的文档编辑助手，擅长根据用户指令优化Markdown文档。请直接输出编辑后的完整文档，不要添加任何解释性文字。";
      }

      if (editCustomInput.value.trim()) {
        userInput = `请根据以下指令对文档进行编辑。保持Markdown格式，直接输出编辑后的完整文档内容：

编辑指令：${editCustomInput.value}

原文档：
${editTargetDoc.value.content}`;
      } else {
        userInput = `${editTargetDoc.value.content}`;
      }

      finalSystemPrompt = baseSystemPrompt;
    }

    return buildGenerateOptions(userInput, finalSystemPrompt, editCustomInput.value.trim() || undefined)
  }, () => {
    editCustomInput.value = "";
  });
};

/**
 * 插入子文档功能
 */
const insertSubDocument = async () => {
  if (!editTargetDoc.value || !generatedContent.value) {
    showMessage("请先选择文档并生成内容", 2000, "info");
    return;
  }

  // 获取父文档的人性化路径，提取文档名
  const parentHPath = await api.getHPathByID(editTargetDoc.value.id);
  const parentDocName = parentHPath
    ? parentHPath.split("/").pop() || "文档"
    : "文档";

  // 生成子文档名称：父文档名 + 总结
  const subDocTitle = `${parentDocName}总结`;

  // 添加时间戳以避免重复
  const timestamp = new Date().toLocaleDateString("zh-CN").replace(/\//g, "-");
  const finalSubDocTitle = `${subDocTitle}_${timestamp}`;

  isInsertingSubDoc.value = true;

  try {
    // 使用统一的内容处理函数（插入子文档始终按文档模式处理）
    const siyuanContent = processContentByType(generatedContent.value, false);

    // 获取父文档信息
    const parentDoc = await api.getBlockByID(editTargetDoc.value.id);
    if (!parentDoc || !parentDoc.box) {
      throw new Error("无法获取父文档信息");
    }

    const notebookId = parentDoc.box;

    // 构建子文档路径：在父文档下创建子文档
    // 思源的路径格式：/笔记本/父文档路径/子文档名
    const subDocPath = `${parentHPath}/${finalSubDocTitle}`;

    // 创建子文档
    const subDocId = await api.createDocWithMd(
      notebookId,
      subDocPath,
      siyuanContent,
    );

    if (subDocId) {
      showMessage(
        `✓ 已在文档"${parentDoc.content || editTargetDoc.value.title}"下创建子文档: ${finalSubDocTitle}`,
        3000,
        "info",
      );
    } else {
      throw new Error("创建子文档失败");
    }
  } catch (error) {
    console.error("插入子文档失败:", error);
    showMessage("插入子文档失败: " + (error as Error).message, 3000, "error");
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
    showMessage("请输入配置名称", 2000, "info");
    return;
  }

  // 检查是否已存在同名配置（更新模式）
  const existingIndex = savedPrompts.value.findIndex(
    (p) => p.name === promptName,
  );

  const promptConfig: SavedPrompt = {
    id:
      existingIndex >= 0
        ? savedPrompts.value[existingIndex].id
        : Date.now().toString(),
    name: promptName,
    systemPrompt: systemPrompt.value,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    createdAt:
      existingIndex >= 0
        ? savedPrompts.value[existingIndex].createdAt
        : Date.now(),
  };

  if (existingIndex >= 0) {
    // 更新现有配置
    savedPrompts.value[existingIndex] = promptConfig;
  } else {
    // 添加新配置
    savedPrompts.value.push(promptConfig);
  }

  await savePromptsToStorage();

  newPromptName.value = "";
  currentPromptName.value = promptName;
};

// 清除当前提示词选择
const clearCurrentPrompt = async () => {
  currentPromptName.value = "";
  await safeStorageOperation(
    () => storage!.currentPrompt.remove(),
    "清除当前提示词失败:",
  );
};

/**
 * 获取当前光标所在的块ID
 */
function getCurrentBlockId(): string | null {
  // 方法1: 获取当前选中的块
  const selectedBlock = document.querySelector(".protyle-wysiwyg--select");
  if (selectedBlock) {
    return selectedBlock.getAttribute("data-node-id");
  }

  // 方法2: 获取光标所在的块（聚焦的块）
  const focusedBlock = document.querySelector(
    ".protyle-wysiwyg [data-node-id].protyle-wysiwyg--focus",
  );
  if (focusedBlock) {
    return focusedBlock.getAttribute("data-node-id");
  }

  // 方法3: 通过 window.getSelection() 精确获取光标位置
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    let node: Node | null = range.startContainer;

    // 向上查找直到找到带有 data-node-id 和 data-type 的元素
    while (node) {
      if (node instanceof Element) {
        const nodeId = node.getAttribute("data-node-id");
        const dataType = node.getAttribute("data-type");

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
    console.error("获取文档ID失败:", error);
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
  currentPromptName.value = prompt.name;
};

// 加载提示词配置
const loadPrompt = async (index: number) => {
  const prompt = savedPrompts.value[index];
  if (!prompt) return;

  applyPromptConfig(prompt);
  showPromptSelector.value = false;

  // 保存当前选中的提示词到存储
  await safeStorageOperation(
    () => storage!.currentPrompt.save(prompt.name),
    "保存当前提示词失败:",
  );
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

// 保存提示词到存储
const savePromptsToStorage = async () => {
  await safeStorageOperation(
    () => storage!.prompts.save(savedPrompts.value),
    "保存提示词配置失败:",
  );
};

// 从存储加载提示词配置
const loadPromptsFromStorage = async () => {
  if (!storage) return;

  try {
    const prompts = await storage.prompts.loadOrDefault();
    if (prompts) {
      savedPrompts.value = prompts;
    }

    const loadedCurrentPromptName = await storage.currentPrompt.load();
    if (loadedCurrentPromptName) {
      const promptIndex = savedPrompts.value.findIndex(
        (p) => p.name === loadedCurrentPromptName,
      );
      if (promptIndex !== -1) {
        loadPrompt(promptIndex);
      }
    }
  } catch (error) {
    console.error("从插件存储加载提示词配置失败:", error);
  }
};

// 组件挂载时加载保存的提示词和技能
onMounted(async () => {
  // 初始化存储实例
  if (props.plugin) {
    storage = new AIGeneratorStorage(props.plugin);
    await storage.init();
    await loadPromptsFromStorage();
    await loadSettings();
  }
  // 异步加载技能
  loadSkills();
});

// 组件卸载时清理 RAF
onUnmounted(() => {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
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
    model: selectedModel.value,
    customModel: customModel.value,
    enableThinking: enableThinking.value,
    webSearch: webSearch.value,
  };

  await safeStorageOperation(
    () => storage!.settings.save(settings),
    "保存设置失败:",
  );
};

// 加载设置
const loadSettings = async () => {
  if (!storage) return;

  try {
    const settings = await storage.settings.load();
    if (settings) {
      systemPrompt.value = settings.systemPrompt || systemPrompt.value;
      temperature.value = settings.temperature ?? temperature.value;
      maxTokens.value = settings.maxTokens || maxTokens.value;
      selectedModel.value = settings.model || "";
      customModel.value = settings.customModel || "";
      enableThinking.value = settings.enableThinking ?? false;
      webSearch.value = settings.webSearch ?? false;
    }
    isSettingsLoaded = true;
  } catch (error) {
    console.error("从插件存储加载设置失败:", error);
  }
};

// 监听设置变化（使用 debounce 避免频繁保存）
let settingsSaveTimer: number | null = null;
watch([systemPrompt, temperature, maxTokens, selectedModel, customModel, enableThinking, webSearch], () => {
  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer);
  }
  settingsSaveTimer = window.setTimeout(() => {
    saveSettings();
  }, SETTINGS_SAVE_DEBOUNCE_MS);
});
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
