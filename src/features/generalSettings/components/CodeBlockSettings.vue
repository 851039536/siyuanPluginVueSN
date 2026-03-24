<template>
  <div class="codeblock-settings">
    <div class="settings-container">
      <!-- 代码块风格选择 -->
      <div class="setting-row">
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
      <div class="advanced-settings">
        <div class="setting-header">
          <span class="label-icon">⚙️</span>
          <span>{{ i18n.advancedSettings || '高级设置' }}</span>
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
      <!-- 预览区域 -->
      <div class="preview-section">
        <div class="preview-toggle" @click="togglePreview">
          <span class="preview-icon">{{ showPreview ? '👁️' : '👁️‍🗨️' }}</span>
          <span>{{ i18n.preview || '预览效果' }}</span>
          <span class="toggle-arrow" :class="{ expanded: showPreview }">▼</span>
        </div>
        <transition name="preview-expand">
          <div v-show="showPreview" class="preview-content">
            <div class="preview-box" :class="`style-${settings.style}`">
              <!-- Mac 风格头部 -->
              <div v-if="settings.style === 'mac'" class="mac-header">
                <div class="mac-buttons">
                  <span class="mac-btn close"></span>
                  <span class="mac-btn minimize"></span>
                  <span class="mac-btn maximize"></span>
                </div>
                <div class="mac-title">JavaScript</div>
              </div>
              <!-- GitHub 风格头部 -->
              <div v-if="settings.style === 'github'" class="github-header">
                <span class="github-lang">JavaScript</span>
              </div>
              <!-- 卡通风格头部 -->
              <div v-if="settings.style === 'cartoon'" class="cartoon-header">
                <div class="cartoon-decoration">
                  <span class="cartoon-dot" style="background: #ff6b9d"></span>
                  <span class="cartoon-dot" style="background: #feca57"></span>
                  <span class="cartoon-dot" style="background: #48dbfb"></span>
                  <span class="cartoon-dot" style="background: #1dd1a1"></span>
                </div>
                <div class="cartoon-title">✨ JavaScript ✨</div>
              </div>
              <!-- 代码内容 - 所有风格共用 -->
              <div class="code-content" :style="{ maxHeight: settings.enableCollapse ? settings.collapseHeight + 'px' : 'none', overflow: settings.enableCollapse ? 'hidden' : 'auto' }">
                <div class="code-line">
                  <span class="line-number">1</span>
                  <span class="code-text">
                    <span class="keyword">function</span> <span class="function">greet</span><span class="punctuation">(</span><span class="parameter">name</span><span class="punctuation">)</span> <span class="punctuation">{</span>
                  </span>
                </div>
                <div class="code-line">
                  <span class="line-number">2</span>
                  <span class="code-text">
                    <span class="indent">  </span><span class="keyword">const</span> <span class="variable">message</span> <span class="operator">=</span> <span class="string">`Hello, ${name}!`</span><span class="punctuation">;</span>
                  </span>
                </div>
                <div class="code-line">
                  <span class="line-number">3</span>
                  <span class="code-text">
                    <span class="indent">  </span><span class="variable">console</span><span class="punctuation">.</span><span class="method">log</span><span class="punctuation">(</span><span class="variable">message</span><span class="punctuation">);</span>
                  </span>
                </div>
                <div class="code-line">
                  <span class="line-number">4</span>
                  <span class="code-text">
                    <span class="indent">  </span><span class="keyword">return</span> <span class="boolean">true</span><span class="punctuation">;</span>
                  </span>
                </div>
                <div class="code-line">
                  <span class="line-number">5</span>
                  <span class="code-text">
                    <span class="indent">  </span><span class="keyword">return</span> <span class="boolean">false</span><span class="punctuation">;</span>
                  </span>
                </div>
                <div class="code-line">
                  <span class="line-number">6</span>
                  <span class="code-text">
                    <span class="indent">  </span><span class="keyword">return</span> <span class="boolean">null</span><span class="punctuation">;</span>
                  </span>
                </div>
                <div class="code-line">
                  <span class="line-number">7</span>
                  <span class="code-text">
                    <span class="indent">  </span><span class="keyword">return</span> <span class="boolean">undefined</span><span class="punctuation">;</span>
                  </span>
                </div>
                <div class="code-line">
                  <span class="line-number">8</span>
                  <span class="code-text">
                    <span class="indent">  </span><span class="keyword">return</span> <span class="string">""</span><span class="punctuation">;</span>
                  </span>
                </div>
                <div class="code-line">
                  <span class="line-number">9</span>
                  <span class="code-text">
                    <span class="indent">  </span><span class="keyword">return</span> <span class="number">0</span><span class="punctuation">;</span>
                  </span>
                </div>
                <div class="code-line">
                  <span class="line-number">10</span>
                  <span class="code-text">
                    <span class="indent">  </span><span class="keyword">return</span> <span class="punctuation">[]</span><span class="punctuation">;</span>
                  </span>
                </div>
                <div class="code-line">
                  <span class="line-number">11</span>
                  <span class="code-text">
                    <span class="indent">  </span><span class="keyword">return</span> <span class="punctuation">{}</span><span class="punctuation">;</span>
                  </span>
                </div>
                <div class="code-line">
                  <span class="line-number">12</span>
                  <span class="code-text">
                    <span class="punctuation">}</span>
                  </span>
                </div>
              </div>
              <!-- 折叠预览指示器 -->
              <div v-if="settings.enableCollapse" class="collapse-preview-indicator">
                <span class="collapse-text">{{ i18n.collapsePreview || '折叠预览' }}</span>
                <span class="collapse-height">{{ settings.collapseHeight }}px</span>
              </div>
            </div>
            <div class="preview-info">
              <span class="info-item">{{ getStyleName(settings.style) }}</span>
            </div>
          </div>
        </transition>
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
    collapseHeight: 400
  })
})

const emit = defineEmits<Emits>()

const settings = ref<CodeBlockSettings>({ ...props.initialSettings })
const showPreview = ref(true)

const DEFAULT_SETTINGS: CodeBlockSettings = {
  style: 'default',
  enableCollapse: true,
  collapseHeight: 400
}

watch(settings, async (newSettings) => {
  emit('change', newSettings)
  applyCodeBlockStyle(newSettings.style)
  applyCodeBlockCollapse(newSettings.enableCollapse, newSettings.collapseHeight)
  if (props.plugin) {
    try {
      await saveCodeBlockSettings(props.plugin, newSettings)
    } catch (error) {
      console.error('自动保存失败:', error)
    }
  }
}, { deep: true })

function togglePreview() {
  showPreview.value = !showPreview.value
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
