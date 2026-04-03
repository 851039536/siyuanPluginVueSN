<template>
  <div class="codeblock-settings">
    <div class="settings-container">
      <!-- 启用代码块样式增强 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">✨</span>
            {{ i18n.enableCodeBlockStyle || '启用代码块样式增强' }}
          </label>
          <div class="toggle-container">
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="settings.enabled"
                class="toggle-input"
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-description">
              {{ settings.enabled ? (i18n.enabled || '已启用') : (i18n.disabled || '已禁用') }}
            </span>
          </div>
        </div>
      </div>

      <!-- 代码块风格选择 -->
      <div v-if="settings.enabled" class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🎨</span>
            {{ i18n.codeBlockStyle || '代码块风格' }}
          </label>
          <!-- 风格卡片选择器 -->
          <div class="style-cards">
            <div
              v-for="style in (['default', 'github', 'mac', 'cartoon'] as const)"
              :key="style"
              :class="['style-card', { active: settings.style === style }]"
              @click="settings.style = style as 'default' | 'github' | 'mac' | 'cartoon'"
            >
              <div class="style-card-icon">
                <span v-if="style === 'default'">📄</span>
                <span v-if="style === 'github'">🐙</span>
                <span v-if="style === 'mac'">🍎</span>
                <span v-if="style === 'cartoon'">🎨</span>
              </div>
              <div class="style-card-name">{{ getStyleName(style) }}</div>
              <div v-if="settings.style === style" class="style-card-check">✓</div>
            </div>
          </div>
        </div>
      </div>
      <!-- 高级设置 -->
      <div v-if="settings.enabled" class="advanced-settings">
        <div class="setting-header">
          <span class="label-icon">⚙️</span>
          <span>{{ i18n.advancedSettings || '高级设置' }}</span>
        </div>

        <!-- 背景色 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🖼️</span>
            {{ i18n.codeBlockBackground || '背景色' }}
          </label>
          <div class="color-picker-container">
            <input
              v-model="settings.backgroundColor"
              type="color"
              class="color-picker"
            />
            <input
              v-model="settings.backgroundColor"
              type="text"
              class="color-input"
              :placeholder="i18n.colorPlaceholder || '输入颜色值'"
            />
          </div>
        </div>

        <!-- 边框设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🔲</span>
            {{ i18n.codeBlockBorder || '边框设置' }}
          </label>
          <div class="border-settings">
            <div class="border-row">
              <label>{{ i18n.borderColor || '边框颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.borderColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.borderColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="border-row">
              <label>{{ i18n.borderWidth || '边框宽度' }}</label>
              <div class="slider-container small">
                <input
                  v-model.number="settings.borderWidth"
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  class="range-slider"
                />
                <span class="slider-value">{{ settings.borderWidth }}px</span>
              </div>
            </div>
            <div class="border-row">
              <label>{{ i18n.borderRadius || '圆角' }}</label>
              <div class="slider-container small">
                <input
                  v-model.number="settings.borderRadius"
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  class="range-slider"
                />
                <span class="slider-value">{{ settings.borderRadius }}px</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 阴影 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🌓</span>
            {{ i18n.codeBlockShadow || '阴影' }}
          </label>
          <div class="shadow-options">
            <button
              v-for="shadow in shadowOptions"
              :key="shadow.value"
              :class="['shadow-btn', { active: settings.boxShadow === shadow.value }]"
              @click="settings.boxShadow = shadow.value"
            >
              {{ shadow.label }}
            </button>
          </div>
        </div>

        <!-- 行号设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🔢</span>
            {{ i18n.lineNumberSettings || '行号设置' }}
          </label>
          <div class="toggle-container">
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="settings.showLineNumber"
                class="toggle-input"
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-description">
              {{ settings.showLineNumber ? (i18n.showLineNumber || '显示行号') : (i18n.hideLineNumber || '隐藏行号') }}
            </span>
          </div>
          <div v-if="settings.showLineNumber" class="sub-settings">
            <div class="sub-setting-row">
              <label>{{ i18n.lineNumberColor || '行号颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.lineNumberColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.lineNumberColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="sub-setting-row">
              <label>{{ i18n.lineNumberBackground || '行号背景' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.lineNumberBackground"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.lineNumberBackground"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 代码字体设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🔤</span>
            {{ i18n.codeFontSettings || '代码字体' }}
          </label>
          <div class="font-settings">
            <div class="font-row">
              <label>{{ i18n.fontFamily || '字体族' }}</label>
              <div class="input-group">
                <input
                  v-model="settings.codeFontFamily"
                  type="text"
                  class="text-input font-input"
                  :placeholder="i18n.fontFamilyPlaceholder || '输入字体名称'"
                />
                <select v-model="presetCodeFont" class="font-select" @change="applyPresetCodeFont">
                  <option value="">{{ i18n.selectFont || '选择字体' }}</option>
                  <option value="Consolas">Consolas</option>
                  <option value="Monaco">Monaco</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Fira Code">Fira Code</option>
                  <option value="Source Code Pro">Source Code Pro</option>
                  <option value="JetBrains Mono">JetBrains Mono</option>
                </select>
              </div>
            </div>
            <div class="font-row">
              <label>{{ i18n.fontSize || '字体大小' }}</label>
              <div class="slider-container small">
                <input
                  v-model.number="settings.codeFontSize"
                  type="range"
                  min="10"
                  max="20"
                  step="1"
                  class="range-slider"
                />
                <span class="slider-value">{{ settings.codeFontSize }}px</span>
              </div>
            </div>
            <div class="font-row">
              <label>{{ i18n.lineHeight || '行高' }}</label>
              <div class="slider-container small">
                <input
                  v-model.number="settings.codeLineHeight"
                  type="range"
                  min="1.2"
                  max="2.0"
                  step="0.1"
                  class="range-slider"
                />
                <span class="slider-value">{{ settings.codeLineHeight }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 代码颜色设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🎨</span>
            {{ i18n.codeColorSettings || '代码颜色' }}
          </label>
          <div class="color-settings">
            <div class="color-row">
              <label>{{ i18n.textColor || '文本颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.textColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.textColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="color-row">
              <label>{{ i18n.keywordColor || '关键字颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.keywordColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.keywordColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="color-row">
              <label>{{ i18n.stringColor || '字符串颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.stringColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.stringColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="color-row">
              <label>{{ i18n.commentColor || '注释颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.commentColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.commentColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="color-row">
              <label>{{ i18n.functionColor || '函数颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.functionColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.functionColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="color-row">
              <label>{{ i18n.numberColor || '数字颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.numberColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.numberColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 代码块折叠设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">📦</span>
            {{ i18n.codeBlockCollapse || '代码块折叠' }}
          </label>
          <div class="toggle-container">
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="settings.enableCollapse"
                class="toggle-input"
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-description">
              {{ settings.enableCollapse ? (i18n.collapseEnabled || '已启用') : (i18n.collapseDisabled || '已禁用') }}
            </span>
          </div>
        </div>
        <!-- 折叠高度设置 -->
        <div v-if="settings.enableCollapse" class="setting-item">
          <label class="setting-label">
            <span class="label-icon">📏</span>
            {{ i18n.collapseHeight || '折叠高度' }}
            <span class="setting-value">{{ settings.collapseHeight }}px</span>
          </label>
          <div class="slider-container">
            <input
              v-model.number="settings.collapseHeight"
              type="range"
              min="200"
              max="800"
              step="50"
              class="range-slider"
            />
            <div class="slider-labels">
              <span>200px</span>
              <span>800px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { saveCodeBlockSettings, loadCodeBlockSettings } from '@/config/settings'
import { applyCodeBlockStyle } from '../types'

interface CodeBlockSettings {
  style: 'default' | 'github' | 'mac' | 'cartoon'
  enableCollapse: boolean
  collapseHeight: number
  // 样式增强
  enabled: boolean
  backgroundColor: string
  borderColor: string
  borderWidth: number
  borderRadius: number
  boxShadow: string
  // 行号样式
  lineNumberColor: string
  lineNumberBackground: string
  showLineNumber: boolean
  // 代码字体
  codeFontFamily: string
  codeFontSize: number
  codeLineHeight: number
  // 代码颜色
  textColor: string
  keywordColor: string
  stringColor: string
  commentColor: string
  functionColor: string
  numberColor: string
}

interface Props {
  i18n?: any
  plugin?: any
  initialSettings?: CodeBlockSettings
}

interface Emits {
  (e: 'change', settings: CodeBlockSettings): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
  initialSettings: () => ({
    style: 'default',
    enableCollapse: true,
    collapseHeight: 400,
    enabled: false,
    backgroundColor: '#282c34',
    borderColor: '#3e4451',
    borderWidth: 1,
    borderRadius: 6,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    lineNumberColor: '#abb2bf',
    lineNumberBackground: '#21252b',
    showLineNumber: true,
    codeFontFamily: 'Consolas',
    codeFontSize: 14,
    codeLineHeight: 1.6,
    textColor: '#abb2bf',
    keywordColor: '#c678dd',
    stringColor: '#98c379',
    commentColor: '#5c6370',
    functionColor: '#61afef',
    numberColor: '#d19a66'
  })
})

const emit = defineEmits<Emits>()

const settings = ref<CodeBlockSettings>({ ...props.initialSettings })
const presetCodeFont = ref('')

const DEFAULT_SETTINGS: CodeBlockSettings = {
  style: 'default',
  enableCollapse: true,
  collapseHeight: 400,
  enabled: false,
  backgroundColor: '#282c34',
  borderColor: '#3e4451',
  borderWidth: 1,
  borderRadius: 6,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  lineNumberColor: '#abb2bf',
  lineNumberBackground: '#21252b',
  showLineNumber: true,
  codeFontFamily: 'Consolas',
  codeFontSize: 14,
  codeLineHeight: 1.6,
  textColor: '#abb2bf',
  keywordColor: '#c678dd',
  stringColor: '#98c379',
  commentColor: '#5c6370',
  functionColor: '#61afef',
  numberColor: '#d19a66'
}

const shadowOptions = [
  { label: props.i18n.noneShadow || '无阴影', value: 'none' },
  { label: props.i18n.lightShadow || '轻阴影', value: '0 2px 8px rgba(0, 0, 0, 0.1)' },
  { label: props.i18n.mediumShadow || '中阴影', value: '0 4px 12px rgba(0, 0, 0, 0.15)' },
  { label: props.i18n.heavyShadow || '重阴影', value: '0 8px 24px rgba(0, 0, 0, 0.2)' }
]

watch(settings, async (newSettings) => {
  emit('change', newSettings)
  applyCodeBlockStyle(newSettings.style)
  applyCodeBlockCollapse(newSettings.enableCollapse, newSettings.collapseHeight)
  if (newSettings.enabled) {
    applyCodeBlockEnhancedStyles(newSettings)
  }
  if (props.plugin) {
    try {
      await saveCodeBlockSettings(props.plugin, newSettings)
    } catch (error) {
      console.error('自动保存失败:', error)
    }
  }
}, { deep: true })

function applyPresetCodeFont() {
  if (presetCodeFont.value) {
    settings.value.codeFontFamily = presetCodeFont.value
  }
}

function applyCodeBlockEnhancedStyles(codeSettings: CodeBlockSettings) {
  try {
    // 移除现有样式
    const existingStyle = document.getElementById('codeblock-enhanced-style')
    if (existingStyle) {
      existingStyle.remove()
    }

    if (!codeSettings.enabled) {
      return
    }

    // 创建新的样式元素
    const style = document.createElement('style')
    style.id = 'codeblock-enhanced-style'

    style.textContent = `
      /* 代码块基础样式 */
      .protyle-wysiwyg .code-block {
        background-color: ${codeSettings.backgroundColor} !important;
        border: ${codeSettings.borderWidth}px solid ${codeSettings.borderColor} !important;
        border-radius: ${codeSettings.borderRadius}px !important;
        box-shadow: ${codeSettings.boxShadow !== 'none' ? codeSettings.boxShadow : 'none'} !important;
      }

      /* 代码块内容 */
      .protyle-wysiwyg .code-block .hljs {
        font-family: '${codeSettings.codeFontFamily}', monospace !important;
        font-size: ${codeSettings.codeFontSize}px !important;
        line-height: ${codeSettings.codeLineHeight} !important;
        color: ${codeSettings.textColor} !important;
      }

      /* 行号样式 */
      .protyle-wysiwyg .code-block .hljs .ln {
        color: ${codeSettings.lineNumberColor} !important;
        background-color: ${codeSettings.lineNumberBackground} !important;
      }

      ${codeSettings.showLineNumber ? '' : `
      /* 隐藏行号 */
      .protyle-wysiwyg .code-block .hljs .ln {
        display: none !important;
      }
      `}

      /* 代码高亮颜色 */
      .protyle-wysiwyg .code-block .hljs-keyword,
      .protyle-wysiwyg .code-block .hljs-selector-tag,
      .protyle-wysiwyg .code-block .hljs-built_in,
      .protyle-wysiwyg .code-block .hljs-name,
      .protyle-wysiwyg .code-block .hljs-tag {
        color: ${codeSettings.keywordColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-string,
      .protyle-wysiwyg .code-block .hljs-title,
      .protyle-wysiwyg .code-block .hljs-section,
      .protyle-wysiwyg .code-block .hljs-attribute,
      .protyle-wysiwyg .code-block .hljs-literal,
      .protyle-wysiwyg .code-block .hljs-template-tag,
      .protyle-wysiwyg .code-block .hljs-template-variable,
      .protyle-wysiwyg .code-block .hljs-type {
        color: ${codeSettings.stringColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-comment,
      .protyle-wysiwyg .code-block .hljs-quote {
        color: ${codeSettings.commentColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-function {
        color: ${codeSettings.functionColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-number {
        color: ${codeSettings.numberColor} !important;
      }

      /* 预览区域代码块 */
      .b3-typography pre,
      .b3-typography pre code {
        font-family: '${codeSettings.codeFontFamily}', monospace !important;
        font-size: ${codeSettings.codeFontSize}px !important;
        line-height: ${codeSettings.codeLineHeight} !important;
        background-color: ${codeSettings.backgroundColor} !important;
        border: ${codeSettings.borderWidth}px solid ${codeSettings.borderColor} !important;
        border-radius: ${codeSettings.borderRadius}px !important;
        color: ${codeSettings.textColor} !important;
      }

      /* 暗色主题适配 */
      :root[data-theme-mode="dark"] .protyle-wysiwyg .code-block {
        box-shadow: ${codeSettings.boxShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none'} !important;
      }
    `

    document.head.appendChild(style)
  } catch (error) {
    console.error('应用代码块增强样式失败:', error)
  }
}

function getStyleName(style: string): string {
  const names: Record<string, string> = {
    default: props.i18n.defaultStyle || '默认风格',
    github: props.i18n.githubStyle || 'GitHub 风格',
    mac: props.i18n.macStyle || 'Mac 风格',
    cartoon: props.i18n.cartoonStyle || '卡通风格'
  }
  return names[style] || style
}

function applyCodeBlockCollapse(enable: boolean, height: number) {
  // 移除现有的折叠样式和功能
  const existingStyle = document.getElementById('codeblock-collapse-style')
  if (existingStyle) {
    existingStyle.remove()
  }

  const existingScript = document.getElementById('codeblock-collapse-script')
  if (existingScript) {
    existingScript.remove()
  }

  if (!enable) {
    return
  }

  // 添加折叠样式 - GitHub 风格
  const style = document.createElement('style')
  style.id = 'codeblock-collapse-style'
  style.innerHTML = `
    /* GitHub 风格折叠按钮 */
    .code-block .code-expand-wrapper {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 70px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      background: linear-gradient(to bottom,
        transparent 0%,
        rgba(var(--b3-theme-background-rgb, 255, 255, 255), 0.7) 30%,
        rgba(var(--b3-theme-background-rgb, 255, 255, 255), 0.95) 70%,
        rgba(var(--b3-theme-background-rgb, 255, 255, 255), 1) 100%
      );
    }

    .code-block .code-expand-btn {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      background: var(--b3-theme-surface);
      border: 1px solid rgba(var(--b3-theme-on-surface-rgb, 0, 0, 0), 0.15);
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: var(--b3-theme-on-surface);
      transition: all 0.15s ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      line-height: 1.5;
    }

    .code-block .code-expand-btn:hover {
      background: var(--b3-theme-surface-variant);
      border-color: rgba(var(--b3-theme-on-surface-rgb, 0, 0, 0), 0.25);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .code-block .code-expand-btn:active {
      background: var(--b3-theme-outline);
      transform: scale(0.98);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .code-block .code-expand-icon {
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .code-block .code-expand-icon svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }

    /* 折叠状态下的代码块高度限制 */
    div:not(#preview) > .protyle-wysiwyg .code-block .hljs {
      max-height: ${height}px;
    }

    /* 深色主题适配 */
    [data-theme-mode="dark"] .code-block .code-expand-wrapper {
      background: linear-gradient(to bottom,
        transparent 0%,
        rgba(var(--b3-theme-background-rgb, 31, 31, 31), 0.7) 30%,
        rgba(var(--b3-theme-background-rgb, 31, 31, 31), 0.95) 70%,
        rgba(var(--b3-theme-background-rgb, 31, 31, 31), 1) 100%
      );
    }

    /* 移动端适配 */
    @media (max-width: 768px) {
      .code-block .code-expand-btn {
        padding: 8px 20px;
        font-size: 13px;
      }

      .code-block .code-expand-wrapper {
        height: 100px;
      }
    }
  `
  document.head.appendChild(style)

  // 添加折叠功能脚本
  const script = document.createElement('script')
  script.id = 'codeblock-collapse-script'
  script.innerHTML = `
    (function() {
      const codeMaxHeight = ${height};
      let running = false;

      function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      }

      function addCodeExtends(codeBlocks) {
        if(codeBlocks.length === 0) return;
        if(running) return;
        running = true;
        setTimeout(() => {running = false;}, 300);
        codeBlocks.forEach(async codeBlock => {
          if(isCursorInCodeBlock(codeBlock)) {
            const hljs = codeBlock.querySelector('.hljs');
            if(hljs) hljs.style.maxHeight = '100%';
            return;
          }
          if(codeBlock.querySelector('.code-expand-wrapper')) return;
          const hljs = await whenElementExist(() => codeBlock.querySelector('.hljs'));
          if(hljs && hljs.scrollHeight > codeMaxHeight) {
            const expandWrapper = document.createElement('div');
            expandWrapper.className = 'code-expand-wrapper protyle-custom';
            const expandText = document.documentElement.lang === 'zh_CN' ? '展开代码' : 'Expand Code';
            expandWrapper.innerHTML = \`
              <button class="code-expand-btn">
                <span class="code-expand-icon">
                  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"/>
                  </svg>
                </span>
                <span>\${expandText}</span>
              </button>
            \`;
            codeBlock.appendChild(expandWrapper);
            hljs.style.maxHeight = codeMaxHeight + 'px';

            expandWrapper.querySelector('.code-expand-btn').onclick = () => {
              // 添加展开动画
              expandWrapper.style.transition = 'opacity 0.2s ease';
              expandWrapper.style.opacity = '0';
              expandWrapper.style.pointerEvents = 'none';

              // 平滑展开代码块
              hljs.style.transition = 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
              hljs.style.maxHeight = hljs.scrollHeight + 'px';

              setTimeout(() => {
                hljs.style.maxHeight = '100%';
                expandWrapper.remove();
              }, 400);
            };
          }
        });
      }

      function isCursorInCodeBlock(codeBlock) {
        if(!codeBlock) return false;
        let cursorEl = getCursorElement();
        if(!cursorEl) return false;
        cursorEl = cursorEl.closest('.code-block');
        if(!cursorEl) return false;
        return cursorEl === codeBlock;
      }

      function getCursorElement() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const startContainer = range.startContainer;
          const cursorElement = startContainer.nodeType === Node.TEXT_NODE
              ? startContainer.parentElement
              : startContainer;
          return cursorElement;
        }
        return null;
      }

      function whenElementExist(selector) {
        return new Promise(resolve => {
          const checkForElement = () => {
            let element = null;
            if (typeof selector === 'function') {
              element = selector();
            } else {
              element = document.querySelector(selector);
            }
            if (element) {
              resolve(element);
            } else {
              requestAnimationFrame(checkForElement);
            }
          };
          checkForElement();
        });
      }

      function observeProtyleAddition(el, callback) {
        const config = { attributes: false, childList: true, subtree: true };
        const observer = new MutationObserver((mutationsList, observer) => {
          mutationsList.forEach(mutation => {
            if (mutation.type === 'childList') {
              const protyles = Array.from(mutation.addedNodes).filter(node =>
                node.nodeType === Node.ELEMENT_NODE &&
                (node.classList.contains('protyle') || node.classList.contains('protyle-content'))
              );
              if (protyles.length > 0) {
                callback(protyles);
              }
            }
          });
        });
        observer.observe(el, config);
        return () => {
          observer.disconnect();
        };
      }

      // 初始化代码块折叠功能
      function initCodeBlockCollapse() {
        whenElementExist('body').then(async el => {
          let protyle;
          await whenElementExist(() => {
            protyle = el.querySelector('.protyle');
            return protyle && protyle?.dataset?.loading === 'finished';
          });
          addCodeExtends(protyle.querySelectorAll('.code-block'));

          let scrollContainer = isMobile() ? window : protyle.querySelector(".protyle-content");
          let debounceTimer;
          scrollContainer.addEventListener('scroll', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              addCodeExtends(protyle.querySelectorAll('.code-block'));
            }, 100);
          });

          observeProtyleAddition(el, protyles => {
            protyles.forEach(async protyle => {
              if(!protyle.classList.contains('protyle')) {
                protyle = protyle.closest('.protyle');
              }
              addCodeExtends(protyle.querySelectorAll('.code-block'));
              let scrollContainer = isMobile() ? window : protyle.querySelector(".protyle-content");
              scrollContainer.addEventListener('scroll', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                  addCodeExtends(protyle.querySelectorAll('.code-block'));
                }, 100);
              });
            });
          });
        });
      }

      // 如果页面已加载，立即初始化
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCodeBlockCollapse);
      } else {
        initCodeBlockCollapse();
      }
    })();
  `
  document.head.appendChild(script)
}

// 加载保存的设置
async function loadSettings() {
  if (!props.plugin) {
    console.warn('插件实例不可用，使用默认设置')
    return
  }

  try {
    const loadedSettings = await loadCodeBlockSettings(props.plugin)
    settings.value = { ...DEFAULT_SETTINGS, ...loadedSettings }
    applyCodeBlockStyle(settings.value.style)
    if (settings.value.enabled) {
      applyCodeBlockEnhancedStyles(settings.value)
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

// 初始化时加载设置并应用样式
onMounted(async () => {
  await loadSettings()
  // 确保在页面加载时应用保存的样式
  applyCodeBlockStyle(settings.value.style)
  applyCodeBlockCollapse(settings.value.enableCollapse, settings.value.collapseHeight)
})

// 暴露方法
defineExpose({
  loadSettings,
  settings
})
</script>

<style scoped lang="scss">
@use "./styles/CodeBlockSettings.scss";

</style>
