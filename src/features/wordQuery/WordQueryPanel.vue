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
          📖 {{ i18n.wordQuery || '单词查询' }}
        </button>
        <button
          class="mode-tab"
          :class="{ active: currentMode === 'translate' }"
          @click="switchMode('translate')"
        >
          🌐 {{ i18n.translation || '长文翻译' }}
        </button>
      </div>

      <div class="api-key-toggle">
        <button class="settings-btn" @click="toggleHistory" :title="i18n.history || '历史记录'">
          <svg class="settings-icon"><use xlink:href="#iconHistory"></use></svg>
        </button>
        <button class="settings-btn" @click="toggleFavorites" :title="i18n.favorites || '我的收藏'">
          <IconWrapper name="star" :size="18" />
        </button>
        <button class="settings-btn" @click="toggleAdvancedOptions" :title="i18n.advancedOptions || '高级选项'">
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
            :placeholder="i18n.enterWordPlaceholder || '输入单词或词语，2秒后自动查询...'"
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

    <!-- 历史记录面板 -->
    <div class="history-panel" v-if="showHistory">
      <div class="panel-header">
        <span>🕒 {{ i18n.queryHistory || '查询历史' }} ({{ queryHistory.length }})</span>
        <div class="panel-actions">
          <button class="btn-clear" @click="clearHistory" v-if="queryHistory.length > 0">清除</button>
          <button class="close-btn" @click="toggleHistory">
            <svg class="close-icon"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
      </div>
      <div class="panel-content">
        <div v-if="queryHistory.length === 0" class="empty-state">
          <p>📑 {{ i18n.noHistory || '暂无查询历史' }}</p>
        </div>
        <div v-else class="history-list">
          <div
            v-for="item in queryHistory"
            :key="item.timestamp"
            class="history-item"
            @click="queryFromHistory(item)"
          >
            <div class="item-word">{{ item.word }}</div>
            <div class="item-time">{{ formatTime(item.timestamp) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 收藏面板 -->
    <div class="favorites-panel" v-if="showFavorites">
      <div class="panel-header">
        <span>⭐ {{ i18n.myFavorites || '我的收藏' }} ({{ favorites.length }})</span>
        <div class="panel-actions">
          <button class="btn-clear" @click="clearFavorites" v-if="favorites.length > 0">清除</button>
          <button class="close-btn" @click="toggleFavorites">
            <svg class="close-icon"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
      </div>
      <div class="panel-content">
        <div v-if="favorites.length === 0" class="empty-state">
          <p>📚 {{ i18n.noFavorites || '暂无收藏单词' }}</p>
        </div>
        <div v-else class="favorites-list">
          <div
            v-for="item in favorites"
            :key="item.timestamp"
            class="favorite-item"
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
    </div>

    <!-- 高级选项面板 -->
    <div class="advanced-panel" v-if="showAdvancedOptions">
      <div class="panel-header">
        <span>⚙️ {{ i18n.advancedOptions || '高级选项' }}</span>
        <button class="close-btn" @click="toggleAdvancedOptions">
          <svg class="close-icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="panel-content advanced-content">
        <div class="option-group">
          <label class="option-label">
            <span>🔊 {{ i18n.pronunciation || '发音设置' }}</span>
          </label>
          <div class="option-row">
            <label class="radio-label">
              <input type="radio" value="uk" v-model="pronunciationType" />
              <span>🇬🇧 {{ i18n.britishPronunciation || '英式发音' }}</span>
            </label>
            <label class="radio-label">
              <input type="radio" value="us" v-model="pronunciationType" />
              <span>🇺🇸 {{ i18n.americanPronunciation || '美式发音' }}</span>
            </label>
          </div>
        </div>

        <div class="option-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="autoPlayPronunciation" />
            <span>🎵 {{ i18n.autoPlayPronunciation || '查询后自动播放发音' }}</span>
          </label>
        </div>

        <div class="option-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="showRelatedWords" />
            <span>🔗 {{ i18n.showRelatedWords || '显示相关词推荐' }}</span>
          </label>
        </div>
      </div>
    </div>

      <!-- 查询结果 -->
      <div class="query-content">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="query-loading">
        <div class="loading-spinner-large"></div>
        <p>{{ i18n.querying || '正在查询...' }}</p>
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
              {{ i18n.copy || '复制' }}
              <svg class="dropdown-icon"><use xlink:href="#iconDown"></use></svg>
            </button>
            <div class="dropdown-menu" v-show="showCopyOptions">
              <button class="dropdown-item" @click="copyResult('all')">
                {{ i18n.copyAll || '复制全部' }}
              </button>
              <button class="dropdown-item" @click="copyResult('phonetic')">
                {{ i18n.copyPhonetic || '复制音标' }}
              </button>
              <button class="dropdown-item" @click="copyResult('meaning')">
                {{ i18n.copyMeaning || '复制释义' }}
              </button>
              <button class="dropdown-item" @click="copyResult('english')" v-if="extractContentParts.english">
                {{ i18n.copyEnglish || '复制英文' }}
              </button>
              <button class="dropdown-item" @click="copyResult('pronunciation')">
                {{ i18n.copyPronunciation || '复制谐音' }}
              </button>
              <button class="dropdown-item" @click="copyResult('example')">
                {{ i18n.copyExample || '复制例句' }}
              </button>
            </div>
          </div>

          <!-- 收藏按钮 -->
          <button class="action-btn favorite-btn" @click="toggleFavorite" :class="{ favorited: currentWordFavorited }">
            <IconWrapper :name="currentWordFavorited ? 'star' : 'starOutline'" :size="16" class="action-icon" />
            {{ currentWordFavorited ? (i18n.unfavorite || '取消收藏') : (i18n.favorite || '收藏') }}
          </button>

          <!-- 播放发音按钮 -->
          <button class="action-btn play-btn" @click="playPronunciation(searchWord)">
            <svg class="action-icon"><use xlink:href="#iconPlay"></use></svg>
            {{ i18n.play || '播放' }}
          </button>

          <!-- 导出按钮 -->
          <button class="action-btn export-btn" @click="exportToSiyuan">
            <svg class="action-icon"><use xlink:href="#iconUpload"></use></svg>
            {{ i18n.export || '导出' }}
          </button>

          <button class="action-btn clear-btn" @click="clearResult">
            <svg class="action-icon"><use xlink:href="#iconTrashcan"></use></svg>
            {{ i18n.clear || '清除' }}
          </button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="query-empty">
        <div class="empty-icon">📚</div>
        <p>{{ i18n.enterWordHint || '输入中英文单词或词语查询释义、音标、谐音等信息' }}</p>
      </div>
      </div>
    </div>

    <!-- 翻译模式 -->
    <div v-else class="mode-content translate-mode">
      <div class="translate-container">
        <div class="translate-input-section">
          <div class="section-header">
            <span class="section-title">{{ i18n.sourceText || '原文' }}</span>
            <div class="language-selector">
              <select v-model="sourceLanguage" class="language-select">
                <option value="auto">{{ i18n.autoDetect || '自动检测' }}</option>
                <option value="zh">{{ i18n.chinese || '中文' }}</option>
                <option value="en">{{ i18n.english || '英文' }}</option>
                <option value="ja">{{ i18n.japanese || '日文' }}</option>
                <option value="ko">{{ i18n.korean || '韩文' }}</option>
                <option value="fr">{{ i18n.french || '法文' }}</option>
                <option value="de">{{ i18n.german || '德文' }}</option>
                <option value="es">{{ i18n.spanish || '西班牙文' }}</option>
              </select>
            </div>
          </div>
          <textarea
            v-model="translateText"
            class="translate-textarea"
            :placeholder="i18n.enterTextToTranslate || '输入要翻译的文本，2秒后自动翻译...'"
            rows="8"
          ></textarea>
          <div class="input-actions">
            <button class="action-btn-small" @click="clearTranslateInput">
              <svg class="action-icon-small"><use xlink:href="#iconTrashcan"></use></svg>
              {{ i18n.clear || '清除' }}
            </button>
            <button class="action-btn-small primary" @click="handleTranslate" :disabled="isTranslating">
              <div class="loading-spinner-small" v-if="isTranslating"></div>
              <svg class="action-icon-small" v-else><use xlink:href="#iconLanguage"></use></svg>
              {{ isTranslating ? (i18n.translating || '翻译中...') : (i18n.translate || '翻译') }}
            </button>
          </div>
        </div>

        <div class="translate-divider">
          <div class="divider-line"></div>
          <button class="swap-btn" @click="swapLanguages" :title="i18n.swapLanguages || '交换语言'">
            <svg class="swap-icon"><use xlink:href="#iconRefresh"></use></svg>
          </button>
          <div class="divider-line"></div>
        </div>

        <div class="translate-output-section">
          <div class="section-header">
            <span class="section-title">{{ i18n.translatedText || '译文' }}</span>
            <div class="language-selector">
              <select v-model="targetLanguage" class="language-select">
                <option value="zh">{{ i18n.chinese || '中文' }}</option>
                <option value="en">{{ i18n.english || '英文' }}</option>
                <option value="ja">{{ i18n.japanese || '日文' }}</option>
                <option value="ko">{{ i18n.korean || '韩文' }}</option>
                <option value="fr">{{ i18n.french || '法文' }}</option>
                <option value="de">{{ i18n.german || '德文' }}</option>
                <option value="es">{{ i18n.spanish || '西班牙文' }}</option>
              </select>
            </div>
          </div>
          <div class="translate-result" v-if="translateResult">
            <div class="result-text">{{ translateResult }}</div>
          </div>
          <div class="translate-empty" v-else>
            <div class="empty-icon">🌍</div>
            <p>{{ i18n.translationWillAppearHere || '翻译结果将显示在这里' }}</p>
          </div>
          <div class="output-actions" v-if="translateResult">
            <button class="action-btn-small" @click="copyTranslation">
              <svg class="action-icon-small"><use xlink:href="#iconCopy"></use></svg>
              {{ i18n.copy || '复制' }}
            </button>
            <button class="action-btn-small" @click="exportTranslation">
              <svg class="action-icon-small"><use xlink:href="#iconUpload"></use></svg>
              {{ i18n.export || '导出' }}
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

// 历史记录接口
interface HistoryItem {
  word: string;
  result: string;
  timestamp: number;
}

// 收藏项接口
interface FavoriteItem {
  word: string;
  result: string;
  timestamp: number;
  note?: string;
}

// 状态
const currentMode = ref<'word' | 'translate'>('word');
const searchWord = ref('');
const queryResult = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const showCopyOptions = ref(false);
const autoQueryTimer = ref<NodeJS.Timeout | null>(null);

// 翻译模式状态
const translateText = ref('');
const translateResult = ref('');
const isTranslating = ref(false);
const sourceLanguage = ref('auto');
const targetLanguage = ref('zh');
const autoTranslateTimer = ref<NodeJS.Timeout | null>(null);

// 新增功能状态
const showHistory = ref(false);
const showFavorites = ref(false);
const showAdvancedOptions = ref(false);
const queryHistory = ref<HistoryItem[]>([]);
const favorites = ref<FavoriteItem[]>([]);
const currentWordFavorited = ref(false);
const pronunciationType = ref<'uk' | 'us'>('uk'); // 英式/美式发音
const autoPlayPronunciation = ref(false); // 自动播放发音
const showRelatedWords = ref(true); // 显示相关词
const maxHistoryItems = ref(50); // 历史记录最大条数

// 格式化查询结果
const formattedResult = computed(() => {
  if (!queryResult.value) return '';

  // 简单的 Markdown 格式转换
  let html = queryResult.value;

  // 转换标题 #### 为 h4
  html = html.replace(/^#### (.+)$/gm, '<h4 class="result-title">$1</h4>');

  // 转换换行为段落
  html = html.replace(/\n/g, '<br>');

  // 为每个字段创建单独的区块，并添加特定样式类
  html = html.replace(/<br>(单词|词语)：/g, '</div><div class="result-section word-section"><span class="result-label">$1：</span>');
  html = html.replace(/<br>(拼音|音标)：/g, '</div><div class="result-section phonetic-section"><span class="result-label">$1：</span>');
  html = html.replace(/<br>(英文)：/g, '</div><div class="result-section english-section"><span class="result-label">$1：</span>');
  html = html.replace(/<br>(释义)：/g, '</div><div class="result-section meaning-section"><span class="result-label">$1：</span>');
  html = html.replace(/<br>(谐音)：/g, '</div><div class="result-section pronunciation-section"><span class="result-label">$1：</span>');
  html = html.replace(/<br>(发音)：/g, '</div><div class="result-section tip-section"><span class="result-label">$1：</span>');
  html = html.replace(/<br>(例句)：/g, '</div><div class="result-section example-section"><span class="result-label">$1：</span>');

  // 为第一个字段添加开始div
  const firstMatch = html.match(/^(单词|词语|拼音|音标|英文|释义|谐音|发音|例句)：/);
  if (firstMatch) {
    const fieldType = firstMatch[1];
    let sectionClass = 'result-section';

    switch(fieldType) {
      case '单词':
      case '词语':
        sectionClass = 'result-section word-section';
        break;
      case '拼音':
      case '音标':
        sectionClass = 'result-section phonetic-section';
        break;
      case '英文':
        sectionClass = 'result-section english-section';
        break;
      case '释义':
        sectionClass = 'result-section meaning-section';
        break;
      case '谐音':
        sectionClass = 'result-section pronunciation-section';
        break;
      case '发音':
        sectionClass = 'result-section tip-section';
        break;
      case '例句':
        sectionClass = 'result-section example-section';
        break;
    }

    html = html.replace(/^(单词|词语|拼音|音标|英文|释义|谐音|发音|例句)：/, `<div class="${sectionClass}"><span class="result-label">$1：</span>`);
  }

  // 为整个内容添加包装
  html = '<div class="result-wrapper">' + html + '</div>';

  // 转换加粗 **text** 为 <strong>text</strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  return html;
});

// 提取查询结果中的各个部分
const extractContentParts = computed(() => {
  if (!queryResult.value) return {};

  const content = queryResult.value;
  const parts: any = {};

  // 提取音标或拼音
  const phoneticMatch = content.match(/音标：[^\n]+/) || content.match(/拼音：[^\n]+/);
  if (phoneticMatch) parts.phonetic = phoneticMatch[0].replace(/(音标|拼音)：/, '').trim();

  // 提取释义
  const meaningMatch = content.match(/释义：[^\n]+/);
  if (meaningMatch) parts.meaning = meaningMatch[0].replace('释义：', '').trim();

  // 提取英文翻译（仅中文查询时有）
  const englishMatch = content.match(/英文：[^\n]+/);
  if (englishMatch) parts.english = englishMatch[0].replace('英文：', '').trim();

  // 提取谐音
  const pronunciationMatch = content.match(/谐音：[^\n]+/);
  if (pronunciationMatch) parts.pronunciation = pronunciationMatch[0].replace('谐音：', '').trim();

  // 提取例句
  const exampleMatch = content.match(/例句：[\s\S]+/);
  if (exampleMatch) parts.example = exampleMatch[0].replace('例句：', '').trim();

  // 提取全部内容
  parts.all = content;

  return parts;
});

// 处理查询
const handleQuery = async () => {
  const word = searchWord.value.trim();
  if (!word) {
    errorMessage.value = props.i18n.enterWordPlease || '请输入单词';
    return;
  }

  // 验证是否为有效的单词或词语（中英文、数字、符号、标点）
  if (!/^[a-zA-Z0-9\s\-.,;:!?'"()（）【】《》《""''\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF]+$/.test(word)) {
    errorMessage.value = props.i18n.enterValidWord || '请输入有效的单词或词语';
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
      // 检查是否已收藏
      checkIfFavorited(word);
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

// 添加到历史记录
const addToHistory = async (word: string, result: string) => {
  const newItem: HistoryItem = {
    word,
    result,
    timestamp: Date.now()
  };

  // 移除重复项
  queryHistory.value = queryHistory.value.filter(item => item.word !== word);
  // 添加到开头
  queryHistory.value.unshift(newItem);
  // 限制数量
  if (queryHistory.value.length > maxHistoryItems.value) {
    queryHistory.value = queryHistory.value.slice(0, maxHistoryItems.value);
  }
  // 保存到思源数据库
  await saveHistory();
};

// 保存历史记录
const saveHistory = async () => {
  if (props.plugin) {
    try {
      await props.plugin.saveData('word-query-history', queryHistory.value);
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }
};

// 加载历史记录
const loadHistory = async () => {
  if (props.plugin) {
    try {
      const saved = await props.plugin.loadData('word-query-history');
      if (saved) {
        queryHistory.value = saved;
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }
};

// 清除历史记录
const clearHistory = async () => {
  queryHistory.value = [];
  await saveHistory();
  showMessage('历史记录已清除', 2000, 'info');
};

// 从历史记录查询
const queryFromHistory = (item: HistoryItem) => {
  searchWord.value = item.word;
  queryResult.value = item.result;
  checkIfFavorited(item.word);
  showHistory.value = false;
};

// 切换历史记录显示
const toggleHistory = () => {
  showHistory.value = !showHistory.value;
  if (showHistory.value) {
    showFavorites.value = false;
    showAdvancedOptions.value = false;
  }
};

// 检查是否已收藏
const checkIfFavorited = (word: string) => {
  currentWordFavorited.value = favorites.value.some(item => item.word === word);
};

// 切换收藏
const toggleFavorite = async () => {
  const word = searchWord.value.trim();
  if (!word || !queryResult.value) return;

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
  await saveFavorites();
};

// 保存收藏
const saveFavorites = async () => {
  if (props.plugin) {
    try {
      await props.plugin.saveData('word-query-favorites', favorites.value);
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }
};

// 加载收藏
const loadFavorites = async () => {
  if (props.plugin) {
    try {
      const saved = await props.plugin.loadData('word-query-favorites');
      if (saved) {
        favorites.value = saved;
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  }
};

// 清除收藏
const clearFavorites = async () => {
  favorites.value = [];
  await saveFavorites();
  showMessage('收藏已清除', 2000, 'info');
};

// 从收藏查询
const queryFromFavorite = (item: FavoriteItem) => {
  searchWord.value = item.word;
  queryResult.value = item.result;
  currentWordFavorited.value = true;
  showFavorites.value = false;
};

// 删除收藏项
const removeFavorite = async (word: string) => {
  favorites.value = favorites.value.filter(item => item.word !== word);
  await saveFavorites();
  if (searchWord.value === word) {
    currentWordFavorited.value = false;
  }
};

// 切换收藏显示
const toggleFavorites = () => {
  showFavorites.value = !showFavorites.value;
  if (showFavorites.value) {
    showHistory.value = false;
    showAdvancedOptions.value = false;
  }
};

// 切换高级选项
const toggleAdvancedOptions = () => {
  showAdvancedOptions.value = !showAdvancedOptions.value;
  if (showAdvancedOptions.value) {
    showHistory.value = false;
    showFavorites.value = false;
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

// 保存高级选项
const saveAdvancedOptions = async () => {
  if (props.plugin) {
    try {
      await props.plugin.saveData('word-query-options', {
        pronunciationType: pronunciationType.value,
        autoPlayPronunciation: autoPlayPronunciation.value,
        showRelatedWords: showRelatedWords.value
      });
    } catch (error) {
      console.error('Failed to save advanced options:', error);
    }
  }
};

// 加载高级选项
const loadAdvancedOptions = async () => {
  if (props.plugin) {
    try {
      const saved = await props.plugin.loadData('word-query-options');
      if (saved) {
        if (saved.pronunciationType) {
          pronunciationType.value = saved.pronunciationType;
        }
        if (typeof saved.autoPlayPronunciation !== 'undefined') {
          autoPlayPronunciation.value = saved.autoPlayPronunciation;
        }
        if (typeof saved.showRelatedWords !== 'undefined') {
          showRelatedWords.value = saved.showRelatedWords;
        }
      }
    } catch (error) {
      console.error('Failed to load advanced options:', error);
    }
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

// 自动查询函数
const setupAutoQuery = () => {
  // 清除之前的定时器
  if (autoQueryTimer.value) {
    clearTimeout(autoQueryTimer.value);
    autoQueryTimer.value = null;
  }

  const word = searchWord.value.trim();
  if (word && /^[a-zA-Z0-9\s\-.,;:!?'"()（）【】《》《""''\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF]+$/.test(word)) {
    // 设置2秒后自动查询
    autoQueryTimer.value = setTimeout(() => {
      handleQuery();
    }, 2000);
  }
};

// 自动翻译函数
const setupAutoTranslate = () => {
  // 清除之前的定时器
  if (autoTranslateTimer.value) {
    clearTimeout(autoTranslateTimer.value);
    autoTranslateTimer.value = null;
  }

  const text = translateText.value.trim();
  // 检查是否有内容且不在翻译中
  if (text && !isTranslating.value) {
    // 设置2秒后自动翻译
    autoTranslateTimer.value = setTimeout(() => {
      handleTranslate();
    }, 2000);
  }
};

// 切换复制选项显示
const toggleCopyOptions = () => {
  showCopyOptions.value = !showCopyOptions.value;
};

// 复制结果
const copyResult = async (type: string = 'all') => {
  let textToCopy = '';

  if (type === 'all') {
    textToCopy = extractContentParts.value.all || queryResult.value;
  } else {
    textToCopy = extractContentParts.value[type] || '';

    if (!textToCopy) {
      showMessage('没有找到要复制的内容', 2000, 'error');
      return;
    }
  }

  try {
    await navigator.clipboard.writeText(textToCopy);
    const typeText = {
      all: '全部',
      phonetic: '音标',
      meaning: '释义',
      english: '英文',
      pronunciation: '谐音',
      example: '例句'
    }[type] || '';
    showMessage(`已复制${typeText}到剪贴板`, 2000, 'info');
    showCopyOptions.value = false; // 复制后关闭下拉菜单
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
  showHistory.value = false;
  showFavorites.value = false;
  showAdvancedOptions.value = false;
};

// 翻译功能
const handleTranslate = async () => {
  const text = translateText.value.trim();
  if (!text) {
    showMessage('请输入要翻译的文本', 2000, 'error');
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

// 获取语言名称
const getLanguageName = (code: string): string => {
  const names: Record<string, string> = {
    'auto': '自动检测',
    'zh': '中文',
    'en': '英文',
    'ja': '日文',
    'ko': '韩文',
    'fr': '法文',
    'de': '德文',
    'es': '西班牙文'
  };
  return names[code] || code;
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

onMounted(async () => {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleClickOutside);
  // 加载历史记录和收藏
  await Promise.all([
    loadHistory(),
    loadFavorites(),
    loadAdvancedOptions()
  ]);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('click', handleClickOutside);
  // 清除定时器
  if (autoQueryTimer.value) {
    clearTimeout(autoQueryTimer.value);
  }
  if (autoTranslateTimer.value) {
    clearTimeout(autoTranslateTimer.value);
  }
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
.history-panel,
.favorites-panel,
.advanced-panel {
  border-bottom: 1px solid var(--gh-border);
  background: var(--gh-bg-overlay);
  animation: slideDown 0.2s ease-out;
  max-width: 100%;
  overflow: hidden;
  max-height: 300px;
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

/* 历史记录样式 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--gh-bg-default);
  border-radius: var(--gh-control-border-radius);
  cursor: pointer;
  transition: background-color 0.2s ease;
  border: 1px solid var(--gh-border);
}

.history-item:hover {
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

/* 收藏样式 */
.favorites-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.favorite-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--gh-bg-default);
  border-radius: var(--gh-control-border-radius);
  border: 1px solid var(--gh-border);
  transition: all 0.2s ease;
}

.favorite-item:hover {
  border-color: var(--gh-fg-muted);
}

.item-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.item-content:hover .item-word {
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
