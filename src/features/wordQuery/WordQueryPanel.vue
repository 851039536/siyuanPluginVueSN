<template>
  <div class="word-query-panel">
    <!-- 顶部操作栏 -->
    <div class="query-header">
      <div class="mode-tabs">
        <button
          class="mode-tab"
          :class="{ active: currentMode === 'word' }"
          @click="switchMode('word')"
        >
          📖 {{ props.i18n.wordQuery || '单词查询' }}
        </button>
        <button
          class="mode-tab"
          :class="{ active: currentMode === 'translate' }"
          @click="switchMode('translate')"
        >
          🌐 {{ props.i18n.translation || '长文翻译' }}
        </button>
      </div>

      <div class="api-key-toggle">
        <button class="settings-btn" @click="togglePanel('history')" :title="props.i18n.history || '历史记录'">
          <svg class="settings-icon"><use xlink:href="#iconHistory"></use></svg>
        </button>
        <button class="settings-btn" @click="togglePanel('favorites')" :title="props.i18n.favorites || '我的收藏'">
          <IconWrapper name="star" :size="18" />
        </button>
        <button class="settings-btn" @click="togglePanel('advanced')" :title="props.i18n.advancedOptions || '高级选项'">
          <IconWrapper name="generalSettings" :size="18" />
        </button>
      </div>
    </div>

    <!-- 单词查询模式 -->
    <div v-if="currentMode === 'word'" class="mode-content">
      <div class="input-section">
        <div class="input-wrapper">
          <input
            v-model="searchWord"
            type="text"
            class="query-input"
            :placeholder="props.i18n.enterWordPlaceholder || '输入单词或词语，2秒后自动查询...'"
            @keyup.enter="handleQuery"
          />
          <button class="query-btn" @click="handleQuery" :disabled="isLoading">
            <svg class="query-icon" v-if="!isLoading">
              <use xlink:href="#iconSearch"></use>
            </svg>
            <div class="loading-spinner" v-else></div>
          </button>
        </div>
      </div>

    <!-- 通用面板 -->
    <div
      v-if="activePanel"
      :class="`${activePanel}-panel`"
      class="common-panel"
    >
      <div class="panel-header">
        <span>{{ getPanelIcon(activePanel) }} {{ getPanelTitle(activePanel) }}</span>
        <div class="panel-actions">
          <button
            v-if="activePanel === 'history' && queryHistory.length > 0"
            class="btn-clear"
            @click="clearHistory"
          >清除</button>
          <button
            v-if="activePanel === 'favorites' && favorites.length > 0"
            class="btn-clear"
            @click="clearFavorites"
          >清除</button>
          <button class="close-btn" @click="togglePanel(null)">
            <svg class="close-icon"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
      </div>

      <!-- 历史记录面板内容 -->
      <div v-if="activePanel === 'history'" class="panel-content">
        <div v-if="queryHistory.length === 0" class="empty-state">
          <p>📑 {{ props.i18n.noHistory || '暂无查询历史' }}</p>
        </div>
        <div v-else class="item-list">
          <div
            v-for="item in queryHistory"
            :key="item.timestamp"
            class="list-item"
            @click="queryFromHistory(item)"
          >
            <div class="item-word">{{ item.word }}</div>
            <div class="item-time">{{ formatTime(item.timestamp) }}</div>
          </div>
        </div>
      </div>

      <!-- 收藏面板内容 -->
      <div v-if="activePanel === 'favorites'" class="panel-content">
        <div v-if="favorites.length === 0" class="empty-state">
          <p>📚 {{ props.i18n.noFavorites || '暂无收藏单词' }}</p>
        </div>
        <div v-else class="item-list">
          <div
            v-for="item in favorites"
            :key="item.timestamp"
            class="list-item"
          >
            <div class="item-content" @click="queryFromFavorite(item)">
              <div class="item-word">{{ item.word }}</div>
              <div class="item-time">{{ formatTime(item.timestamp) }}</div>
            </div>
            <button class="btn-remove" @click="removeFavorite(item.word)">
              <svg class="remove-icon"><use xlink:href="#iconTrashcan"></use></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 高级选项面板内容 -->
      <div v-if="activePanel === 'advanced'" class="panel-content advanced-content">
        <div class="option-group">
          <label class="option-label">
            <span>🔊 {{ props.i18n.pronunciation || '发音设置' }}</span>
          </label>
          <div class="option-row">
            <label class="radio-label">
              <input type="radio" value="uk" v-model="pronunciationType" />
              <span>🇬🇧 {{ props.i18n.britishPronunciation || '英式发音' }}</span>
            </label>
            <label class="radio-label">
              <input type="radio" value="us" v-model="pronunciationType" />
              <span>🇺🇸 {{ props.i18n.americanPronunciation || '美式发音' }}</span>
            </label>
          </div>
        </div>

        <div class="option-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="autoPlayPronunciation" />
            <span>🎵 {{ props.i18n.autoPlayPronunciation || '查询后自动播放发音' }}</span>
          </label>
        </div>

        <div class="option-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="showRelatedWords" />
            <span>🔗 {{ props.i18n.showRelatedWords || '显示相关词推荐' }}</span>
          </label>
        </div>
      </div>
    </div>

      <!-- 查询结果 -->
      <div class="query-content">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="query-loading">
        <div class="loading-spinner-large"></div>
        <p>{{ props.i18n.querying || '正在查询...' }}</p>
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
            <button class="action-btn copy-btn" @click="toggleCopyOptions">
              <svg class="action-icon"><use xlink:href="#iconCopy"></use></svg>
              {{ props.i18n.copy || '复制' }}
              <svg class="dropdown-icon"><use xlink:href="#iconDown"></use></svg>
            </button>
            <div class="dropdown-menu" v-show="showCopyOptions">
              <button class="dropdown-item" @click="copyResult('all')">
                {{ props.i18n.copyAll || '复制全部' }}
              </button>
              <button class="dropdown-item" @click="copyResult('phonetic')">
                {{ props.i18n.copyPhonetic || '复制音标' }}
              </button>
              <button class="dropdown-item" @click="copyResult('meaning')">
                {{ props.i18n.copyMeaning || '复制释义' }}
              </button>
              <button class="dropdown-item" @click="copyResult('english')" v-if="extractContentParts.english">
                {{ props.i18n.copyEnglish || '复制英文' }}
              </button>
              <button class="dropdown-item" @click="copyResult('pronunciation')">
                {{ props.i18n.copyPronunciation || '复制谐音' }}
              </button>
              <button class="dropdown-item" @click="copyResult('example')">
                {{ props.i18n.copyExample || '复制例句' }}
              </button>
            </div>
          </div>

          <!-- 收藏按钮 -->
          <button class="action-btn favorite-btn" @click="toggleFavorite" :class="{ favorited: currentWordFavorited }">
            <IconWrapper :name="currentWordFavorited ? 'star' : 'starOutline'" :size="16" class="action-icon" />
            {{ currentWordFavorited ? (props.i18n.unfavorite || '取消收藏') : (props.i18n.favorite || '收藏') }}
          </button>

          <!-- 播放发音按钮 -->
          <button class="action-btn play-btn" @click="playPronunciation(searchWord)">
            <svg class="action-icon"><use xlink:href="#iconPlay"></use></svg>
            {{ props.i18n.play || '播放' }}
          </button>

          <!-- 导出按钮 -->
          <button class="action-btn export-btn" @click="exportToSiyuan">
            <svg class="action-icon"><use xlink:href="#iconUpload"></use></svg>
            {{ props.i18n.export || '导出' }}
          </button>

          <button class="action-btn clear-btn" @click="clearResult">
            <svg class="action-icon"><use xlink:href="#iconTrashcan"></use></svg>
            {{ props.i18n.clear || '清除' }}
          </button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="query-empty">
        <div class="empty-icon">📚</div>
        <p>{{ props.i18n.enterWordHint || '输入中英文单词或词语查询释义、音标、谐音等信息' }}</p>
      </div>
      </div>
    </div>

    <!-- 翻译模式 -->
    <div v-else class="mode-content translate-mode">
      <div class="translate-container">
        <div class="translate-input-section">
          <div class="section-header">
            <span class="section-title">{{ props.i18n.sourceText || '原文' }}</span>
            <div class="language-selector">
              <select v-model="sourceLanguage" class="language-select">
                <option value="auto">{{ props.i18n.autoDetect || '自动检测' }}</option>
                <option value="zh">{{ props.i18n.chinese || '中文' }}</option>
                <option value="en">{{ props.i18n.english || '英文' }}</option>
                <option value="ja">{{ props.i18n.japanese || '日文' }}</option>
                <option value="ko">{{ props.i18n.korean || '韩文' }}</option>
                <option value="fr">{{ props.i18n.french || '法文' }}</option>
                <option value="de">{{ props.i18n.german || '德文' }}</option>
                <option value="es">{{ props.i18n.spanish || '西班牙文' }}</option>
              </select>
            </div>
          </div>
          <textarea
            v-model="translateText"
            class="translate-textarea"
            :placeholder="props.i18n.enterTextToTranslate || '输入要翻译的文本，2秒后自动翻译...'"
            rows="8"
          ></textarea>
          <div class="input-actions">
            <button class="action-btn-small" @click="clearTranslateInput">
              <svg class="action-icon-small"><use xlink:href="#iconTrashcan"></use></svg>
              {{ props.i18n.clear || '清除' }}
            </button>
            <button class="action-btn-small primary" @click="handleTranslate" :disabled="isTranslating">
              <div class="loading-spinner-small" v-if="isTranslating"></div>
              <svg class="action-icon-small" v-else><use xlink:href="#iconLanguage"></use></svg>
              {{ isTranslating ? (props.i18n.translating || '翻译中...') : (props.i18n.translate || '翻译') }}
            </button>
          </div>
        </div>

        <div class="translate-divider">
          <div class="divider-line"></div>
          <button class="swap-btn" @click="swapLanguages" :title="props.i18n.swapLanguages || '交换语言'">
            <svg class="swap-icon"><use xlink:href="#iconRefresh"></use></svg>
          </button>
          <div class="divider-line"></div>
        </div>

        <div class="translate-output-section">
          <div class="section-header">
            <span class="section-title">{{ props.i18n.translatedText || '译文' }}</span>
            <div class="language-selector">
              <select v-model="targetLanguage" class="language-select">
                <option value="zh">{{ props.i18n.chinese || '中文' }}</option>
                <option value="en">{{ props.i18n.english || '英文' }}</option>
                <option value="ja">{{ props.i18n.japanese || '日文' }}</option>
                <option value="ko">{{ props.i18n.korean || '韩文' }}</option>
                <option value="fr">{{ props.i18n.french || '法文' }}</option>
                <option value="de">{{ props.i18n.german || '德文' }}</option>
                <option value="es">{{ props.i18n.spanish || '西班牙文' }}</option>
              </select>
            </div>
          </div>
          <div class="translate-result" v-if="translateResult">
            <div class="result-text">{{ translateResult }}</div>
          </div>
          <div class="translate-empty" v-else>
            <div class="empty-icon">🌍</div>
            <p>{{ props.i18n.translationWillAppearHere || '翻译结果将显示在这里' }}</p>
          </div>
          <div class="output-actions" v-if="translateResult">
            <button class="action-btn-small" @click="copyTranslation">
              <svg class="action-icon-small"><use xlink:href="#iconCopy"></use></svg>
              {{ props.i18n.copy || '复制' }}
            </button>
            <button class="action-btn-small" @click="exportTranslation">
              <svg class="action-icon-small"><use xlink:href="#iconUpload"></use></svg>
              {{ props.i18n.export || '导出' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { showMessage } from 'siyuan';
import IconWrapper from '@/components/IconWrapper.vue';

// Props
interface Props {
  i18n: any;
  plugin?: any;
  onQuery: (word: string) => Promise<string>;
  onTranslate?: (text: string, sourceLang: string, targetLang: string) => Promise<string>;
}

const props = defineProps<Props>();

// 接口定义
interface HistoryItem {
  word: string;
  result: string;
  timestamp: number;
}

interface FavoriteItem {
  word: string;
  result: string;
  timestamp: number;
  note?: string;
}

interface PanelConfig {
  key: 'history' | 'favorites' | 'advanced';
  title: string;
  icon: string;
  data?: any;
  maxItems?: number;
}

// 常量配置
const PANEL_CONFIGS: Record<string, PanelConfig> = {
  history: {
    key: 'history',
    title: 'queryHistory',
    icon: 'iconHistory',
    data: 'queryHistory',
    maxItems: 50
  },
  favorites: {
    key: 'favorites',
    title: 'myFavorites',
    icon: 'star',
    data: 'favorites'
  },
  advanced: {
    key: 'advanced',
    title: 'advancedOptions',
    icon: 'generalSettings'
  }
};

const LANGUAGE_NAMES: Record<string, string> = {
  'auto': '自动检测',
  'zh': '中文',
  'en': '英文',
  'ja': '日文',
  'ko': '韩文',
  'fr': '法文',
  'de': '德文',
  'es': '西班牙文'
};

// 基础状态
const currentMode = ref<'word' | 'translate'>('word');
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
const queryHistory = ref<HistoryItem[]>([]);
const favorites = ref<FavoriteItem[]>([]);
const currentWordFavorited = ref(false);

// 设置状态
const pronunciationType = ref<'uk' | 'us'>('uk');
const autoPlayPronunciation = ref(false);
const showRelatedWords = ref(true);

// 定时器
const autoQueryTimer = ref<NodeJS.Timeout | null>(null);
const autoTranslateTimer = ref<NodeJS.Timeout | null>(null);

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

// 内容提取配置
const CONTENT_PATTERNS = {
  phonetic: [/音标：[^\n]+/, /拼音：[^\n]+/],
  meaning: [/释义：[^\n]+/],
  english: [/英文：[^\n]+/],
  pronunciation: [/谐音：[^\n]+/],
  example: [/例句：[\s\S]+/]
};

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
      // 添加到历史记录
      await addToHistory(word, result);
      // 延迟检查收藏状态，确保数据已加载
      setTimeout(() => {
        checkIfFavorited(word);
      }, 50);
      // 自动播放发音
      if (autoPlayPronunciation.value) {
        playPronunciation(word);
      }
    } else {
      errorMessage.value = props.i18n.queryFailed || '查询失败,请重试';
    }
  } catch (error) {
    console.error('Query error:', error);
    errorMessage.value = (error as Error).message || props.i18n.unknownError || '未知错误';
  } finally {
    isLoading.value = false;
  }
};

// 数据操作封装
const dataOperations = {
  // 保存数据
  save: async (key: string, data: any) => {
    // 延迟检查 plugin 实例，确保在组件完全初始化后再保存
    const checkAndSave = async (retryCount = 0) => {
      const maxRetries = 10; // 最多重试10次
      const retryDelay = 100; // 每次重试间隔100ms

      if (props.plugin) {
        try {
          console.log(`[WordQuery] Saving ${key}:`, data);
          await props.plugin.saveData(key, data);
          console.log(`[WordQuery] Successfully saved ${key}`);
          return true;
        } catch (error) {
          console.error(`Failed to save ${key}:`, error);
          throw error;
        }
      } else {
        console.warn(`[WordQuery] No plugin instance available for saving ${key}, retrying... (${retryCount + 1}/${maxRetries})`);

        if (retryCount < maxRetries) {
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return checkAndSave(retryCount + 1);
        } else {
          console.error(`[WordQuery] Max retries reached, giving up on saving ${key}`);
          return false;
        }
      }
    };

    return await checkAndSave();
  },

  // 加载数据
  load: async (key: string) => {
    // 延迟检查 plugin 实例
    const checkAndLoad = async (retryCount = 0) => {
      const maxRetries = 10;
      const retryDelay = 100;

      if (props.plugin) {
        try {
          console.log(`[WordQuery] Loading ${key}...`);
          const saved = await props.plugin.loadData(key);
          console.log(`[WordQuery] Loaded ${key}:`, saved);
          return saved;
        } catch (error) {
          console.error(`Failed to load ${key}:`, error);
          return null;
        }
      } else {
        console.warn(`[WordQuery] No plugin instance available for loading ${key}, retrying... (${retryCount + 1}/${maxRetries})`);

        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return checkAndLoad(retryCount + 1);
        } else {
          console.error(`[WordQuery] Max retries reached, giving up on loading ${key}`);
          return null;
        }
      }
    };

    return await checkAndLoad();
  }
};

// 面板操作
const togglePanel = (panelKey: string | null) => {
  activePanel.value = activePanel.value === panelKey ? null : panelKey;
};

// 检查是否已收藏
const checkIfFavorited = (word: string) => {
  currentWordFavorited.value = favorites.value.some(item => item.word === word);
};

// 添加到历史记录
const addToHistory = async (word: string, result: string) => {
  const newItem: HistoryItem = {
    word,
    result,
    timestamp: Date.now()
  };

  // 移除重复项并添加到开头
  queryHistory.value = [
    newItem,
    ...queryHistory.value.filter(item => item.word !== word)
  ].slice(0, PANEL_CONFIGS.history.maxItems);

  // 保存历史记录（不阻塞主要流程）
  try {
    await dataOperations.save('word-query-history', queryHistory.value);
  } catch (error) {
    console.error('[WordQuery] Failed to save history:', error);
    // 不显示错误提示，避免影响用户体验
  }
};

// 加载历史记录
const loadHistory = async () => {
  const saved = await dataOperations.load('word-query-history');
  // 确保数据是数组，否则使用默认值
  if (saved && Array.isArray(saved)) {
    queryHistory.value = saved;
  } else {
    queryHistory.value = [];
  }
};

// 清除历史记录
const clearHistory = async () => {
  queryHistory.value = [];
  try {
    const success = await dataOperations.save('word-query-history', queryHistory.value);
    if (success) {
      showMessage('历史记录已清除', 2000, 'info');
    } else {
      showMessage('清除历史记录失败 - Plugin 未就绪', 2000, 'error');
    }
  } catch (error) {
    showMessage('清除历史记录失败', 2000, 'error');
  }
};

// 从历史记录查询
const queryFromHistory = (item: HistoryItem) => {
  searchWord.value = item.word;
  queryResult.value = item.result;
  checkIfFavorited(item.word);
  activePanel.value = null;
};

// 切换收藏
const toggleFavorite = async () => {
  const word = searchWord.value.trim();
  if (!word || !queryResult.value) {
    showMessage('请先查询单词', 2000, 'info');
    return;
  }

  try {
    if (currentWordFavorited.value) {
      // 取消收藏
      favorites.value = favorites.value.filter(item => item.word !== word);
      currentWordFavorited.value = false;
      showMessage('已取消收藏', 2000, 'info');
    } else {
      // 添加收藏
      const newItem: FavoriteItem = {
        word,
        result: queryResult.value,
        timestamp: Date.now()
      };
      favorites.value.unshift(newItem);
      currentWordFavorited.value = true;
      showMessage('已添加到收藏', 2000, 'info');
    }
    // 立即保存数据
    const success = await dataOperations.save('word-query-favorites', favorites.value);
    if (!success) {
      showMessage('保存收藏失败 - Plugin 未就绪', 2000, 'error');
    }
    console.log('[WordQuery] Favorites updated:', favorites.value);
  } catch (error) {
    console.error('[WordQuery] Failed to toggle favorite:', error);
    showMessage('保存收藏失败', 2000, 'error');
  }
};

// 加载收藏
const loadFavorites = async () => {
  const saved = await dataOperations.load('word-query-favorites');
  // 确保数据是数组，否则使用默认值
  if (saved && Array.isArray(saved)) {
    favorites.value = saved;
    console.log('[WordQuery] Loaded favorites:', favorites.value);
  } else {
    favorites.value = [];
    console.log('[WordQuery] No favorites found, initialized empty array');
  }
};

// 清除收藏
const clearFavorites = async () => {
  favorites.value = [];
  try {
    const success = await dataOperations.save('word-query-favorites', favorites.value);
    if (success) {
      showMessage('收藏已清除', 2000, 'info');
    } else {
      showMessage('清除收藏失败 - Plugin 未就绪', 2000, 'error');
    }
  } catch (error) {
    console.error('[WordQuery] Failed to clear favorites:', error);
    showMessage('清除收藏失败', 2000, 'error');
  }
};

// 从收藏查询
const queryFromFavorite = (item: FavoriteItem) => {
  searchWord.value = item.word;
  queryResult.value = item.result;
  currentWordFavorited.value = true;
  activePanel.value = null;
};

// 删除收藏项
const removeFavorite = async (word: string) => {
  favorites.value = favorites.value.filter(item => item.word !== word);
  try {
    const success = await dataOperations.save('word-query-favorites', favorites.value);
    if (searchWord.value === word) {
      currentWordFavorited.value = false;
    }
    if (success) {
      showMessage('已删除', 2000, 'info');
    } else {
      showMessage('删除失败 - Plugin 未就绪', 2000, 'error');
    }
  } catch (error) {
    console.error('[WordQuery] Failed to remove favorite:', error);
    showMessage('删除失败', 2000, 'error');
  }
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

  try {
    const word = searchWord.value.trim();
    const content = `## ${word}\n\n${queryResult.value}`;

    // 复制到剪贴板
    await navigator.clipboard.writeText(content);
    showMessage('已复制到剪贴板，可直接粘贴到文档', 3000, 'info');
  } catch (error) {
    console.error('Export failed:', error);
    showMessage('导出失败', 2000, 'error');
  }
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
    await dataOperations.save('word-query-options', advancedOptionsData.value);
    console.log('[WordQuery] Advanced options saved:', advancedOptionsData.value);
  } catch (error) {
    console.error('[WordQuery] Failed to save advanced options:', error);
  }
};

// 加载高级选项
const loadAdvancedOptions = async () => {
  const saved = await dataOperations.load('word-query-options');
  if (saved && typeof saved === 'object') {
    pronunciationType.value = saved.pronunciationType || 'uk';
    autoPlayPronunciation.value = saved.autoPlayPronunciation ?? false;
    showRelatedWords.value = saved.showRelatedWords ?? true;
    console.log('[WordQuery] Loaded advanced options:', {
      pronunciationType: pronunciationType.value,
      autoPlayPronunciation: autoPlayPronunciation.value,
      showRelatedWords: showRelatedWords.value
    });
  } else {
    // 使用默认值
    pronunciationType.value = 'uk';
    autoPlayPronunciation.value = false;
    showRelatedWords.value = true;
    console.log('[WordQuery] No advanced options found, using defaults');
  }
};

// 格式化时间
const formatTime = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString();
};

// 自动操作配置
const AUTO_OPERATION_DELAY = 2000;
const WORD_PATTERN = /^[a-zA-Z0-9\s\-.,;:!?'"()（）【】《》《""''\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF]+$/;

// 清除定时器
const clearTimer = (timerRef: 'autoQueryTimer' | 'autoTranslateTimer') => {
  if (autoQueryTimer.value || autoTranslateTimer.value) {
    const timer = timerRef === 'autoQueryTimer' ? autoQueryTimer.value : autoTranslateTimer.value;
    if (timer) {
      clearTimeout(timer);
      if (timerRef === 'autoQueryTimer') {
        autoQueryTimer.value = null;
      } else {
        autoTranslateTimer.value = null;
      }
    }
  }
};

// 自动查询函数
const setupAutoQuery = () => {
  clearTimer('autoQueryTimer');

  const word = searchWord.value.trim();
  if (word && WORD_PATTERN.test(word)) {
    autoQueryTimer.value = setTimeout(() => {
      handleQuery();
    }, AUTO_OPERATION_DELAY);
  }
};

// 自动翻译函数
const setupAutoTranslate = () => {
  clearTimer('autoTranslateTimer');

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

// 复制类型配置
const COPY_TYPES = {
  all: '全部',
  phonetic: '音标',
  meaning: '释义',
  english: '英文',
  pronunciation: '谐音',
  example: '例句'
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

  try {
    await navigator.clipboard.writeText(textToCopy);
    const typeText = COPY_TYPES[type as keyof typeof COPY_TYPES] || '';
    showMessage(`已复制${typeText}到剪贴板`, 2000, 'info');
    showCopyOptions.value = false;
  } catch (error) {
    console.error('Copy failed:', error);
    showMessage(props.i18n.copyFailed || '复制失败', 3000, 'error');
  }
};

// 清除结果
const clearResult = () => {
  queryResult.value = '';
  errorMessage.value = '';
};

// 切换模式
const switchMode = (mode: 'word' | 'translate') => {
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
    showMessage('✓ 翻译完成', 2000, 'info');
  } catch (error) {
    console.error('Translation error:', error);
    showMessage('翻译失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    isTranslating.value = false;
  }
};

// 获取面板图标
const getPanelIcon = (panel: string) => {
  const icons: Record<string, string> = {
    history: '🕒',
    favorites: '⭐',
    advanced: '⚙️'
  };
  return icons[panel] || '';
};

// 获取面板标题
const getPanelTitle = (panel: string) => {
  const titles: Record<string, () => string> = {
    history: () => `${props.i18n.queryHistory || '查询历史'} (${queryHistory.value.length})`,
    favorites: () => `${props.i18n.myFavorites || '我的收藏'} (${favorites.value.length})`,
    advanced: () => props.i18n.advancedOptions || '高级选项'
  };
  return titles[panel]?.() || '';
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

// 复制翻译结果
const copyTranslation = async () => {
  if (!translateResult.value) {
    showMessage('没有可复制的内容', 2000, 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(translateResult.value);
    showMessage('已复制到剪贴板', 2000, 'info');
  } catch (error) {
    console.error('Copy failed:', error);
    showMessage('复制失败', 2000, 'error');
  }
};

// 导出翻译结果
const exportTranslation = async () => {
  if (!translateResult.value) {
    showMessage('没有可导出的内容', 2000, 'error');
    return;
  }

  try {
    const content = `## 翻译结果\n\n### 原文 (${getLanguageName(sourceLanguage.value)})\n${translateText.value}\n\n### 译文 (${getLanguageName(targetLanguage.value)})\n${translateResult.value}`;
    await navigator.clipboard.writeText(content);
    showMessage('已复制到剪贴板，可直接粘贴到文档', 3000, 'info');
  } catch (error) {
    console.error('Export failed:', error);
    showMessage('导出失败', 2000, 'error');
  }
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

// 监听搜索词变化，自动设置定时器
watch(searchWord, () => {
  setupAutoQuery();
});

// 监听翻译文本变化，自动设置定时器
watch(translateText, () => {
  setupAutoTranslate();
});

// 监听高级选项变化
watch([pronunciationType, autoPlayPronunciation, showRelatedWords], async () => {
  await saveAdvancedOptions();
});

// 等待 plugin 实例准备就绪
const waitForPlugin = async (maxRetries = 20) => {
  for (let i = 0; i < maxRetries; i++) {
    if (props.plugin) {
      console.log('[WordQuery] Plugin instance ready');
      return true;
    }
    console.log(`[WordQuery] Waiting for plugin instance... (${i + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.error('[WordQuery] Plugin instance not available after max retries');
  return false;
};

// 初始化数据
const initializeData = async () => {
  // 等待 plugin 实例准备就绪
  const pluginReady = await waitForPlugin();
  if (!pluginReady) {
    console.error('[WordQuery] Cannot initialize data without plugin instance');
    return;
  }

  // 批量加载数据
  try {
    await Promise.all([
      loadHistory(),
      loadFavorites(),
      loadAdvancedOptions()
    ]);
    console.log('[WordQuery] All data loaded successfully');
  } catch (error) {
    console.error('[WordQuery] Failed to load data:', error);
  }
};

onMounted(async () => {
  console.log('[WordQuery] Component mounted, initializing...');
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleClickOutside);

  // 延迟初始化数据，确保 plugin 实例已准备
  setTimeout(() => {
    initializeData();
  }, 100);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('click', handleClickOutside);

  // 清理所有定时器
  clearTimer('autoQueryTimer');
  clearTimer('autoTranslateTimer');
  console.log('[WordQuery] Component unmounted');
});

// 强制刷新当前单词的收藏状态
const refreshFavoriteStatus = () => {
  const word = searchWord.value.trim();
  if (word) {
    checkIfFavorited(word);
  }
};

// 监听搜索词变化，刷新收藏状态
watch(searchWord, () => {
  setupAutoQuery();
  // 延迟检查收藏状态，确保数据已加载
  setTimeout(() => {
    refreshFavoriteStatus();
  }, 100);
});
</script>

<style scoped>
/* GitHub Design System Variables - Adaptive to SiYuan Theme */
:root {
  /* Light mode defaults */
  --gh-primary: #0969da;
  --gh-success: #1a7f37;
  --gh-danger: #cf222e;
  --gh-warning: #9a6700;
  --gh-border: #d0d7de;
  --gh-border-light: #f6f8fa;
  --gh-bg-default: #ffffff;
  --gh-bg-overlay: #f6f8fa;
  --gh-bg-muted: #f6f8fa;
  --gh-fg-default: #24292f;
  --gh-fg-muted: #656d76;
  --gh-fg-subtle: #6e7781;
  --gh-control-border-radius: 6px;
}

/* Dark mode adaptation using SiYuan's theme variables */
@media (prefers-color-scheme: dark) {
  :root {
    --gh-primary: #58a6ff;
    --gh-success: #3fb950;
    --gh-danger: #f85149;
    --gh-warning: #d29922;
    --gh-border: #30363d;
    --gh-border-light: #21262d;
    --gh-bg-default: var(--b3-theme-background, #0d1117);
    --gh-bg-overlay: var(--b3-theme-surface, #161b22);
    --gh-bg-muted: var(--b3-theme-surface-light, #21262d);
    --gh-fg-default: var(--b3-theme-on-background, #f0f6fc);
    --gh-fg-muted: var(--b3-theme-on-surface, #8b949e);
    --gh-fg-subtle: #484f58;
  }
}

.word-query-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 200px;
  max-height: 100vh;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  overflow: hidden;
}

.query-header {
  padding: 16px;
  border-bottom: 1px solid var(--gh-border);
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--gh-bg-default);
  gap: 16px;
}

.mode-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--gh-border);
  padding: 0;
}

.mode-tab {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--gh-fg-muted);
  transition: all 0.2s ease;
  white-space: nowrap;
  position: relative;
}

.mode-tab:hover {
  color: var(--gh-fg-default);
  background: transparent;
}

.mode-tab.active {
  color: var(--gh-primary);
  border-bottom-color: var(--gh-primary);
  background: transparent;
}

.mode-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--gh-bg-default);
}

.input-section {
  padding: 16px;
  border-bottom: 1px solid var(--gh-border);
  flex-shrink: 0;
}

.input-wrapper {
  display: flex;
  gap: 8px;
  width: 100%;
}

.query-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-control-border-radius);
  background: var(--gh-bg-default);
  color: var(--gh-fg-default);
  outline: none;
  transition: border-color 0.2s ease;
  min-width: 0;
  font-size: 14px;
  font-family: inherit;
}

.query-input:hover {
  border-color: var(--gh-fg-muted);
}

.query-input:focus {
  border-color: var(--gh-primary);
  box-shadow: inset 0 1px 0 rgba(208, 215, 222, 0.2);
}

.query-input::placeholder {
  color: var(--gh-fg-muted);
}

.query-btn {
  padding: 6px 16px;
  background: var(--gh-primary);
  color: #ffffff;
  border: 1px solid var(--gh-primary);
  border-radius: var(--gh-control-border-radius);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease, border-color 0.2s ease;
  flex-shrink: 0;
  font-weight: 500;
  font-size: 14px;
}

.query-btn:hover:not(:disabled) {
  background-color: #0550ae;
  border-color: #0550ae;
}

.query-btn:active:not(:disabled) {
  background-color: #033d8a;
  border-color: #033d8a;
}

.query-btn:disabled {
  background-color: var(--gh-bg-muted);
  color: var(--gh-fg-muted);
  border-color: var(--gh-border);
  cursor: not-allowed;
}

.query-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.query-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
}

.query-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--gh-fg-default);
}

.loading-spinner-large {
  width: 32px;
  height: 32px;
  border: 2px solid var(--gh-border);
  border-top: 2px solid var(--gh-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.query-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--gh-danger);
  text-align: center;
}

.query-result {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.result-content {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
  padding: 16px;
  background: var(--gh-bg-default);
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-control-border-radius);
  min-height: 100px;
  max-height: 300px;
  word-wrap: break-word;
}

.result-title {
  margin: 0 0 16px 0;
  color: var(--gh-fg-default);
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--gh-border);
  word-wrap: break-word;
}

.result-label {
  display: inline-block;
  font-weight: 600;
  color: var(--gh-fg-default);
  margin-right: 8px;
  min-width: 60px;
}

.result-content br {
  display: block;
  margin-bottom: 12px;
  content: "";
}

.result-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.action-btn {
  padding: 5px 12px;
  background: var(--gh-bg-overlay);
  color: var(--gh-fg-default);
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-control-border-radius);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s ease, border-color 0.2s ease;
  min-width: 0;
  white-space: nowrap;
  font-weight: 500;
  font-size: 12px;
}

.action-btn:hover {
  background-color: var(--gh-bg-muted);
  border-color: var(--gh-fg-muted);
}

.action-btn:active {
  transform: none;
  background-color: var(--gh-bg-overlay);
}

.copy-btn {
  background-color: var(--gh-success);
  color: #ffffff;
  border-color: var(--gh-success);
}

.copy-btn:hover {
  background-color: #1a7f37cc;
  border-color: #1a7f37cc;
}

.clear-btn {
  background-color: var(--gh-danger);
  color: #ffffff;
  border-color: var(--gh-danger);
}

.clear-btn:hover {
  background-color: #cf222ecc;
  border-color: #cf222ecc;
}

.action-icon {
  width: 16px;
  height: 16px;
}

.dropdown-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.2s ease;
}

.dropdown.active .dropdown-icon {
  transform: rotate(180deg);
}

.dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  background: var(--gh-bg-default);
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-control-border-radius);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 140px;
  max-width: 200px;
  padding: 4px;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: none;
  border: none;
  color: var(--gh-fg-default);
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-radius: var(--gh-control-border-radius);
  font-size: 13px;
  font-weight: 400;
}

.dropdown-item:hover {
  background-color: var(--gh-bg-overlay);
  color: var(--gh-fg-default);
  transform: none;
}

.dropdown-item:first-child {
  border-radius: var(--gh-control-border-radius);
}

.dropdown-item:last-child {
  border-radius: var(--gh-control-border-radius);
}

.query-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--gh-fg-muted);
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--gh-border);
  border-top: 2px solid var(--gh-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 查询结果内容分组样式 */
.result-wrapper {
  padding: 16px 0;
}

.result-section {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--gh-bg-default);
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-control-border-radius);
  border-left: 3px solid var(--gh-primary);
  transition: all 0.2s ease;
  line-height: 1.5;
  font-size: 14px;
}

.result-section:hover {
  border-color: var(--gh-fg-muted);
}

.result-section:last-child {
  margin-bottom: 0;
}

.result-section strong {
  color: var(--gh-fg-default);
  font-weight: 600;
}

/* 不同内容类型的样式 */
.word-section {
  border-left-color: var(--gh-primary);
}

.phonetic-section {
  border-left-color: var(--gh-primary);
}

.phonetic-section .result-label {
  color: var(--gh-primary);
}

.english-section {
  border-left-color: var(--gh-success);
}

.english-section .result-label {
  color: var(--gh-success);
}

.meaning-section {
  border-left-color: var(--gh-warning);
}

.meaning-section .result-label {
  color: var(--gh-warning);
}

.pronunciation-section {
  border-left-color: #8250df;
}

.pronunciation-section .result-label {
  color: #8250df;
}

.tip-section {
  border-left-color: var(--gh-primary);
}

.tip-section .result-label {
  color: var(--gh-primary);
}

.example-section {
  border-left-color: var(--gh-fg-muted);
}

.example-section .result-label {
  color: var(--gh-fg-muted);
}

/* 面板通用样式 */
.common-panel {
  border-bottom: 1px solid var(--gh-border);
  background: var(--gh-bg-overlay);
  animation: slideDown 0.2s ease-out;
  max-width: 100%;
  overflow: hidden;
  max-height: 300px;
}

.history-panel,
.favorites-panel,
.advanced-panel {
  /* 保持向后兼容 */
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
  font-size: 14px;
  color: var(--gh-fg-default);
  background: var(--gh-bg-default);
  border-bottom: 1px solid var(--gh-border);
}

.panel-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-clear {
  padding: 4px 12px;
  background: var(--gh-danger);
  color: #ffffff;
  border: 1px solid var(--gh-danger);
  border-radius: var(--gh-control-border-radius);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.btn-clear:hover {
  background-color: #cf222ecc;
}

.panel-content {
  padding: 8px;
  max-height: 240px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--gh-fg-muted);
  font-size: 14px;
}

/* 通用列表样式 */
.item-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--gh-bg-default);
  border-radius: var(--gh-control-border-radius);
  border: 1px solid var(--gh-border);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.list-item:hover {
  background-color: var(--gh-bg-overlay);
  border-color: var(--gh-fg-muted);
}

.item-word {
  font-weight: 500;
  font-size: 14px;
  color: var(--gh-fg-default);
}

.item-time {
  font-size: 12px;
  color: var(--gh-fg-muted);
}

/* 收藏项特殊样式 */
.favorite-item .item-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.favorite-item .item-content:hover .item-word {
  color: var(--gh-primary);
}

.btn-remove {
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: var(--gh-danger);
  cursor: pointer;
  border-radius: var(--gh-control-border-radius);
  transition: background-color 0.2s ease, color 0.2s ease;
  margin-left: 8px;
}

.btn-remove:hover {
  background-color: var(--gh-danger);
  color: #ffffff;
}

.remove-icon {
  width: 14px;
  height: 14px;
}

/* 高级选项样式 */
.advanced-content {
  padding: 16px;
}

.option-group {
  margin-bottom: 16px;
}

.option-group:last-child {
  margin-bottom: 0;
}

.option-label {
  display: block;
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--gh-fg-default);
}

.option-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.radio-label,
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--gh-fg-default);
  cursor: pointer;
  padding: 8px;
  border-radius: var(--gh-control-border-radius);
  transition: background-color 0.2s ease;
}

.radio-label:hover,
.checkbox-label:hover {
  background-color: var(--gh-bg-overlay);
}

.radio-label input[type="radio"],
.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* 操作按钮样式优化 */
.favorite-btn {
  background-color: #fb8500;
  color: #ffffff;
  border-color: #fb8500;
}

.favorite-btn:hover {
  background-color: #e67700;
  border-color: #e67700;
}

.favorite-btn.favorited {
  background-color: #ea580c;
  border-color: #ea580c;
}

.play-btn {
  background-color: var(--gh-primary);
  color: #ffffff;
  border-color: var(--gh-primary);
}

.play-btn:hover {
  background-color: #0550ae;
  border-color: #0550ae;
}

.export-btn {
  background-color: #8250df;
  color: #ffffff;
  border-color: #8250df;
}

.export-btn:hover {
  background-color: #6e40c9;
  border-color: #6e40c9;
}

/* 工具栏按钮布局 */
.api-key-toggle {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.settings-btn {
  padding: 8px;
  background: transparent;
  border: none;
  color: var(--gh-fg-muted);
  cursor: pointer;
  border-radius: var(--gh-control-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease, color 0.2s ease;
  flex-shrink: 0;
}

.settings-btn:hover {
  background-color: var(--gh-bg-overlay);
  color: var(--gh-fg-default);
}

.settings-icon {
  width: 16px;
  height: 16px;
}

.close-btn {
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--gh-fg-muted);
  cursor: pointer;
  border-radius: var(--gh-control-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background-color: var(--gh-danger);
  color: #ffffff;
}

.close-icon {
  width: 16px;
  height: 16px;
}

/* 响应式设计 */
@media (max-width: 400px) {
  .query-header {
    padding: 12px;
    gap: 12px;
  }

  .mode-tab {
    padding: 6px 12px;
    font-size: 12px;
  }

  .query-input {
    padding: 6px 8px;
    font-size: 12px;
  }

  .query-btn {
    padding: 6px 12px;
    font-size: 12px;
  }

  .query-content {
    padding: 12px;
  }

  .result-content {
    padding: 12px;
    margin-bottom: 12px;
  }

  .result-actions {
    gap: 6px;
  }

  .action-btn {
    padding: 4px 8px;
    font-size: 11px;
    gap: 4px;
  }

  .dropdown-menu {
    min-width: 120px;
  }

  .dropdown-item {
    padding: 6px 8px;
    font-size: 11px;
  }
}

@media (max-width: 320px) {
  .query-header {
    padding: 8px;
  }

  .query-input {
    padding: 4px 6px;
    font-size: 11px;
  }

  .query-btn {
    padding: 4px 8px;
    font-size: 11px;
  }

  .result-content {
    padding: 8px;
  }

  .action-btn {
    padding: 3px 6px;
    font-size: 10px;
  }
}

@media (max-height: 500px) {
  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  .loading-spinner-large {
    width: 24px;
    height: 24px;
    margin-bottom: 12px;
  }

  .result-content {
    padding: 12px;
    margin-bottom: 8px;
  }
}

/* 翻译模式样式 */
.translate-mode {
  padding: 16px;
}

.translate-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
}

.translate-input-section,
.translate-output-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--gh-border);
}

.section-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--gh-fg-default);
}

.language-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.language-select {
  padding: 4px 8px;
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-control-border-radius);
  background: var(--gh-bg-default);
  color: var(--gh-fg-default);
  font-size: 12px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s ease;
  font-family: inherit;
}

.language-select:hover {
  border-color: var(--gh-fg-muted);
}

.language-select:focus {
  border-color: var(--gh-primary);
  box-shadow: inset 0 1px 0 rgba(208, 215, 222, 0.2);
}

.translate-textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-control-border-radius);
  background: var(--gh-bg-default);
  color: var(--gh-fg-default);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: border-color 0.2s ease;
  font-family: inherit;
  min-height: 120px;
}

.translate-textarea:hover {
  border-color: var(--gh-fg-muted);
}

.translate-textarea:focus {
  border-color: var(--gh-primary);
  box-shadow: inset 0 1px 0 rgba(208, 215, 222, 0.2);
}

.translate-textarea::placeholder {
  color: var(--gh-fg-muted);
}

.input-actions,
.output-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  justify-content: flex-end;
}

.action-btn-small {
  padding: 5px 12px;
  background: var(--gh-bg-overlay);
  color: var(--gh-fg-default);
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-control-border-radius);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s ease;
  font-size: 12px;
  font-weight: 500;
}

.action-btn-small:hover {
  background-color: var(--gh-bg-muted);
}

.action-btn-small.primary {
  background-color: var(--gh-primary);
  color: #ffffff;
  border-color: var(--gh-primary);
}

.action-btn-small.primary:hover {
  background-color: #0550ae;
  border-color: #0550ae;
}

.action-btn-small:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-icon-small {
  width: 14px;
  height: 14px;
}

.loading-spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid var(--gh-border);
  border-top: 2px solid #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.translate-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--gh-border);
}

.swap-btn {
  padding: 8px;
  background: var(--gh-bg-default);
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-control-border-radius);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.swap-btn:hover {
  background-color: var(--gh-bg-overlay);
  border-color: var(--gh-fg-muted);
}

.swap-btn:hover .swap-icon {
  color: var(--gh-fg-default);
}

.swap-icon {
  width: 16px;
  height: 16px;
  color: var(--gh-fg-muted);
  transition: color 0.2s ease;
}

.translate-result {
  flex: 1;
  padding: 12px;
  background: var(--gh-bg-default);
  border: 1px solid var(--gh-border);
  border-radius: var(--gh-control-border-radius);
  overflow-y: auto;
  min-height: 120px;
}

.result-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--gh-fg-default);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.translate-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--gh-fg-muted);
  min-height: 120px;
}

.translate-empty .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

@media (max-width: 400px) {
  .mode-tabs {
    gap: 4px;
  }

  .mode-tab {
    padding: 6px 12px;
    font-size: 12px;
  }

  .translate-container {
    gap: 12px;
  }

  .translate-textarea {
    min-height: 100px;
    padding: 10px;
    font-size: 12px;
  }

  .translate-result {
    min-height: 100px;
    padding: 10px;
  }

  .result-text {
    font-size: 12px;
  }
}
</style>
