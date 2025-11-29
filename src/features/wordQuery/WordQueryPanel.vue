<template>
  <div class="word-query-panel">
    <!-- 顶部操作栏 -->
    <div class="query-header">
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

      <!-- API密钥设置按钮 -->
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
        <button class="settings-btn" @click="toggleApiKeySettings" :title="i18n.apiKeySettings || 'API配置'">
          <IconWrapper name="settings" :size="18" />
        </button>
      </div>
    </div>

    <!-- API配置设置区域 -->
    <div class="api-key-settings" v-if="showApiKeySettings">
      <div class="api-key-header">
        <span>{{ i18n.apiKeySettings || 'API配置设置' }}</span>
        <button class="close-btn" @click="toggleApiKeySettings">
          <svg class="close-icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="api-key-content">
        <!-- API供应商选择 -->
        <div class="input-group">
          <label>{{ i18n.apiProvider || 'API供应商' }}</label>
          <div class="provider-select-wrapper">
            <select
              v-model="apiProvider"
              class="provider-select"
              @change="onProviderChange"
            >
              <option value="" disabled>{{ i18n.apiProviderPlaceholder || '选择API供应商' }}</option>
              <option value="tongyi">{{ i18n.tongyiQianwen || '通义千问' }}</option>
              <option value="openai">{{ i18n.openAI || 'OpenAI' }}</option>
              <option value="deepseek">{{ i18n.deepSeek || 'DeepSeek' }}</option>
              <option value="custom">{{ i18n.customApi || '自定义API' }}</option>
            </select>
          </div>
        </div>

        <!-- API密钥输入 -->
        <div class="input-group">
          <label>{{ i18n.wordQueryApiKey || 'API密钥' }}</label>
          <div class="api-input-wrapper">
            <input
              v-model="apiKey"
              :type="apiKeyVisible ? 'text' : 'password'"
              class="api-key-input"
              :placeholder="getApiKeyPlaceholder()"
              @input="saveApiKey"
            />
            <button class="toggle-visibility" @click="toggleApiKeyVisibility">
              <svg class="visibility-icon" v-if="apiKeyVisible">
                <use xlink:href="#iconEye"></use>
              </svg>
              <svg class="visibility-icon" v-else>
                <use xlink:href="#iconEyeOff"></use>
              </svg>
            </button>
          </div>
          <div class="api-key-desc">
            {{ getApiKeyDescription() }}
          </div>
        </div>

        <!-- 自定义API端点（仅在选择自定义API时显示） -->
        <div class="input-group" v-if="apiProvider === 'custom'">
          <label>API端点</label>
          <div class="api-input-wrapper">
            <input
              v-model="customApiEndpoint"
              type="text"
              class="api-key-input"
              placeholder="请输入自定义API端点URL"
              @input="saveCustomApiEndpoint"
            />
          </div>
          <div class="api-key-desc">
            自定义API端点URL，用于连接自定义API服务
          </div>
        </div>
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { showMessage } from 'siyuan';
import IconWrapper from '@/components/IconWrapper.vue';

// Props
interface Props {
  i18n: any;
  onQuery: (word: string) => Promise<string>;
  onApiKeyChange?: (apiKey: string) => void;
  onProviderChange?: (provider: string) => void;
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
const searchWord = ref('');
const queryResult = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const showCopyOptions = ref(false);
const showApiKeySettings = ref(false);
const apiKey = ref('');
const apiKeyVisible = ref(false);
const apiProvider = ref('tongyi');
const customApiEndpoint = ref('');
const autoQueryTimer = ref<NodeJS.Timeout | null>(null);

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
      addToHistory(word, result);
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
const addToHistory = (word: string, result: string) => {
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
  // 保存到本地存储
  saveHistory();
};

// 保存历史记录
const saveHistory = () => {
  try {
    localStorage.setItem('word-query-history', JSON.stringify(queryHistory.value));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
};

// 加载历史记录
const loadHistory = () => {
  try {
    const saved = localStorage.getItem('word-query-history');
    if (saved) {
      queryHistory.value = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load history:', error);
  }
};

// 清除历史记录
const clearHistory = () => {
  queryHistory.value = [];
  saveHistory();
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
const toggleFavorite = () => {
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
  saveFavorites();
};

// 保存收藏
const saveFavorites = () => {
  try {
    localStorage.setItem('word-query-favorites', JSON.stringify(favorites.value));
  } catch (error) {
    console.error('Failed to save favorites:', error);
  }
};

// 加载收藏
const loadFavorites = () => {
  try {
    const saved = localStorage.getItem('word-query-favorites');
    if (saved) {
      favorites.value = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load favorites:', error);
  }
};

// 清除收藏
const clearFavorites = () => {
  favorites.value = [];
  saveFavorites();
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
const removeFavorite = (word: string) => {
  favorites.value = favorites.value.filter(item => item.word !== word);
  saveFavorites();
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
const saveAdvancedOptions = () => {
  try {
    localStorage.setItem('word-query-pronunciation-type', pronunciationType.value);
    localStorage.setItem('word-query-auto-play', JSON.stringify(autoPlayPronunciation.value));
    localStorage.setItem('word-query-show-related', JSON.stringify(showRelatedWords.value));
  } catch (error) {
    console.error('Failed to save advanced options:', error);
  }
};

// 加载高级选项
const loadAdvancedOptions = () => {
  try {
    const savedType = localStorage.getItem('word-query-pronunciation-type');
    if (savedType) {
      pronunciationType.value = savedType as 'uk' | 'us';
    }
    const savedAutoPlay = localStorage.getItem('word-query-auto-play');
    if (savedAutoPlay) {
      autoPlayPronunciation.value = JSON.parse(savedAutoPlay);
    }
    const savedShowRelated = localStorage.getItem('word-query-show-related');
    if (savedShowRelated) {
      showRelatedWords.value = JSON.parse(savedShowRelated);
    }
  } catch (error) {
    console.error('Failed to load advanced options:', error);
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

// 切换复制选项显示
const toggleCopyOptions = () => {
  showCopyOptions.value = !showCopyOptions.value;
};

// 切换API密钥设置区域
const toggleApiKeySettings = () => {
  showApiKeySettings.value = !showApiKeySettings.value;
  if (showApiKeySettings.value) {
    // 打开时从本地存储加载API密钥
    loadApiKey();
    showCopyOptions.value = false; // 关闭复制选项
  }
};

// 切换API密钥可见性
const toggleApiKeyVisibility = () => {
  apiKeyVisible.value = !apiKeyVisible.value;
};

// 保存API密钥到本地存储
const saveApiKey = async () => {
  if (apiKey.value) {
    try {
      const providerKey = `word-query-api-key-${apiProvider.value}`;
      localStorage.setItem(providerKey, apiKey.value);
      // 通知父组件API密钥已更新
      if (props.onApiKeyChange) {
        props.onApiKeyChange(apiKey.value);
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
  }
};

// 获取API密钥占位符
const getApiKeyPlaceholder = () => {
  const placeholders: Record<string, string> = {
    tongyi: props.i18n.tongyiQianwenPlaceholder || '请输入通义千问API密钥',
    openai: props.i18n.openAIPlaceholder || '请输入OpenAI API密钥',
    deepseek: props.i18n.deepSeekPlaceholder || '请输入DeepSeek API密钥',
    custom: props.i18n.customApiPlaceholder || '请输入自定义API密钥'
  };
  return placeholders[apiProvider.value] || '请输入API密钥';
};

// 获取API密钥描述
const getApiKeyDescription = () => {
  const descriptions: Record<string, string> = {
    tongyi: `${props.i18n.tongyiQianwen || '通义千问'} API密钥，用于单词查询功能`,
    openai: `${props.i18n.openAI || 'OpenAI'} API密钥，用于单词查询功能`,
    deepseek: `${props.i18n.deepSeek || 'DeepSeek'} API密钥，用于单词查询功能`,
    custom: `${props.i18n.customApi || '自定义API'} 密钥，用于单词查询功能`
  };
  return descriptions[apiProvider.value] || 'API密钥，用于单词查询功能';
};

// 供应商变更处理
const onProviderChange = () => {
  saveApiProvider();
  // 清空当前API密钥，让用户重新输入
  apiKey.value = '';
  // 通知父组件供应商已变更
  if (props.onProviderChange) {
    props.onProviderChange(apiProvider.value);
  }
};

// 保存API供应商到本地存储
const saveApiProvider = async () => {
  try {
    localStorage.setItem('word-query-api-provider', apiProvider.value);
  } catch (error) {
    console.error('Failed to save API provider:', error);
  }
};

// 加载API供应商
const loadApiProvider = () => {
  try {
    const savedProvider = localStorage.getItem('word-query-api-provider');
    if (savedProvider) {
      apiProvider.value = savedProvider;
    }
  } catch (error) {
    console.error('Failed to load API provider:', error);
  }
};

// 保存自定义API端点
const saveCustomApiEndpoint = async () => {
  try {
    localStorage.setItem('word-query-custom-endpoint', customApiEndpoint.value);
  } catch (error) {
    console.error('Failed to save custom API endpoint:', error);
  }
};

// 加载自定义API端点
const loadCustomApiEndpoint = () => {
  try {
    const savedEndpoint = localStorage.getItem('word-query-custom-endpoint');
    if (savedEndpoint) {
      customApiEndpoint.value = savedEndpoint;
    }
  } catch (error) {
    console.error('Failed to load custom API endpoint:', error);
  }
};

// 从本地存储加载API密钥
const loadApiKey = () => {
  try {
    const providerKey = `word-query-api-key-${apiProvider.value}`;
    const savedKey = localStorage.getItem(providerKey);
    if (savedKey) {
      apiKey.value = savedKey;
    } else if (apiProvider.value === 'tongyi') {
      // 通义千问的默认密钥
      apiKey.value = 'sk-fae27cc50015409fb2524b0970d3f0b0';
    }
  } catch (error) {
    console.error('Failed to load API key:', error);
    if (apiProvider.value === 'tongyi') {
      apiKey.value = 'sk-fae27cc50015409fb2524b0970d3f0b0';
    }
  }
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

// 键盘快捷键
const handleKeyDown = (event: KeyboardEvent) => {
  // Ctrl/Cmd + Enter 执行查询
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    handleQuery();
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

// 监听高级选项变化
watch([pronunciationType, autoPlayPronunciation, showRelatedWords], () => {
  saveAdvancedOptions();
});

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleClickOutside);
  // 初始化时加载API配置
  loadApiProvider();
  loadCustomApiEndpoint();
  loadApiKey();
  // 加载历史记录和收藏
  loadHistory();
  loadFavorites();
  // 加载高级选项
  loadAdvancedOptions();
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('click', handleClickOutside);
  // 清除定时器
  if (autoQueryTimer.value) {
    clearTimeout(autoQueryTimer.value);
  }
});
</script>

<style scoped>
.word-query-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 200px;
  max-height: 100vh;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.query-header {
  padding: 12px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--b3-theme-surface);
}

.input-wrapper {
  display: flex;
  gap: 8px;
  flex: 1;
  margin-right: 8px;
}

.query-input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid var(--b3-theme-surface-light);
  border-radius: 8px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  outline: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
  font-size: 13px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.query-input:hover {
  border-color: var(--b3-theme-primary-lighter);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.query-input:focus {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.15);
  transform: translateY(-1px);
}

.query-input::placeholder {
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}

.query-btn {
  padding: 8px 12px;
  background: linear-gradient(135deg, var(--b3-theme-primary), var(--b3-theme-primary-lighter));
  color: var(--b3-theme-on-primary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  font-weight: 500;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.3);
}

.query-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.4);
}

.query-btn:active:not(:disabled) {
  transform: translateY(0);
}

.query-btn:disabled {
  background: var(--b3-theme-surface-light);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.query-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.query-content {
  flex: 1;
  padding: 12px;
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
  color: var(--b3-theme-on-surface);
}

.loading-spinner-large {
  width: 32px;
  height: 32px;
  border: 3px solid var(--b3-theme-surface-light);
  border-top: 3px solid var(--b3-theme-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.query-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--b3-theme-error);
  text-align: center;
}

.query-result {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; /* 允许内容区域在flex容器中正确收缩 */
  animation: fadeIn 0.5s ease-in-out;
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

.result-content {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 12px;
  padding: 16px;
  background: linear-gradient(135deg, var(--b3-theme-surface-lighter), var(--b3-theme-surface));
  border-radius: 12px;
  min-height: 100px;
  max-height: 300px;
  word-wrap: break-word;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--b3-theme-surface-light);
  backdrop-filter: blur(10px);
}

.result-title {
  margin: 0 0 16px 0;
  color: var(--b3-theme-primary);
  font-size: 1.4em;
  font-weight: 600;
  text-align: center;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--b3-theme-surface);
  word-wrap: break-word; /* 标题也可以换行 */
}

.result-label {
  display: inline-block;
  font-weight: 600;
  color: var(--b3-theme-primary);
  margin-right: 6px;
  min-width: 60px;
}

.result-content br {
  display: block;
  margin-bottom: 8px;
  content: "";
}

.result-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding-top: 2px;
}

.action-btn {
  padding: 6px 12px;
  background: linear-gradient(135deg, var(--b3-theme-surface), var(--b3-theme-surface-light));
  color: var(--b3-theme-on-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
  white-space: nowrap;
  font-weight: 500;
  font-size: 11px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.action-btn:hover {
  background: linear-gradient(135deg, var(--b3-theme-surface-light), var(--b3-theme-primary-lighter));
  border-color: var(--b3-theme-primary-lighter);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.action-btn:active {
  transform: translateY(0);
}

.copy-btn {
  background: linear-gradient(135deg, #4CAF50, #66BB6A);
  color: white;
  border-color: #4CAF50;
}

.copy-btn:hover {
  background: linear-gradient(135deg, #66BB6A, #81C784);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.clear-btn {
  background: linear-gradient(135deg, #f44336, #ef5350);
  color: white;
  border-color: #f44336;
}

.clear-btn:hover {
  background: linear-gradient(135deg, #ef5350, #e57373);
  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
}

.action-icon {
  width: 16px;
  height: 16px;
}

.dropdown-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 100;
  min-width: 140px;
  max-width: 200px;
  padding: 6px;
  backdrop-filter: blur(10px);
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  background: none;
  border: none;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 400;
}

.dropdown-item:hover {
  background: var(--b3-theme-primary-lighter);
  color: var(--b3-theme-on-primary);
  transform: translateX(2px);
}

.dropdown-item:first-child {
  border-radius: 8px 8px 8px 8px;
}

.dropdown-item:last-child {
  border-radius: 8px 8px 8px 8px;
}

.query-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--b3-theme-on-surface);
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 24px;
  opacity: 0.4;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 查询结果内容分组样式 */
.result-wrapper {
  padding: 12px 0;
}

.result-section {
  margin-bottom: 18px;
  padding: 16px 20px;
  background: var(--b3-theme-background);
  border-radius: 12px;
  border-left: 5px solid var(--b3-theme-primary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1.6;
  font-size: 14px;
  position: relative;
  overflow: hidden;
}

.result-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--b3-theme-primary-lighter), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.result-section:hover {
  transform: translateX(4px) translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.result-section:hover::before {
  opacity: 1;
}

.result-section:last-child {
  margin-bottom: 0;
}

.result-section strong {
  color: var(--b3-theme-on-background);
  font-weight: 600;
}

/* 不同内容类型的样式 */
.word-section {
  border-left-color: var(--b3-theme-primary);
  background: linear-gradient(135deg, var(--b3-theme-background), rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.05));
}

.phonetic-section {
  border-left-color: #2196F3;
  background: linear-gradient(135deg, var(--b3-theme-background), rgba(33, 150, 243, 0.05));
}

.phonetic-section .result-label {
  color: #2196F3;
}

.english-section {
  border-left-color: #4CAF50;
  background: linear-gradient(135deg, var(--b3-theme-background), rgba(76, 175, 80, 0.05));
}

.english-section .result-label {
  color: #4CAF50;
}

.meaning-section {
  border-left-color: #FF9800;
  background: linear-gradient(135deg, var(--b3-theme-background), rgba(255, 152, 0, 0.05));
}

.meaning-section .result-label {
  color: #FF9800;
}

.pronunciation-section {
  border-left-color: #9C27B0;
  background: linear-gradient(135deg, var(--b3-theme-background), rgba(156, 39, 176, 0.05));
}

.pronunciation-section .result-label {
  color: #9C27B0;
}

.tip-section {
  border-left-color: #00BCD4;
  background: linear-gradient(135deg, var(--b3-theme-background), rgba(0, 188, 212, 0.05));
}

.tip-section .result-label {
  color: #00BCD4;
}

.example-section {
  border-left-color: #795548;
  background: linear-gradient(135deg, var(--b3-theme-background), rgba(121, 85, 72, 0.05));
}

.example-section .result-label {
  color: #795548;
}

/* API配置设置相关样式 */
.settings-btn {
  padding: 8px;
  background: transparent;
  border: none;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.settings-btn:hover {
  background: var(--b3-theme-surface-light);
  transform: scale(1.05);
}

.settings-icon {
  width: 18px;
  height: 18px;
}

.api-key-settings {
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface-lighter);
  animation: slideDown 0.3s ease-out;
  max-width: 100%;
  overflow: hidden;
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

.api-key-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.close-btn {
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  transform: rotate(90deg);
}

.close-icon {
  width: 16px;
  height: 16px;
}

.api-key-content {
  padding: 12px;
  max-width: 100%;
  overflow-x: hidden;
}

.input-group {
  margin-bottom: 12px;
  width: 100%;
}

.input-group:last-child {
  margin-bottom: 0;
}

.input-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.9em;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.provider-select-wrapper {
  position: relative;
}

.provider-select {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--b3-theme-surface-light);
  border-radius: 8px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  outline: none;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23667' d='M6 9L2 5h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.provider-select:hover {
  border-color: var(--b3-theme-primary);
}

.provider-select:focus {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
}

.api-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.api-key-input {
  flex: 1;
  padding: 8px 10px;
  border: 2px solid var(--b3-theme-surface-light);
  border-radius: 6px 0 0 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  outline: none;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 0.8em;
  transition: all 0.2s ease;
  min-width: 0;
}

.api-key-input:hover {
  border-color: var(--b3-theme-primary);
}

.api-key-input:focus {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
}

.toggle-visibility {
  padding: 8px 10px;
  background: var(--b3-theme-surface);
  border: 2px solid var(--b3-theme-surface-light);
  border-left: none;
  border-radius: 0 6px 6px 0;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toggle-visibility:hover {
  background: var(--b3-theme-primary);
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

.visibility-icon {
  width: 16px;
  height: 16px;
  color: var(--b3-theme-on-surface);
  transition: transform 0.2s ease;
}

.toggle-visibility:hover .visibility-icon {
  transform: scale(1.1);
}

.api-key-desc {
  margin-top: 6px;
  font-size: 0.8em;
  color: var(--b3-theme-on-surface);
  opacity: 0.75;
  line-height: 1.3;
  padding-left: 2px;
  word-break: break-word;
}

/* 响应式设计 */
@media (max-width: 400px) {
  .query-header {
    padding: 8px;
    gap: 6px;
  }

  .input-wrapper {
    gap: 6px;
    margin-right: 6px;
  }

  .query-input {
    padding: 6px 8px;
    font-size: 12px;
  }

  .query-btn {
    padding: 6px 8px;
    font-size: 11px;
  }

  .api-key-header {
    padding: 6px 10px;
  }

  .api-key-content {
    padding: 8px 10px 10px;
  }

  .api-key-input {
    font-size: 0.75em;
    padding: 6px 8px;
  }

  .toggle-visibility {
    padding: 6px 8px;
  }

  .query-content {
    padding: 8px;
  }

  .result-content {
    padding: 12px;
    margin-bottom: 8px;
  }

  .result-actions {
    gap: 4px;
  }

  .action-btn {
    padding: 4px 8px;
    font-size: 10px;
    gap: 4px;
  }

  .dropdown-menu {
    min-width: 80px;
    max-width: 120px;
  }

  .dropdown-item {
    padding: 6px 8px;
    font-size: 10px;
  }
}

@media (max-width: 320px) {
  .query-header {
    padding: 6px;
  }

  .query-input {
    padding: 4px 6px;
    font-size: 11px;
  }

  .query-btn {
    padding: 4px 6px;
    font-size: 10px;
  }

  .result-content {
    padding: 8px;
  }

  .action-btn {
    padding: 3px 6px;
    font-size: 9px;
  }
}

@media (max-height: 500px) {
  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  .loading-spinner-large {
    width: 16px;
    height: 16px;
    margin-bottom: 8px;
  }

  .result-content {
    padding: 8px;
    margin-bottom: 6px;
  }

  .api-key-header {
    padding: 4px 8px;
  }

  .api-key-content {
    padding: 6px 8px 6px;
  }

  .api-key-input {
    padding: 4px 6px;
    font-size: 0.7em;
  }

  .toggle-visibility {
    padding: 4px 6px;
  }

  .input-group {
    margin-bottom: 8px;
  }
}

/* 新增功能样式 */

/* 面板通用样式 */
.history-panel,
.favorites-panel,
.advanced-panel {
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface-lighter);
  animation: slideDown 0.3s ease-out;
  max-width: 100%;
  overflow: hidden;
  max-height: 300px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  font-weight: 600;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.panel-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-clear {
  padding: 4px 10px;
  background: var(--b3-theme-error);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s ease;
}

.btn-clear:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.panel-content {
  padding: 8px;
  max-height: 240px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  font-size: 13px;
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
  padding: 10px 12px;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--b3-theme-surface-light);
}

.history-item:hover {
  background: var(--b3-theme-primary-lighter);
  transform: translateX(4px);
  border-color: var(--b3-theme-primary);
}

.item-word {
  font-weight: 500;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.item-time {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
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
  padding: 10px 12px;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  border: 1px solid var(--b3-theme-surface-light);
  transition: all 0.2s ease;
}

.favorite-item:hover {
  border-color: var(--b3-theme-primary);
}

.item-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.item-content:hover .item-word {
  color: var(--b3-theme-primary);
}

.btn-remove {
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: var(--b3-theme-error);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  margin-left: 8px;
}

.btn-remove:hover {
  background: var(--b3-theme-error);
  color: white;
}

.remove-icon {
  width: 14px;
  height: 14px;
}

/* 高级选项样式 */
.advanced-content {
  padding: 12px;
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
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--b3-theme-on-surface);
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
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.radio-label:hover,
.checkbox-label:hover {
  background: var(--b3-theme-surface-light);
}

.radio-label input[type="radio"],
.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* 操作按钮样式优化 */
.favorite-btn {
  background: linear-gradient(135deg, #FFC107, #FFD54F);
  color: #5D4037;
  border-color: #FFC107;
}

.favorite-btn:hover {
  background: linear-gradient(135deg, #FFD54F, #FFE082);
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
}

.favorite-btn.favorited {
  background: linear-gradient(135deg, #FF9800, #FFB74D);
  color: white;
}

.play-btn {
  background: linear-gradient(135deg, #2196F3, #64B5F6);
  color: white;
  border-color: #2196F3;
}

.play-btn:hover {
  background: linear-gradient(135deg, #64B5F6, #90CAF9);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
}

.export-btn {
  background: linear-gradient(135deg, #9C27B0, #BA68C8);
  color: white;
  border-color: #9C27B0;
}

.export-btn:hover {
  background: linear-gradient(135deg, #BA68C8, #CE93D8);
  box-shadow: 0 4px 12px rgba(156, 39, 176, 0.3);
}

/* 工具栏按钮布局 */
.api-key-toggle {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.settings-btn {
  padding: 8px;
  background: transparent;
  border: none;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.settings-btn:hover {
  background: var(--b3-theme-surface-light);
  transform: scale(1.05);
}

.settings-icon {
  width: 18px;
  height: 18px;
}
</style>
