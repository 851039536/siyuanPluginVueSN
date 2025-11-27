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
        <button class="settings-btn" @click="toggleApiKeySettings">
          <svg class="settings-icon"><use xlink:href="#iconSettings"></use></svg>
        </button>
      </div>
    </div>
    
    <!-- API密钥设置区域 -->
    <div class="api-key-settings" v-if="showApiKeySettings">
      <div class="api-key-header">
        <span>{{ i18n.apiKeySettings || 'API密钥设置' }}</span>
        <button class="close-btn" @click="toggleApiKeySettings">
          <svg class="close-icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="api-key-content">
        <div class="input-group">
          <label>{{ i18n.wordQueryApiKey || 'API密钥' }}</label>
          <div class="api-input-wrapper">
            <input
              v-model="apiKey"
              :type="apiKeyVisible ? 'text' : 'password'"
              class="api-key-input"
              :placeholder="i18n.wordQueryApiKeyPlaceholder || '请输入通义千问API密钥'"
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
            {{ i18n.wordQueryApiKeyDesc || '通义千问API密钥，用于单词查询功能' }}
          </div>
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

// Props
interface Props {
  i18n: any;
  onQuery: (word: string) => Promise<string>;
  onApiKeyChange?: (apiKey: string) => void;
}

const props = defineProps<Props>();

// 状态
const searchWord = ref('');
const queryResult = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const showCopyOptions = ref(false);
const showApiKeySettings = ref(false);
const apiKey = ref('');
const apiKeyVisible = ref(false);
const autoQueryTimer = ref<NodeJS.Timeout | null>(null);

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
  
  // 验证是否为有效的单词或词语（中英文）
  if (!/^[a-zA-Z\s-\u4e00-\u9fa5]+$/.test(word)) {
    errorMessage.value = props.i18n.enterValidWord || '请输入有效的单词或词语';
    return;
  }
  
  isLoading.value = true;
  errorMessage.value = '';
  
  try {
    const result = await props.onQuery(word);
    if (result) {
      queryResult.value = result;
    } else {
      errorMessage.value = props.i18n.queryFailed || '查询失败，请重试';
    }
  } catch (error) {
    console.error('Query error:', error);
    errorMessage.value = (error as Error).message || props.i18n.unknownError || '未知错误';
  } finally {
    isLoading.value = false;
  }
};

// 自动查询函数
const setupAutoQuery = () => {
  // 清除之前的定时器
  if (autoQueryTimer.value) {
    clearTimeout(autoQueryTimer.value);
    autoQueryTimer.value = null;
  }
  
  const word = searchWord.value.trim();
  if (word && /^[a-zA-Z\s-\u4e00-\u9fa5]+$/.test(word)) {
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
      localStorage.setItem('word-query-api-key', apiKey.value);
      // 通知父组件API密钥已更新
      if (props.onApiKeyChange) {
        props.onApiKeyChange(apiKey.value);
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
  }
};

// 从本地存储加载API密钥
const loadApiKey = () => {
  try {
    const savedKey = localStorage.getItem('word-query-api-key');
    if (savedKey) {
      apiKey.value = savedKey;
    } else {
      // 如果没有保存的密钥，使用默认值
      apiKey.value = 'sk-fae27cc50015409fb2524b0970d3f0b0';
    }
  } catch (error) {
    console.error('Failed to load API key:', error);
    apiKey.value = 'sk-fae27cc50015409fb2524b0970d3f0b0';
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

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleClickOutside);
  // 初始化时加载API密钥
  loadApiKey();
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
  min-height: 200px; /* 设置最小高度 */
  max-height: 100vh; /* 最大高度不超过视口高度 */
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
}

.query-header {
  padding: 12px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  flex-shrink: 0; /* 防止头部被压缩 */
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-wrapper {
  display: flex;
  gap: 8px;
}

.query-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  outline: none;
  transition: border-color 0.2s;
  min-width: 0; /* 允许输入框收缩 */
}

.query-input:focus {
  border-color: var(--b3-theme-primary);
}

.query-btn {
  padding: 8px 12px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  flex-shrink: 0; /* 防止按钮被压缩 */
}

.query-btn:hover {
  background: var(--b3-theme-primary-lighter);
}

.query-btn:disabled {
  background: var(--b3-theme-surface-light);
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
  max-height: calc(100% - 60px); /* 减去头部高度，确保内容区域不会超出容器 */
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
  margin-bottom: 16px;
  padding: 16px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 8px;
  min-height: 100px; /* 设置最小内容高度 */
  word-wrap: break-word; /* 长单词自动换行 */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--b3-theme-surface-light);
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
  flex-wrap: wrap; /* 允许按钮换行 */
  flex-shrink: 0; /* 防止操作栏被压缩 */
}

.action-btn {
  padding: 8px 12px;
  background: var(--b3-theme-surface-light);
  color: var(--b3-theme-on-surface);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s;
  min-width: 0; /* 允许按钮在小屏幕上收缩 */
  white-space: nowrap; /* 防止按钮文字换行 */
}

.action-btn:hover {
  background: var(--b3-theme-surface);
}

.action-icon {
  width: 14px;
  height: 14px;
}

.dropdown-icon {
  width: 12px;
  height: 12px;
  transition: transform 0.2s;
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
  margin-bottom: 4px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
  min-width: 120px; /* 设置最小宽度 */
  max-width: 200px; /* 设置最大宽度 */
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: none;
  border: none;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background: var(--b3-theme-surface-light);
}

.dropdown-item:first-child {
  border-radius: 4px 4px 0 0;
}

.dropdown-item:last-child {
  border-radius: 0 0 4px 4px;
}

.query-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--b3-theme-on-surface);
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 查询结果内容分组样式 */
.result-wrapper {
  padding: 8px 0;
}

.result-section {
  margin-bottom: 14px;
  padding: 10px 12px;
  background: var(--b3-theme-background);
  border-radius: 6px;
  border-left: 4px solid var(--b3-theme-primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
  line-height: 1.5;
  font-size: 0.95em;
}

.result-section:hover {
  transform: translateX(3px);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.12);
}

.result-section:last-child {
  margin-bottom: 0;
}

.result-section strong {
  color: var(--b3-theme-on-background);
  font-weight: 500;
}

/* 不同内容类型的样式 */
.word-section {
  border-left-color: var(--b3-theme-primary);
}

.phonetic-section {
  border-left-color: #2196F3;
}

.phonetic-section .result-label {
  color: #2196F3;
}

.english-section {
  border-left-color: #4CAF50;
}

.english-section .result-label {
  color: #4CAF50;
}

.meaning-section {
  border-left-color: #FF9800;
}

.meaning-section .result-label {
  color: #FF9800;
}

.pronunciation-section {
  border-left-color: #9C27B0;
}

.pronunciation-section .result-label {
  color: #9C27B0;
}

.tip-section {
  border-left-color: #00BCD4;
}

.tip-section .result-label {
  color: #00BCD4;
}

.example-section {
  border-left-color: #795548;
}

.example-section .result-label {
  color: #795548;
}

/* API密钥设置相关样式 */
.settings-btn {
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.settings-btn:hover {
  background: var(--b3-theme-surface-light);
}

.settings-icon {
  width: 16px;
  height: 16px;
}

.api-key-settings {
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface-lighter);
}

.api-key-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.close-btn {
  padding: 4px;
  background: transparent;
  border: none;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: var(--b3-theme-surface);
}

.close-icon {
  width: 14px;
  height: 14px;
}

.api-key-content {
  padding: 0 12px 12px;
}

.input-group {
  margin-bottom: 8px;
}

.input-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.9em;
  color: var(--b3-theme-on-surface);
}

.api-input-wrapper {
  display: flex;
  align-items: center;
}

.api-key-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--b3-theme-surface-light);
  border-radius: 4px 0 0 4px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  outline: none;
  font-family: monospace;
  font-size: 0.85em;
}

.api-key-input:focus {
  border-color: var(--b3-theme-primary);
}

.toggle-visibility {
  padding: 6px 8px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-light);
  border-left: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-visibility:hover {
  background: var(--b3-theme-surface-light);
}

.visibility-icon {
  width: 14px;
  height: 14px;
  color: var(--b3-theme-on-surface);
}

.api-key-desc {
  margin-top: 6px;
  font-size: 0.8em;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

/* 响应式设计 */
@media (max-width: 400px) {
  .query-header {
    padding: 8px;
  }
  
  .api-key-header {
    padding: 6px 10px;
  }
  
  .api-key-content {
    padding: 0 10px 10px;
  }
  
  .api-key-input {
    font-size: 0.8em;
  }
  
  .query-content {
    padding: 12px;
  }
  
  .result-content {
    padding: 8px;
    margin-bottom: 12px;
  }
  
  .result-actions {
    gap: 6px;
  }
  
  .action-btn {
    padding: 6px 10px;
    font-size: 0.9em;
  }
  
  .dropdown-menu {
    min-width: 100px;
    max-width: 150px;
  }
}

@media (max-height: 500px) {
  .empty-icon {
    font-size: 36px;
    margin-bottom: 12px;
  }
  
  .loading-spinner-large {
    width: 20px;
    height: 20px;
    margin-bottom: 10px;
  }
  
  .result-content {
    padding: 8px;
  }
  
  .api-key-header {
    padding: 4px 8px;
  }
  
  .api-key-content {
    padding: 0 8px 8px;
  }
  
  .api-key-input {
    padding: 4px 8px;
  }
  
  .toggle-visibility {
    padding: 4px 6px;
  }
}
</style>