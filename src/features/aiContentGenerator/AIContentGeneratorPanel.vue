<template>
  <div class="ai-content-panel">
    <!-- 顶部工具栏 -->
    <div class="panel-header">
      <div class="header-title">
        <span>🤖 {{ i18n.aiContentGenerator || 'AI信息生成' }}</span>
      </div>
      <div class="header-actions">
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

      <!-- 引用当前文档按钮（需求1：添加取消按钮） -->
      <div class="reference-doc-wrapper">
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

      <div class="input-wrapper">
        <textarea
          v-model="userInput"
          class="user-input"
          :placeholder="i18n.inputPlaceholder || '输入您的问题或需求...'"
          rows="3"
          @keydown.ctrl.enter="handleGenerate"
        ></textarea>
        <button
          class="btn-generate"
          @click="handleGenerate"
          :disabled="isGenerating || !userInput.trim()"
        >
          <div v-if="isGenerating" class="loading-spinner"></div>
          <svg v-else width="18" height="18">
            <use xlink:href="#iconSend"></use>
          </svg>
          <span>{{ isGenerating ? (i18n.generating || '生成中...') : (i18n.generate || '生成') }}</span>
        </button>
      </div>
    </div>

    <!-- 输出区域 -->
    <div class="output-section">
      <!-- 加载状态 -->
      <div v-if="isGenerating" class="loading-state">
        <div class="loading-spinner-large"></div>
        <p>{{ i18n.aiThinking || 'AI正在思考...' }}</p>
      </div>

      <!-- 错误提示 -->
      <div v-else-if="errorMessage" class="error-state">
        <svg width="48" height="48" class="error-icon">
          <use xlink:href="#iconCloseRound"></use>
        </svg>
        <p>{{ errorMessage }}</p>
        <button class="btn-retry" @click="handleGenerate">
          {{ i18n.retry || '重试' }}
        </button>
      </div>

      <!-- 生成结果 -->
      <div v-else-if="displayedContent || generatedContent" class="result-container">
        <div class="result-header">
          <span class="result-title">📝 {{ i18n.generatedContent || '生成内容' }}</span>
          <div class="result-actions">
            <button class="btn-action" @click="copyContent" :title="i18n.copyMarkdown || '复制Markdown'">
              <svg width="16" height="16">
                <use xlink:href="#iconCopy"></use>
              </svg>
              {{ i18n.copy || '复制' }}
            </button>
            <!-- 需求4：删除插入按钮 -->
            <button class="btn-action btn-clear" @click="clearContent">
              <svg width="16" height="16">
                <use xlink:href="#iconTrashcan"></use>
              </svg>
              {{ i18n.clear || '清除' }}
            </button>
          </div>
        </div>
        <div class="result-content">
          <!-- 需求6：移除原始Markdown显示，使渲染内容可自由复制 -->
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

// Props
interface Props {
  i18n: any;
  onGenerate: (options: GenerateOptions) => Promise<string>;
}

interface GenerateOptions {
  userInput: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  context?: string;
  onChunk?: (chunk: string) => void; // 流式输出回调（修复问题2）
}

const props = defineProps<Props>();

// 状态
const userInput = ref('');
const generatedContent = ref('');
const isGenerating = ref(false);
const errorMessage = ref('');
const showRaw = ref(false);
const showSettings = ref(false);
const showContextSettings = ref(false);

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
let typewriterTimer: number | null = null;

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

// 渲染Markdown (使用marked库进行标准渲染，支持代码高亮)
const renderedDisplayedMarkdown = computed(() => {
  if (!displayedContent.value) return '';
  try {
    // 配置marked选项（修复问题3：添加代码高亮）
    marked.setOptions({
      breaks: true,  // 支持GFM换行
      gfm: true,     // 启用GitHub风格的Markdown
    });

    // 使用marked渲染，但需要清理标题中的粗体标记
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

// 切换设置面板
const toggleSettings = () => {
  showSettings.value = !showSettings.value;
};

// 打字机效果（修复问题2：不再需要，流式输出会实时更新）
const startTypewriter = (text: string) => {
  // 流式输出时不需要打字机效果，直接显示
  displayedContent.value = text;
};

// 停止打字机效果
const stopTypewriter = () => {
  // 流式输出时不需要清理
};

// 生成内容（修复问题1：默认启用打字机效果，修复问题2：添加当前文档上下文）
const handleGenerate = async () => {
  if (!userInput.value.trim()) {
    showMessage(props.i18n.enterInput || '请输入内容', 2000, 'info');
    return;
  }

  isGenerating.value = true;
  errorMessage.value = '';
  generatedContent.value = '';
  displayedContent.value = '';
  stopTypewriter();

  try {
    let finalSystemPrompt = systemPrompt.value;
    if (enableMarkdown.value) {
      finalSystemPrompt += '\n\n**重要**: 请严格使用Markdown格式输出，包括标题(#)、列表(- 或 1.)、代码块(```)、粗体(**) 等标准语法。';
    }

    // 添加当前文档上下文（如果有）
    let contextInfo = '';
    if (referencedDocContent.value) {
      contextInfo = `

**当前文档信息**：
文档标题：${referencedDocTitle.value}
文档内容：
${referencedDocContent.value}

请基于以上文档内容回答用户问题。`;
    }

    const options: GenerateOptions = {
      userInput: userInput.value,
      systemPrompt: finalSystemPrompt,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      context: contextInfo || undefined,
      // 默认启用打字机效果，传入流式回调（修复问题1）
      onChunk: (chunk: string) => {
        displayedContent.value += chunk;
        generatedContent.value += chunk;
      }
    };

    const result = await props.onGenerate(options);

    if (result) {
      // 流式输出已经在onChunk中更新了
      showMessage('✓ 生成成功', 2000, 'info');
    } else {
      errorMessage.value = props.i18n.generateFailed || '生成失败，请重试';
    }
  } catch (error) {
    console.error('生成内容失败:', error);
    errorMessage.value = (error as Error).message || '生成失败';
    showMessage('生成失败: ' + errorMessage.value, 3000, 'error');
  } finally {
    isGenerating.value = false;
  }
};

// 复制内容（需求2：修复Markdown格式复制）
const copyContent = async () => {
  if (!generatedContent.value) return;

  try {
    // 使用原始Markdown内容，确保格式正确
    await navigator.clipboard.writeText(generatedContent.value);
    showMessage('✓ 已复制Markdown到剪贴板', 2000, 'info');
  } catch (error) {
    console.error('复制失败:', error);
    showMessage('复制失败', 2000, 'error');
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

// 保存当前提示词配置
const saveCurrentPrompt = () => {
  if (!newPromptName.value.trim()) {
    showMessage(props.i18n.enterPromptName || '请输入配置名称', 2000, 'info');
    return;
  }

  const promptConfig: SavedPrompt = {
    name: newPromptName.value.trim(),
    systemPrompt: systemPrompt.value,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    enableMarkdown: enableMarkdown.value,
    enableTypewriter: enableTypewriter.value
  };

  savedPrompts.value.push(promptConfig);
  savePromptsToStorage();
  newPromptName.value = '';
  showMessage(`✓ 已保存配置: ${promptConfig.name}`, 2000, 'info');
};

// 清除当前提示词选择（需求3：同时清除localStorage）
const clearCurrentPrompt = () => {
  currentPromptName.value = '';
  localStorage.removeItem(CURRENT_PROMPT_STORAGE_KEY);
  showMessage('✓ 已清除提示词选择', 1500, 'info');
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

// 保存到localStorage
const savePromptsToStorage = () => {
  try {
    localStorage.setItem('ai-content-generator-prompts', JSON.stringify(savedPrompts.value));
  } catch (error) {
    console.error('保存提示词配置失败:', error);
  }
};

// 从localStorage加载（需求3：同时加载当前提示词选择）
const loadPromptsFromStorage = () => {
  try {
    const stored = localStorage.getItem('ai-content-generator-prompts');
    if (stored) {
      savedPrompts.value = JSON.parse(stored);
    }

    // 需求3：加载保存的当前提示词
    const currentPrompt = localStorage.getItem(CURRENT_PROMPT_STORAGE_KEY);
    if (currentPrompt) {
      const promptIndex = savedPrompts.value.findIndex(p => p.name === currentPrompt);
      if (promptIndex !== -1) {
        // 自动加载保存的提示词配置
        loadPrompt(promptIndex);
      }
    }
  } catch (error) {
    console.error('加载提示词配置失败:', error);
  }
};

// 组件挂载时加载保存的提示词
onMounted(() => {
  loadPromptsFromStorage();
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

// 保存设置到本地存储（需求5：包含contextMessageLimit）
const saveSettings = () => {
  try {
    localStorage.setItem('ai-content-generator-settings', JSON.stringify({
      systemPrompt: systemPrompt.value,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      enableMarkdown: enableMarkdown.value,
      enableTypewriter: enableTypewriter.value,
      contextMessageLimit: contextMessageLimit.value
    }));
  } catch (error) {
    console.error('保存设置失败:', error);
  }
};

// 加载设置（需求5：包含contextMessageLimit）
const loadSettings = () => {
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
    console.error('加载设置失败:', error);
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
.ai-content-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
}

.settings-panel,
.context-panel {
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface-lighter);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-section {
  padding: 12px 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.btn-close {
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-error-lighter);
    transform: rotate(90deg);
  }
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 12px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }
}

.prompt-input {
  padding: 8px 12px;
  border: 2px solid var(--b3-theme-surface-light);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: all 0.2s;

  &:focus {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  }
}

.slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--b3-theme-surface-light);
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--b3-theme-primary);
    cursor: pointer;
  }
}

.slider-hint {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.number-input {
  padding: 6px 10px;
  border: 2px solid var(--b3-theme-surface-light);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 12px;
  outline: none;

  &:focus {
    border-color: var(--b3-theme-primary);
  }
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;

  input[type="checkbox"] {
    cursor: pointer;
  }
}

.input-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

// 当前提示词显示样式（修复问题1）
.current-prompt-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, var(--b3-theme-primary-lighter), var(--b3-theme-primary-lightest));
  border: 1px solid var(--b3-theme-primary-light);
  border-radius: 8px;
  font-size: 12px;
  animation: slideIn 0.3s ease-out;

  svg {
    color: var(--b3-theme-primary);
    flex-shrink: 0;
  }

  .prompt-label {
    color: var(--b3-theme-on-surface);
    font-weight: 500;
    opacity: 0.8;
  }

  .prompt-value {
    flex: 1;
    color: var(--b3-theme-primary);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-clear-prompt {
    flex-shrink: 0;
    padding: 4px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
    transition: all 0.2s;

    &:hover {
      background: var(--b3-theme-error-lighter);
      color: var(--b3-theme-error);
      opacity: 1;
      transform: rotate(90deg);
    }
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 提示词选择器样式
.prompt-selector-wrapper {
  position: relative;
  margin-bottom: 12px;
}

// 引用当前文档按钮样式（修复问题2）
.reference-doc-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.btn-reference-doc {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, var(--b3-theme-primary-lighter), var(--b3-theme-primary-lightest));
  border: 1px solid var(--b3-theme-primary-light);
  border-radius: 8px;
  font-size: 12px;
  color: var(--b3-theme-primary);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: linear-gradient(135deg, var(--b3-theme-primary-light), var(--b3-theme-primary-lighter));
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: translateY(0);
  }

  svg {
    flex-shrink: 0;
  }
}

.referenced-doc-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--b3-theme-surface-lighter);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  animation: slideIn 0.3s ease-out;

  // 需求1：取消按钮样式
  .btn-cancel-reference {
    flex-shrink: 0;
    padding: 2px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
    transition: all 0.2s;

    &:hover {
      background: var(--b3-theme-error-lighter);
      color: var(--b3-theme-error);
      opacity: 1;
      transform: rotate(90deg);
    }
  }
}

.btn-prompt-selector {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--b3-theme-surface);
  border: 2px solid var(--b3-theme-surface-light);
  border-radius: 8px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-surface-light);
  }

  svg {
    flex-shrink: 0;
  }

  span {
    flex: 1;
    text-align: left;
    margin: 0 8px;
  }

  .prompt-count {
    flex: none;
    padding: 2px 6px;
    background: var(--b3-theme-primary-lighter);
    color: var(--b3-theme-primary);
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    margin-left: 4px;
  }

  .arrow-icon {
    transition: transform 0.2s;
  }
}

.prompt-selector-panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 8px;
  background: var(--b3-theme-background);
  border: 2px solid var(--b3-theme-surface-light);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  animation: slideDown 0.2s ease-out;
}

.prompt-selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);

  .btn-close-small {
    padding: 4px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--b3-theme-on-surface);
    transition: all 0.2s;

    &:hover {
      background: var(--b3-theme-error-lighter);
      transform: rotate(90deg);
    }
  }
}

.empty-prompts {
  padding: 24px;
  text-align: center;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  font-size: 12px;
}

.prompt-list {
  overflow-y: auto;
  padding: 8px;
  max-height: 340px;
}

.prompt-item {
  padding: 12px;
  margin-bottom: 8px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-surface-light);
    transform: translateX(4px);
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.prompt-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.prompt-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.btn-delete-prompt {
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-error-lighter);
    color: var(--b3-theme-error);
    opacity: 1;
  }
}

.prompt-item-preview {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  margin-bottom: 6px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.prompt-item-meta {
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: var(--b3-theme-primary);
  opacity: 0.8;
}

// 保存提示词配置样式
.save-prompt-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
}

.save-prompt-header {
  margin-bottom: 8px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }
}

.save-prompt-input-group {
  display: flex;
  gap: 8px;
}

.prompt-name-input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid var(--b3-theme-surface-light);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 12px;
  outline: none;
  transition: all 0.2s;

  &:focus {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  }
}

.btn-save-prompt {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-input {
  padding: 10px 12px;
  border: 2px solid var(--b3-theme-surface-light);
  border-radius: 8px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: all 0.2s;

  &:focus {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  }
}

.btn-generate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, var(--b3-theme-primary), var(--b3-theme-primary-lighter));
  color: var(--b3-theme-on-primary);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.3);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
}

.output-section {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.loading-state,
.error-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--b3-theme-on-surface);
}

.loading-spinner,
.loading-spinner-large {
  border: 3px solid var(--b3-theme-surface-light);
  border-top: 3px solid var(--b3-theme-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner {
  width: 18px;
  height: 18px;
}

.loading-spinner-large {
  width: 40px;
  height: 40px;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  color: var(--b3-theme-error);
  margin-bottom: 16px;
}

.btn-retry {
  margin-top: 16px;
  padding: 8px 16px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    opacity: 0.9;
  }
}

.result-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.result-actions {
  display: flex;
  gap: 6px;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface-light);
  }

  &.btn-clear:hover {
    background: var(--b3-theme-error-lighter);
    color: var(--b3-theme-error);
  }
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.markdown-preview {
  padding: 16px;
  background: var(--b3-theme-surface);
  border-radius: 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  line-height: 1.6;
  overflow-wrap: break-word;

  // 需求6：使内容可自由选择和复制
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  cursor: text;

  // 标题样式 - 使用标准Markdown间距（修复问题4）
  :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
    margin-top: 1.2em;
    margin-bottom: 0.6em;
    font-weight: 600;
    line-height: 1.3;

    &:first-child {
      margin-top: 0;
    }
  }

  :deep(h1) {
    font-size: 1.8em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--b3-theme-surface-lighter);
  }

  :deep(h2) {
    font-size: 1.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--b3-theme-surface-lighter);
  }

  :deep(h3) {
    font-size: 1.3em;
  }

  :deep(h4) {
    font-size: 1.1em;
  }

  :deep(h5) {
    font-size: 1em;
  }

  :deep(h6) {
    font-size: 0.9em;
    color: var(--b3-theme-on-surface);
    opacity: 0.8;
  }

  // 段落样式
  :deep(p) {
    margin-top: 0;
    margin-bottom: 0.8em;

    &:last-child {
      margin-bottom: 0;
    }
  }

  // 列表样式
  :deep(ul), :deep(ol) {
    margin-top: 0;
    margin-bottom: 0.8em;
    padding-left: 2em;

    li {
      margin-bottom: 0.3em;
    }
  }

  // 代码样式
  :deep(code) {
    padding: 2px 6px;
    background: var(--b3-theme-surface-lighter);
    border-radius: 3px;
    font-size: 0.9em;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  }

  :deep(pre) {
    padding: 12px;
    background: var(--b3-theme-surface-lighter);
    border-radius: 6px;
    overflow-x: auto;
    margin-top: 0;
    margin-bottom: 0.8em;

    code {
      padding: 0;
      background: transparent;
      font-size: 0.85em;
    }
  }

  // 引用样式
  :deep(blockquote) {
    margin: 0.8em 0;
    padding-left: 1em;
    border-left: 4px solid var(--b3-theme-primary);
    color: var(--b3-theme-on-surface);
    opacity: 0.8;

    p {
      margin-bottom: 0.4em;
    }
  }

  // 链接样式
  :deep(a) {
    color: var(--b3-theme-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  // 表格样式
  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 0.8em;

    th, td {
      border: 1px solid var(--b3-theme-surface-lighter);
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background: var(--b3-theme-surface-lighter);
      font-weight: 600;
    }
  }

  // 分隔线样式
  :deep(hr) {
    border: none;
    border-top: 1px solid var(--b3-theme-surface-lighter);
    margin: 1.5em 0;
  }

  // 图片样式
  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 0.5em 0;
  }
}

.raw-markdown {
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
  overflow: hidden;
}

.raw-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--b3-theme-surface);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: var(--b3-theme-surface-light);
  }
}

.btn-toggle {
  padding: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
}

.raw-content {
  margin: 0;
  padding: 12px;
  background: var(--b3-theme-surface-lighter);
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;

  code {
    font-family: 'Consolas', 'Monaco', monospace;
  }
}

.empty-icon {
  color: var(--b3-theme-on-surface);
  opacity: 0.3;
  margin-bottom: 16px;
}

.quick-templates {
  margin-top: 24px;
  width: 100%;
  max-width: 400px;
}

.templates-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--b3-theme-on-surface);
}

.template-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.btn-template {
  padding: 10px 12px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    background: var(--b3-theme-surface-light);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}
</style>
