<template>
  <div class="list-settings">
    <div class="settings-container">
      <!-- 无序列表设置 -->
      <div class="setting-section">
        <h4 class="section-title">
          <span class="title-icon">☰</span>
          {{ i18n.unorderedListSettings || '无序列表设置' }}
        </h4>

        <!-- 启用自定义样式 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">✨</span>
              {{ i18n.enableCustomListStyles || '启用自定义样式' }}
            </label>
            <div class="switch-container">
              <label class="switch">
                <input
                  v-model="settings.enableCustomUnorderedList"
                  type="checkbox"
                  @change="handleSettingsChange"
                />
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 一级列表符号 -->
        <div class="setting-row" v-show="settings.enableCustomUnorderedList">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">▪</span>
              {{ i18n.firstLevelSymbol || '一级列表符号' }}
            </label>
            <div class="symbol-selector">
              <select v-model="settings.firstLevelSymbol" @change="handleSettingsChange">
                <option value="▪">▪</option>
                <option value="•">•</option>
                <option value="◦">◦</option>
                <option value="▸">▸</option>
                <option value="▹">▹</option>
                <option value="▶">▶</option>
                <option value="◉">◉</option>
                <option value="○">○</option>
                <option value="◇">◇</option>
                <option value="◆">◆</option>
              </select>
              <input
                v-model="settings.customFirstLevelSymbol"
                type="text"
                :placeholder="i18n.customSymbol || '自定义符号'"
                class="custom-symbol-input"
                @change="handleSettingsChange"
              />
            </div>
          </div>
        </div>

        <!-- 二级列表符号 -->
        <div class="setting-row" v-show="settings.enableCustomUnorderedList">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">•</span>
              {{ i18n.secondLevelSymbol || '二级列表符号' }}
            </label>
            <div class="symbol-selector">
              <select v-model="settings.secondLevelSymbol" @change="handleSettingsChange">
                <option value="•">•</option>
                <option value="▪">▪</option>
                <option value="◦">◦</option>
                <option value="▸">▸</option>
                <option value="▹">▹</option>
                <option value="▶">▶</option>
                <option value="◉">◉</option>
                <option value="○">○</option>
                <option value="◇">◇</option>
                <option value="◆">◆</option>
              </select>
              <input
                v-model="settings.customSecondLevelSymbol"
                type="text"
                :placeholder="i18n.customSymbol || '自定义符号'"
                class="custom-symbol-input"
                @change="handleSettingsChange"
              />
            </div>
          </div>
        </div>

        <!-- 三级列表符号 -->
        <div class="setting-row" v-show="settings.enableCustomUnorderedList">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">◦</span>
              {{ i18n.thirdLevelSymbol || '三级列表符号' }}
            </label>
            <div class="symbol-selector">
              <select v-model="settings.thirdLevelSymbol" @change="handleSettingsChange">
                <option value="◦">◦</option>
                <option value="•">•</option>
                <option value="▪">▪</option>
                <option value="▸">▸</option>
                <option value="▹">▹</option>
                <option value="▶">▶</option>
                <option value="◉">◉</option>
                <option value="○">○</option>
                <option value="◇">◇</option>
                <option value="◆">◆</option>
              </select>
              <input
                v-model="settings.customThirdLevelSymbol"
                type="text"
                :placeholder="i18n.customSymbol || '自定义符号'"
                class="custom-symbol-input"
                @change="handleSettingsChange"
              />
            </div>
          </div>
        </div>

        <!-- 字体大小 -->
        <div class="setting-row" v-show="settings.enableCustomUnorderedList">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">📏</span>
              {{ i18n.symbolSize || '符号大小' }}
            </label>
            <div class="range-control">
              <input
                v-model.number="settings.symbolSize"
                type="range"
                min="0.8"
                max="2.5"
                step="0.1"
                class="range-slider"
                @input="handleSettingsChange"
              />
              <input
                v-model.number="settings.symbolSize"
                type="number"
                min="0.8"
                max="2.5"
                step="0.1"
                class="number-input"
                @change="handleSettingsChange"
              />
              <span class="unit">em</span>
            </div>
          </div>
        </div>

        <!-- 左边距 -->
        <div class="setting-row" v-show="settings.enableCustomUnorderedList">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">↔️</span>
              {{ i18n.symbolMarginLeft || '符号左边距' }}
            </label>
            <div class="range-control">
              <input
                v-model.number="settings.symbolMarginLeft"
                type="range"
                min="0"
                max="30"
                step="1"
                class="range-slider"
                @input="handleSettingsChange"
              />
              <input
                v-model.number="settings.symbolMarginLeft"
                type="number"
                min="0"
                max="30"
                step="1"
                class="number-input"
                @change="handleSettingsChange"
              />
              <span class="unit">px</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 有序列表设置 -->
      <div class="setting-section">
        <h4 class="section-title">
          <span class="title-icon">🔢</span>
          {{ i18n.orderedListSettings || '有序列表设置' }}
        </h4>

        <!-- 启用自定义样式 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">✨</span>
              {{ i18n.enableCustomOrderedListStyles || '启用自定义样式' }}
            </label>
            <div class="switch-container">
              <label class="switch">
                <input
                  v-model="settings.enableCustomOrderedList"
                  type="checkbox"
                  @change="handleSettingsChange"
                />
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 编号格式 -->
        <div class="setting-row" v-show="settings.enableCustomOrderedList">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon">#️⃣</span>
              {{ i18n.numberFormat || '编号格式' }}
            </label>
            <div class="format-selector">
              <select v-model="settings.numberFormat" @change="handleSettingsChange">
                <option value="decimal">1. 2. 3.</option>
                <option value="decimal-leading-zero">01. 02. 03.</option>
                <option value="lower-alpha">a. b. c.</option>
                <option value="upper-alpha">A. B. C.</option>
                <option value="lower-roman">i. ii. iii.</option>
                <option value="upper-roman">I. II. III.</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- 应用范围 -->
      <div class="setting-section" v-show="settings.enableCustomUnorderedList || settings.enableCustomOrderedList">
        <h4 class="section-title">
          <span class="title-icon">🎯</span>
          {{ i18n.applicationScope || '应用范围' }}
        </h4>

        <div class="scope-options">
          <label class="scope-option">
            <input
              v-model="settings.applyToListBlocks"
              type="checkbox"
              @change="handleSettingsChange"
            />
            <span>{{ i18n.listBlocks || '列表块' }}</span>
          </label>

          <label class="scope-option">
            <input
              v-model="settings.applyToEmbedBlocks"
              type="checkbox"
              @change="handleSettingsChange"
            />
            <span>{{ i18n.embedBlocks || '嵌入块' }}</span>
          </label>

          <label class="scope-option">
            <input
              v-model="settings.applyToFloatWindows"
              type="checkbox"
              @change="handleSettingsChange"
            />
            <span>{{ i18n.floatWindows || '浮窗' }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import type { ListSettings as IListSettings } from '@/config/settings'
import { loadListSettingsFromDB, saveListSettingsToDB } from '@/config/settings'

interface Props {
  i18n?: any
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null
})

const emit = defineEmits<{
  change: [settings: IListSettings]
}>()

// 默认设置
const defaultSettings: IListSettings = {
  enableCustomUnorderedList: false,
  enableCustomOrderedList: false,
  firstLevelSymbol: '▪',
  secondLevelSymbol: '•',
  thirdLevelSymbol: '◦',
  customFirstLevelSymbol: '',
  customSecondLevelSymbol: '',
  customThirdLevelSymbol: '',
  symbolSize: 1.5,
  symbolMarginLeft: 13,
  numberFormat: 'decimal',
  applyToListBlocks: true,
  applyToEmbedBlocks: true,
  applyToFloatWindows: true
}

// 设置状态
const settings = reactive<IListSettings>({ ...defaultSettings })

// 组件挂载时加载保存的设置
onMounted(async () => {
  if (!props.plugin) {
    console.warn('插件实例不可用，使用默认设置')
    return
  }

  try {
    const loadedSettings = await loadListSettingsFromDB(props.plugin)
    Object.assign(settings, { ...defaultSettings, ...loadedSettings })
    handleSettingsChange()
  } catch (error) {
    console.error('加载列表设置失败:', error)
  }
})

// 生成CSS样式
const generateCSS = (): string => {
  if (!settings.enableCustomUnorderedList && !settings.enableCustomOrderedList) {
    return ''
  }

  let css = '/* 自定义列表样式 */\n'

  // 获取有效的符号
  const getEffectiveSymbol = (defaultSymbol: string, customSymbol: string) => {
    return customSymbol.trim() || defaultSymbol
  }

  const firstSymbol = getEffectiveSymbol(settings.firstLevelSymbol, settings.customFirstLevelSymbol)
  const secondSymbol = getEffectiveSymbol(settings.secondLevelSymbol, settings.customSecondLevelSymbol)
  const thirdSymbol = getEffectiveSymbol(settings.thirdLevelSymbol, settings.customThirdLevelSymbol)

  // 无序列表样式
  if (settings.enableCustomUnorderedList) {
    const selectors = []

    if (settings.applyToListBlocks) {
      selectors.push('[data-subtype="u"]')
    }
    if (settings.applyToEmbedBlocks) {
      selectors.push('[class="protyle-wysiwyg__embed"]')
    }
    if (settings.applyToFloatWindows) {
      selectors.push('[class="protyle-wysiwyg protyle-wysiwyg--attr"][data-doc-type="NodeListItem"]')
    }

    selectors.forEach(selector => {
      css += `
/* ${selector === '[data-subtype="u"]' ? '无序列表块' :
        selector === '[class="protyle-wysiwyg__embed"]' ? '嵌入块' : '浮窗'} */
${selector}>.li[data-subtype="u"]>.protyle-action svg {
    color: transparent;
}

${selector}>.li[data-subtype="u"]>.protyle-action::before {
    font-size: ${settings.symbolSize}em;
    line-height: 1;
    margin-bottom: 0px;
    margin-left: ${settings.symbolMarginLeft}px;
    content: "${firstSymbol}";
}

${selector}>[data-subtype="u"] .li[data-subtype="u"]>.protyle-action::before {
    content: "${secondSymbol}";
}

${selector}>[data-subtype="u"] .li[data-subtype="u"] .li[data-subtype="u"]>.protyle-action::before {
    content: "${thirdSymbol}";
}
`
    })
  }

  // 有序列表样式
  if (settings.enableCustomOrderedList) {
    css += `
/* 有序列表样式 */
[data-subtype="o"] > .li {
    list-style-type: ${settings.numberFormat};
}
`
  }

  return css
}

// 处理设置变化
const handleSettingsChange = async () => {
  const settingsWithCSS = {
    ...settings,
    css: generateCSS()
  }

  emit('change', settingsWithCSS)

  // 自动保存到数据库
  if (props.plugin) {
    try {
      await saveListSettingsToDB(props.plugin, settingsWithCSS)
    } catch (error) {
      console.error('保存列表设置失败:', error)
    }
  }
}

// 暴露方法
defineExpose({
  generateCSS,
  resetToDefaults: () => {
    Object.assign(settings, defaultSettings)
    handleSettingsChange()
  },
  getSettings: () => ({ ...settings })
})
</script>

<style scoped>
.list-settings {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

.settings-container {
  max-width: 600px;
  margin: 0 auto;
}

.setting-section {
  margin-bottom: 24px;
  background: var(--b3-theme-surface);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--b3-theme-surface-variant);
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  display: flex;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--b3-theme-surface-variant);
}

.title-icon {
  margin-right: 8px;
  font-size: 16px;
}

.setting-row {
  margin-bottom: 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.setting-label {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  font-weight: 500;
  min-width: 140px;
  flex-shrink: 0;
}

.label-icon {
  margin-right: 8px;
  font-size: 14px;
}

/* 开关样式 */
.switch-container {
  display: flex;
  align-items: center;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--b3-theme-surface-variant);
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--b3-theme-primary);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

/* 符号选择器 */
.symbol-selector {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.symbol-selector select {
  padding: 6px 12px;
  border: 1px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  min-width: 60px;
}

.custom-symbol-input {
  padding: 6px 12px;
  border: 1px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  width: 120px;
}

/* 格式选择器 */
.format-selector select {
  padding: 6px 12px;
  border: 1px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  min-width: 150px;
}

/* 范围控制 */
.range-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.range-slider {
  flex: 1;
  height: 4px;
  background: var(--b3-theme-surface-variant);
  outline: none;
  border-radius: 2px;
  -webkit-appearance: none;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--b3-theme-primary);
  cursor: pointer;
  border-radius: 50%;
}

.number-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid var(--b3-theme-outline);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  text-align: center;
}

.unit {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  min-width: 20px;
}

/* 范围选项 */
.scope-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scope-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.scope-option:hover {
  background: var(--b3-theme-surface-variant);
}

.scope-option input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--b3-theme-primary);
}

/* 响应式设计 */
@media (max-width: 500px) {
  .list-settings {
    padding: 12px;
  }

  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .setting-label {
    min-width: auto;
  }

  .symbol-selector,
  .format-selector,
  .range-control {
    width: 100%;
  }
}

/* 滚动条样式 */
.list-settings::-webkit-scrollbar {
  width: 6px;
}

.list-settings::-webkit-scrollbar-track {
  background: transparent;
}

.list-settings::-webkit-scrollbar-thumb {
  background: var(--b3-theme-surface-variant);
  border-radius: 3px;
}

.list-settings::-webkit-scrollbar-thumb:hover {
  background: var(--b3-theme-outline);
}
</style>
