<template>
  <div class="word-query-panel">
    <!-- 顶部操作栏 -->
    <div class="query-header">
      <div class="mode-tabs">
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'word' }"
          variant="ghost"
          size="small"
          @click="switchMode('word')"
        >
          📖 {{ props.i18n.wordQuery?.title || '单词查询' }}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'translate' }"
          variant="ghost"
          size="small"
          @click="switchMode('translate')"
        >
          🌐 {{ props.i18n.wordQuery?.translation || '长文翻译' }}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'codeTranslation' }"
          variant="ghost"
          size="small"
          @click="switchMode('codeTranslation')"
        >
          💻 {{ props.i18n.wordQuery?.codeTranslation || '编程翻译' }}
        </Button>
      </div>

      <div class="api-key-toggle">
        <Button variant="ghost" size="small" @click="togglePanel('advanced')" :title="props.i18n.wordQuery?.advancedOptions || '高级选项'">
          <IconWrapper name="generalSettings" :size="18" />
        </Button>
      </div>
    </div>

    <!-- 单词查询模式 -->
    <div v-if="currentMode === 'word'" class="mode-content">
      <div class="input-section">
        <div class="input-wrapper">
          <Input
            v-model="searchWord"
            class="query-input"
            :placeholder="props.i18n.wordQuery?.enterWordPlaceholder || '输入单词或词语，2秒后自动查询...'"
            @keydown.enter="handleQuery"
          />
          <Button class="query-btn" @click="handleQuery" :disabled="isLoading" :loading="isLoading">
            <IconWrapper name="search" :size="16" />
          </Button>
        </div>
      </div>

    <!-- 通用面板 -->
    <div
      v-if="activePanel"
      :class="`${activePanel}-panel`"
      class="common-panel"
    >
      <div class="panel-header">
        <span>{{ getPanelConfig(activePanel).icon }} {{ getPanelConfig(activePanel).title }}</span>
        <div class="panel-actions">
          <Button variant="ghost" size="small" @click="togglePanel(null)">
            <IconWrapper name="close" :size="16" />
          </Button>
        </div>
      </div>



      <!-- 高级选项面板内容 -->
      <div v-if="activePanel === 'advanced'" class="panel-content advanced-content">
        <div class="option-group">
          <label class="option-label">
            <span>🔊 {{ props.i18n.wordQuery?.pronunciation || '发音设置' }}</span>
          </label>
          <div class="option-row">
            <label class="radio-label">
              <input type="radio" value="uk" v-model="pronunciationType" />
              <span>🇬🇧 {{ props.i18n.wordQuery?.britishPronunciation || '英式发音' }}</span>
            </label>
            <label class="radio-label">
              <input type="radio" value="us" v-model="pronunciationType" />
              <span>🇺🇸 {{ props.i18n.wordQuery?.americanPronunciation || '美式发音' }}</span>
            </label>
          </div>
        </div>

        <div class="option-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="autoPlayPronunciation" />
            <span>🎵 {{ props.i18n.wordQuery?.autoPlayPronunciation || '查询后自动播放发音' }}</span>
          </label>
        </div>

        <div class="option-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="showRelatedWords" />
            <span>🔗 {{ props.i18n.wordQuery?.showRelatedWords || '显示相关词推荐' }}</span>
          </label>
        </div>
      </div>
    </div>

      <!-- 查询结果 -->
      <div class="query-content">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="query-loading">
        <div class="loading-spinner-large"></div>
        <p>{{ props.i18n.wordQuery?.querying || '正在查询...' }}</p>
      </div>

      <!-- 错误提示 -->
      <div v-else-if="errorMessage" class="query-error">
        <p>{{ errorMessage }}</p>
      </div>

      <!-- 查询结果 -->
      <div v-else-if="queryResult" class="query-result">
        <div class="result-content" v-html="formattedResult"></div>
        <div class="result-actions">
          <!-- 复制选项下拉菜单 -->
          <div class="dropdown" :class="{ active: showCopyOptions }">
            <Button variant="secondary" size="small" @click="toggleCopyOptions">
              <IconWrapper name="contentCopy" :size="16" />
              {{ props.i18n.wordQuery?.copy || '复制' }}
              <IconWrapper name="down" :size="12" />
            </Button>
            <div class="dropdown-menu" v-show="showCopyOptions">
              <Button variant="ghost" size="small" class="dropdown-item" @click="copyResult('all')">
                {{ props.i18n.wordQuery?.copyAll || '复制全部' }}
              </Button>
              <Button variant="ghost" size="small" class="dropdown-item" @click="copyResult('phonetic')">
                {{ props.i18n.wordQuery?.copyPhonetic || '复制音标' }}
              </Button>
              <Button variant="ghost" size="small" class="dropdown-item" @click="copyResult('meaning')">
                {{ props.i18n.wordQuery?.copyMeaning || '复制释义' }}
              </Button>
              <Button variant="ghost" size="small" class="dropdown-item" @click="copyResult('english')" v-if="extractContentParts.english">
                {{ props.i18n.wordQuery?.copyEnglish || '复制英文' }}
              </Button>
              <Button variant="ghost" size="small" class="dropdown-item" @click="copyResult('pronunciation')">
                {{ props.i18n.wordQuery?.copyPronunciation || '复制谐音' }}
              </Button>
              <Button variant="ghost" size="small" class="dropdown-item" @click="copyResult('example')">
                {{ props.i18n.wordQuery?.copyExample || '复制例句' }}
              </Button>
            </div>
          </div>



          <!-- 播放发音按钮 -->
          <Button variant="secondary" size="small" @click="playPronunciation(searchWord)">
            <IconWrapper name="play" :size="16" />
            {{ props.i18n.wordQuery?.play || '播放' }}
          </Button>

          <!-- 导出按钮 -->
          <Button variant="secondary" size="small" @click="exportToSiyuan">
            <IconWrapper name="up" :size="16" />
            {{ props.i18n.wordQuery?.export || '导出' }}
          </Button>

          <Button variant="ghost" size="small" @click="clearResult">
            <IconWrapper name="delete" :size="16" />
            {{ props.i18n.wordQuery?.clear || '清除' }}
          </Button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="query-empty">
        <div class="empty-icon">📚</div>
        <p>{{ props.i18n.wordQuery?.enterWordHint || '输入中英文单词或词语查询释义、音标、谐音等信息' }}</p>
      </div>
      </div>
    </div>

    <!-- 翻译模式 -->
    <div v-else-if="currentMode === 'translate'" class="mode-content translate-mode">
      <div class="translate-container">
        <div class="translate-input-section">
          <div class="section-header">
            <span class="section-title">{{ props.i18n.wordQuery?.sourceText || '原文' }}</span>
            <Select
              v-model="sourceLanguage"
              :options="LANGUAGE_OPTIONS"
              size="small"
              class="language-select"
            />
          </div>
          <Textarea
            v-model="translateText"
            class="translate-textarea"
            :placeholder="props.i18n.wordQuery?.enterTextToTranslate || '输入要翻译的文本，2秒后自动翻译...'"
            :rows="8"
          />
          <div class="input-actions">
            <Button variant="ghost" size="small" @click="clearTranslateInput">
              <IconWrapper name="delete" :size="16" />
              {{ props.i18n.wordQuery?.clear || '清除' }}
            </Button>
            <Button variant="primary" size="small" @click="handleTranslate" :disabled="isTranslating" :loading="isTranslating">
              <IconWrapper name="translate" :size="16" />
              {{ isTranslating ? (props.i18n.wordQuery?.translating || '翻译中...') : (props.i18n.wordQuery?.translate || '翻译') }}
            </Button>
          </div>
        </div>

        <div class="translate-divider">
          <div class="divider-line"></div>
          <Button variant="ghost" size="small" class="swap-btn" @click="swapLanguages" :title="props.i18n.wordQuery?.swapLanguages || '交换语言'">
            <IconWrapper name="shuffle" :size="16" />
          </Button>
          <div class="divider-line"></div>
        </div>

        <div class="translate-output-section">
          <div class="section-header">
            <span class="section-title">{{ props.i18n.wordQuery?.translatedText || '译文' }}</span>
            <Select
              v-model="targetLanguage"
              :options="TARGET_LANGUAGE_OPTIONS"
              size="small"
              class="language-select"
            />
          </div>
          <div class="translate-result" v-if="translateResult">
            <div class="result-text">{{ translateResult }}</div>
          </div>
          <div class="translate-empty" v-else>
            <div class="empty-icon">🌍</div>
            <p>{{ props.i18n.wordQuery?.translationWillAppearHere || '翻译结果将显示在这里' }}</p>
          </div>
          <div class="output-actions" v-if="translateResult">
            <Button variant="ghost" size="small" @click="copyTranslation">
              <IconWrapper name="contentCopy" :size="16" />
              {{ props.i18n.wordQuery?.copy || '复制' }}
            </Button>
            <Button variant="ghost" size="small" @click="exportTranslation">
              <IconWrapper name="up" :size="16" />
              {{ props.i18n.wordQuery?.export || '导出' }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 编程翻译模式 -->
    <div v-else-if="currentMode === 'codeTranslation'" class="mode-content">
      <CodeTranslationPanel
        :i18n="props.i18n.wordQuery || {}"
        :plugin="props.plugin"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, type Ref } from 'vue';
import { showMessage } from 'siyuan';
import IconWrapper from '@/components/IconWrapper.vue';
import Button from '@/components/Button.vue';
import Input from '@/components/Input.vue';
import Select from '@/components/Select.vue';
import Textarea from '@/components/Textarea.vue';
import CodeTranslationPanel from './CodeTranslationPanel.vue';

// ================================
// 类型定义
// ================================

interface Props {
  i18n: any;
  plugin?: any;
  onQuery: (word: string) => Promise<string>;
  onTranslate?: (text: string, sourceLang: string, targetLang: string) => Promise<string>;
}





// ================================
// 常量配置
// ================================

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
  { value: 'ja', label: '日文' },
  { value: 'ko', label: '韩文' },
  { value: 'fr', label: '法文' },
  { value: 'de', label: '德文' },
  { value: 'es', label: '西班牙文' }
];

// 从 LANGUAGE_OPTIONS 派生语言名称映射
const LANGUAGE_NAMES = Object.fromEntries(
  LANGUAGE_OPTIONS.map(opt => [opt.value, opt.label])
) as Record<string, string>;

// 目标语言选项（不包含自动检测）
const TARGET_LANGUAGE_OPTIONS = LANGUAGE_OPTIONS.filter(opt => opt.value !== 'auto');

// 配置常量
const AUTO_OPERATION_DELAY = 2000;
const WORD_PATTERN = /^[a-zA-Z0-9\s\-.,;:!?'"()（）【】《》《""''\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF]+$/;

// 字段类型配置
const FIELD_MAPPINGS = [
  { pattern: /(单词|词语)：/, class: 'word-section', label: '$1：' },
  { pattern: /(拼音|音标)：/, class: 'phonetic-section', label: '$1：' },
  { pattern: /(英文)：/, class: 'english-section', label: '$1：' },
  { pattern: /(释义)：/, class: 'meaning-section', label: '$1：' },
  { pattern: /(谐音)：/, class: 'pronunciation-section', label: '$1：' },
  { pattern: /(发音)：/, class: 'tip-section', label: '$1：' },
  { pattern: /(例句)：/, class: 'example-section', label: '$1：' }
];

// 内容提取模式
const CONTENT_PATTERNS = {
  phonetic: [/音标：[^\n]+/, /拼音：[^\n]+/],
  meaning: [/释义：[^\n]+/],
  english: [/英文：[^\n]+/],
  pronunciation: [/谐音：[^\n]+/],
  example: [/例句：[\s\S]+/]
};

// 数据存储键
const STORAGE_KEYS = {
  OPTIONS: 'word-query-options'
};

const props = defineProps<Props>();

// 基础状态
const currentMode = ref<'word' | 'translate' | 'codeTranslation'>('word');
const searchWord = ref('');
const queryResult = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const showCopyOptions = ref(false);

// 翻译模式状态
const translateText = ref('');
const translateResult = ref('');
const isTranslating = ref(false);
const sourceLanguage = ref('auto');
const targetLanguage = ref('zh');

// 面板状态管理
const activePanel = ref<string | null>(null);

// 设置状态
const pronunciationType = ref<'uk' | 'us'>('uk');
const autoPlayPronunciation = ref(false);
const showRelatedWords = ref(true);

// 定时器
const autoQueryTimer = ref<NodeJS.Timeout | null>(null);
const autoTranslateTimer = ref<NodeJS.Timeout | null>(null);

// 格式化查询结果
const formattedResult = computed(() => {
  if (!queryResult.value) return '';

  let html = queryResult.value;

  // 转换标题
  html = html.replace(/^#### (.+)$/gm, '<h4 class="result-title">$1</h4>');

  // 转换换行为段落标记
  html = html.replace(/\n/g, '<br>');

  // 提取第一个字段用于设置开始div
  const firstField = FIELD_MAPPINGS.find(m => m.pattern.test(html));
  let sectionClass = 'result-section';
  let labelReplacement = '';

  if (firstField) {
    sectionClass = `result-section ${firstField.class}`;
    labelReplacement = `<div class="${sectionClass}"><span class="result-label">${firstField.label}`;
  }

  // 应用字段映射
  FIELD_MAPPINGS.forEach((mapping, index) => {
    if (index === 0 && firstField) {
      // 第一个字段已经处理
      return;
    }
    html = html.replace(mapping.pattern, `</div><div class="result-section ${mapping.class}"><span class="result-label">${mapping.label}`);
  });

  // 为第一个字段添加开始div
  if (firstField) {
    html = html.replace(firstField.pattern, labelReplacement);
  }

  // 包装整个内容
  html = '<div class="result-wrapper">' + html + '</div>';

  // 处理加粗文本
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  return html;
});

// 提取查询结果中的各个部分
const extractContentParts = computed(() => {
  if (!queryResult.value) return {};

  const content = queryResult.value;
  const parts: any = {};

  // 批量提取内容
  Object.entries(CONTENT_PATTERNS).forEach(([key, patterns]) => {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const label = match[0].split('：')[0];
        parts[key] = match[0].replace(`${label}：`, '').trim();
        break;
      }
    }
  });

  parts.all = content;
  return parts;
});

// 验证输入
const validateInput = (input: string, type: 'word' | 'text' = 'word') => {
  if (!input.trim()) {
    return type === 'word' ? '请输入单词' : '请输入文本';
  }

  if (type === 'word' && !WORD_PATTERN.test(input)) {
    return '请输入有效的单词或词语';
  }

  return null;
};

// 处理查询
const handleQuery = async () => {
  const word = searchWord.value.trim();
  const error = validateInput(word, 'word');
  if (error) {
    errorMessage.value = error;
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const result = await props.onQuery(word);
    if (result) {
      queryResult.value = result;
      if (autoPlayPronunciation.value) {
        playPronunciation(word);
      }
    } else {
      errorMessage.value = props.i18n.wordQuery?.queryFailed || '查询失败,请重试';
    }
  } catch (error) {
    console.error('Query error:', error);
    errorMessage.value = (error as Error).message || props.i18n.wordQuery?.unknownError || '未知错误';
  } finally {
    isLoading.value = false;
  }
};

// 数据操作封装
const dataOperations = {
  async withPluginRetry<T>(
    operation: (plugin: any) => Promise<T>,
    operationName: string
  ): Promise<T | null> {
    const maxRetries = 10;
    const retryDelay = 100;

    const executeWithRetry = async (retryCount = 0): Promise<T | null> => {
      if (props.plugin) {
        try {
          return await operation(props.plugin);
        } catch (error) {
          console.error(`[WordQuery] ${operationName} failed:`, error);
          throw error;
        }
      }

      if (retryCount < maxRetries) {
        console.warn(`[WordQuery] No plugin instance for ${operationName}, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return executeWithRetry(retryCount + 1);
      }

      console.error(`[WordQuery] Max retries reached for ${operationName}`);
      return null;
    };

    return executeWithRetry();
  },

  save: async (key: string, data: any) => {
    return dataOperations.withPluginRetry(
      (plugin) => plugin.saveData(key, data),
      `saving ${key}`
    );
  },

  load: async (key: string) => {
    return dataOperations.withPluginRetry(
      (plugin) => plugin.loadData(key),
      `loading ${key}`
    );
  }
};

// 面板操作
const togglePanel = (panelKey: string | null) => {
  activePanel.value = activePanel.value === panelKey ? null : panelKey;
};



// 播放发音
const playPronunciation = (word: string) => {
  try {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = pronunciationType.value === 'uk' ? 'en-GB' : 'en-US';
    utterance.rate = 0.8; // 语速
    speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Failed to play pronunciation:', error);
  }
};

// 导出到思源笔记
const exportToSiyuan = async () => {
  if (!queryResult.value) {
    showMessage('没有可导出的内容', 2000, 'error');
    return;
  }

  const word = searchWord.value.trim();
  const content = `## ${word}\n\n${queryResult.value}`;
  copyToClipboard(content, props.i18n.wordQuery?.exportFailed || '导出失败');
};

// 高级选项数据
const advancedOptionsData = computed(() => ({
  pronunciationType: pronunciationType.value,
  autoPlayPronunciation: autoPlayPronunciation.value,
  showRelatedWords: showRelatedWords.value
}));

// 保存高级选项
const saveAdvancedOptions = async () => {
  try {
    await dataOperations.save(STORAGE_KEYS.OPTIONS, advancedOptionsData.value);
  } catch (error) {
    console.error('[WordQuery] Failed to save advanced options:', error);
  }
};

// 加载高级选项
const loadAdvancedOptions = async () => {
  const saved = await dataOperations.load(STORAGE_KEYS.OPTIONS);
  if (saved && typeof saved === 'object') {
    pronunciationType.value = saved.pronunciationType || 'uk';
    autoPlayPronunciation.value = saved.autoPlayPronunciation ?? false;
    showRelatedWords.value = saved.showRelatedWords ?? true;
  } else {
    // 使用默认值
    pronunciationType.value = 'uk';
    autoPlayPronunciation.value = false;
    showRelatedWords.value = true;
  }
};



// 清除定时器
const clearTimer = (timerRef: Ref<NodeJS.Timeout | null>) => {
  if (timerRef.value) {
    clearTimeout(timerRef.value);
    timerRef.value = null;
  }
};

// 自动查询函数
const setupAutoQuery = () => {
  clearTimer(autoQueryTimer);

  const word = searchWord.value.trim();
  if (word && WORD_PATTERN.test(word)) {
    autoQueryTimer.value = setTimeout(() => {
      handleQuery();
    }, AUTO_OPERATION_DELAY);
  }
};

// 自动翻译函数
const setupAutoTranslate = () => {
  clearTimer(autoTranslateTimer);

  const text = translateText.value.trim();
  if (text && !isTranslating.value) {
    autoTranslateTimer.value = setTimeout(() => {
      handleTranslate();
    }, AUTO_OPERATION_DELAY);
  }
};

// 切换复制选项显示
const toggleCopyOptions = () => {
  showCopyOptions.value = !showCopyOptions.value;
};

// 复制结果
const copyResult = async (type: string = 'all') => {
  let textToCopy = '';
  let hasContent = false;

  if (type === 'all') {
    textToCopy = extractContentParts.value.all || queryResult.value;
    hasContent = !!textToCopy;
  } else {
    textToCopy = extractContentParts.value[type] || '';
    hasContent = !!textToCopy;
  }

  if (!hasContent) {
    showMessage('没有找到要复制的内容', 2000, 'error');
    return;
  }

  if (copyToClipboard(textToCopy, props.i18n.wordQuery?.copyFailed || '复制失败')) {
    showCopyOptions.value = false;
  }
};

// 清除结果
const clearResult = () => {
  queryResult.value = '';
  errorMessage.value = '';
};

// 切换模式
const switchMode = (mode: 'word' | 'translate' | 'codeTranslation') => {
  currentMode.value = mode;
  // 关闭所有面板
  activePanel.value = null;
};

// 翻译功能
const handleTranslate = async () => {
  const text = translateText.value.trim();
  const error = validateInput(text, 'text');
  if (error) {
    showMessage(error, 2000, 'error');
    return;
  }

  isTranslating.value = true;
  translateResult.value = '';

  try {
    // 如果父组件提供了翻译方法，使用它
    if (props.onTranslate) {
      const result = await props.onTranslate(text, sourceLanguage.value, targetLanguage.value);
      translateResult.value = result;
    } else {
      // 否则使用默认的查询方法（通过特殊格式）
      const prompt = `请将以下${sourceLanguage.value === 'auto' ? '' : getLanguageName(sourceLanguage.value)}文本翻译成${getLanguageName(targetLanguage.value)}，只输出翻译结果，不要有其他说明：\n\n${text}`;
      const result = await props.onQuery(prompt);
      translateResult.value = result;
    }
  } catch (error) {
    console.error('Translation error:', error);
    showMessage('翻译失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    isTranslating.value = false;
  }
};

// 获取面板图标
const PANEL_CONFIG = {
  advanced: {
    icon: '⚙️',
    title: props.i18n.wordQuery?.advancedOptions || '高级选项'
  }
} as const;

const getPanelConfig = (panel: string) => {
  return PANEL_CONFIG[panel as keyof typeof PANEL_CONFIG] || { icon: '', title: '' };
};

// 获取语言名称
const getLanguageName = (code: string): string => {
  return LANGUAGE_NAMES[code] || code;
};

// 交换语言
const swapLanguages = () => {
  if (sourceLanguage.value === 'auto') {
    showMessage('自动检测模式无法交换', 2000, 'info');
    return;
  }
  const temp = sourceLanguage.value;
  sourceLanguage.value = targetLanguage.value;
  targetLanguage.value = temp;

  // 交换文本
  const tempText = translateText.value;
  translateText.value = translateResult.value;
  translateResult.value = tempText;
};

// 清除翻译输入
const clearTranslateInput = () => {
  translateText.value = '';
  translateResult.value = '';
};

const clearAll = () => {
  searchWord.value = '';
  queryResult.value = '';
  translateText.value = '';
  translateResult.value = '';
  errorMessage.value = '';
};

// 复制翻译结果
const copyTranslation = async () => {
  if (!translateResult.value) {
    showMessage('没有可复制的内容', 2000, 'error');
    return;
  }
  copyToClipboard(translateResult.value, '复制失败');
};

// 导出翻译结果
const exportTranslation = async () => {
  if (!translateResult.value) {
    showMessage('没有可导出的内容', 2000, 'error');
    return;
  }

  const content = `## 翻译结果\n\n### 原文 (${getLanguageName(sourceLanguage.value)})\n${translateText.value}\n\n### 译文 (${getLanguageName(targetLanguage.value)})\n${translateResult.value}`;
  copyToClipboard(content, '导出失败');
};

// 键盘快捷键
const handleKeyDown = (event: KeyboardEvent) => {
  // Ctrl/Cmd + Enter 执行查询或翻译
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    if (currentMode.value === 'word') {
      handleQuery();
    } else {
      handleTranslate();
    }
  }
  // Escape 清除结果并关闭下拉菜单
  if (event.key === 'Escape') {
    clearResult();
    showCopyOptions.value = false;
  }
};

// 点击外部关闭下拉菜单
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.dropdown')) {
    showCopyOptions.value = false;
  }
};

// ================================
// 通用工具函数
// ================================

// 剪贴板操作通用函数
const copyToClipboard = async (text: string, errorMessage?: string) => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    if (errorMessage) showMessage(errorMessage, 3000, 'error');
    return false;
  }
};

// ================================
// 监听器
// ================================

// 监听搜索词变化
watch(searchWord, () => {
  setupAutoQuery();
});

// 监听翻译文本变化
watch(translateText, () => {
  setupAutoTranslate();
});

// 监听高级选项变化
watch([pronunciationType, autoPlayPronunciation, showRelatedWords], async () => {
  await saveAdvancedOptions();
});

// ================================
// 生命周期
// ================================

// 等待 plugin 实例准备就绪
const waitForPlugin = async (maxRetries = 20) => {
  for (let i = 0; i < maxRetries; i++) {
    if (props.plugin) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.error('[WordQuery] Plugin instance not available after max retries');
  return false;
};

// 初始化数据
const initializeData = async () => {
  const pluginReady = await waitForPlugin();
  if (!pluginReady) {
    console.error('[WordQuery] Cannot initialize data without plugin instance');
    return;
  }

  try {
    await loadAdvancedOptions();
  } catch (error) {
    console.error('[WordQuery] Failed to load data:', error);
  }
};

onMounted(async () => {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleClickOutside);

  // 延迟初始化数据
  setTimeout(initializeData, 100);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('click', handleClickOutside);

  // 清理所有定时器
  autoQueryTimer.value && clearTimeout(autoQueryTimer.value);
  autoTranslateTimer.value && clearTimeout(autoTranslateTimer.value);
});
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
