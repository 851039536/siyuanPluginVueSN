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

        <!-- 字体大小 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">📏</span>
            {{ i18n.fontSize || '字体大小' }}
            <span class="setting-value">{{ settings.fontSize }}px</span>
          </label>
          <div class="slider-container">
            <input
              v-model.number="settings.fontSize"
              type="range"
              min="10"
              max="20"
              step="1"
              class="range-slider"
            />
            <div class="slider-labels">
              <span>10px</span>
              <span>20px</span>
            </div>
          </div>
        </div>

        <!-- 内边距 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">📐</span>
            {{ i18n.codePadding || '代码间距' }}
            <span class="setting-value">{{ settings.padding }}px</span>
          </label>
          <div class="slider-container">
            <input
              v-model.number="settings.padding"
              type="range"
              min="8"
              max="32"
              step="2"
              class="range-slider"
            />
            <div class="slider-labels">
              <span>8px</span>
              <span>32px</span>
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
import { showMessage } from 'siyuan'

interface CodeBlockSettings {
  style: 'default' | 'github' | 'mac' | 'cartoon'
  fontSize: number
  padding: number
  enableCollapse: boolean
  collapseHeight: number
}

interface Props {
  i18n?: any
  initialSettings?: CodeBlockSettings
}

interface Emits {
  (e: 'change', settings: CodeBlockSettings): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  initialSettings: () => ({
    style: 'default',
    fontSize: 13,
    padding: 14,
    enableCollapse: true,
    collapseHeight: 400
  })
})

const emit = defineEmits<Emits>()

const settings = ref<CodeBlockSettings>({ ...props.initialSettings })
const showPreview = ref(true)

const DEFAULT_SETTINGS: CodeBlockSettings = {
  style: 'default',
  fontSize: 13,
  padding: 14,
  enableCollapse: true,
  collapseHeight: 400
}

// 监听设置变化，自动保存
watch(settings, (newSettings) => {
  emit('change', newSettings)
  applyCodeBlockStyle(newSettings.style)
  applyCodeBlockCollapse(newSettings.enableCollapse, newSettings.collapseHeight)
  // 自动保存到 localStorage
  try {
    localStorage.setItem('general-codeblock-settings', JSON.stringify(newSettings))
  } catch (error) {
    console.error('自动保存失败:', error)
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

function applyCodeBlockStyle(style: string) {
  // 移除旧的样式类
  document.body.classList.remove('codeblock-style-default', 'codeblock-style-github', 'codeblock-style-mac', 'codeblock-style-cartoon')
  // 添加新的样式类
  document.body.classList.add(`codeblock-style-${style}`)

  // 应用字体大小和间距
  applyCodeBlockCustomization()
}

function applyCodeBlockCustomization() {
  const root = document.documentElement
  root.style.setProperty('--codeblock-font-size', `${settings.value.fontSize}px`)
  root.style.setProperty('--codeblock-padding', `${settings.value.padding}px`)
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
function loadSettings() {
  try {
    const saved = localStorage.getItem('general-codeblock-settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      settings.value = { ...DEFAULT_SETTINGS, ...parsed }
      applyCodeBlockStyle(settings.value.style)
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

// 初始化时加载设置并应用样式
onMounted(() => {
  loadSettings()
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

<style scoped>
.codeblock-settings {
  padding: 16px;
  box-sizing: border-box;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 100%;
}

.setting-row {
  display: flex;
  width: 100%;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin: 0;
}

.label-icon {
  font-size: 14px;
  opacity: 0.8;
}

/* 风格卡片选择器 */
.style-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  width: 100%;
}

.style-card {
  position: relative;
  padding: 16px 12px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 12px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--b3-theme-primary), var(--b3-theme-primary-container));
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    border-color: var(--b3-theme-primary);

    &::before {
      opacity: 0.05;
    }
  }

  &.active {
    border-color: var(--b3-theme-primary);
    border-width: 3px;
    background: linear-gradient(135deg,
      rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.1),
      rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.05)
    );

    &::before {
      opacity: 0.1;
    }
  }
}

.style-card-icon {
  font-size: 32px;
  transition: transform 0.3s ease;
  position: relative;
  z-index: 1;
}

.style-card:hover .style-card-icon {
  transform: scale(1.1) rotate(5deg);
}

.style-card.active .style-card-icon {
  transform: scale(1.15);
}

.style-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  text-align: center;
  position: relative;
  z-index: 1;
}

.style-card-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  animation: checkBounce 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  z-index: 2;
}

@keyframes checkBounce {
  0% {
    transform: scale(0) rotate(-180deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.2) rotate(10deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

/* 高级设置 */
.advanced-settings {
  padding: 16px;
  background: var(--b3-theme-surface);
  border: 2px solid var(--b3-theme-outline);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  padding-bottom: 8px;
  border-bottom: 2px solid var(--b3-theme-outline);
}

.setting-value {
  margin-left: auto;
  font-size: 12px;
  padding: 2px 8px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-radius: 12px;
  font-weight: 600;
}

.slider-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.range-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--b3-theme-surface-variant);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  transition: all 0.2s ease;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  cursor: pointer;
  border: 3px solid var(--b3-theme-background);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.range-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
}

.range-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  cursor: pointer;
  border: 3px solid var(--b3-theme-background);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.range-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
  font-weight: 500;
  padding: 0 4px;
}

/* 预览区域 */
.preview-section {
  border: 2px solid var(--b3-theme-outline);
  border-radius: 12px;
  overflow: hidden;
  background: var(--b3-theme-surface);
}

.preview-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--b3-theme-surface-variant);
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.preview-toggle:hover {
  background: var(--b3-theme-outline);
}

.preview-icon {
  font-size: 16px;
}

.toggle-arrow {
  margin-left: auto;
  transition: transform 0.3s ease;
  font-size: 12px;
}

.toggle-arrow.expanded {
  transform: rotate(180deg);
}

.preview-expand-enter-active,
.preview-expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.preview-expand-enter-from,
.preview-expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.preview-expand-enter-to,
.preview-expand-leave-from {
  max-height: 400px;
  opacity: 1;
}

.preview-content {
  padding: 16px;
  border-top: 1px solid var(--b3-theme-outline);
  background: var(--b3-theme-background);
}

.preview-box {
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  }
}

/* 默认风格 */
.preview-box.style-default {
  border: 1px solid var(--b3-theme-outline);
  background: var(--b3-theme-surface);
}

.preview-box.style-default .code-content {
  padding: 16px 14px;
  background: var(--b3-theme-surface-variant);
  color: var(--b3-theme-on-surface);
  border-left: 3px solid var(--b3-theme-primary);
}

/* GitHub 风格 - 深色主题适配 */
.preview-box.style-github {
  border: 1px solid var(--b3-theme-outline);
  background: var(--b3-theme-surface);
}

.github-header {
  padding: 8px 12px;
  background: linear-gradient(to bottom, var(--b3-theme-surface-variant), var(--b3-theme-surface));
  border-bottom: 1px solid var(--b3-theme-outline);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
  min-height: 36px;
  position: relative;
}

.github-lang {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  font-weight: 600;
  letter-spacing: 0.5px;
}

.preview-box.style-github .code-content {
  padding: 16px 14px;
  padding-top: 12px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(to bottom, #61afef, #98c379);
    opacity: 0.6;
  }
}

/* Mac 风格 - 深色主题适配 */
.preview-box.style-mac {
  border: 1px solid var(--b3-theme-outline);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.mac-header {
  padding: 8px 12px;
  background: linear-gradient(to bottom, var(--b3-theme-surface-variant), var(--b3-theme-surface));
  border-bottom: 1px solid var(--b3-theme-outline);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
  min-height: 36px;
}

.mac-buttons {
  display: flex;
  gap: 6px;
}

.mac-btn {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover {
    transform: scale(1.1);

    &::after {
      opacity: 1;
    }
  }
}

.mac-btn.close {
  background: #ff5f56;
  border: 1px solid #e0443e;

  &:hover::after {
    background: radial-gradient(circle, rgba(255, 95, 86, 0.3) 0%, transparent 70%);
  }
}

.mac-btn.minimize {
  background: #ffbd2e;
  border: 1px solid #dea123;

  &:hover::after {
    background: radial-gradient(circle, rgba(255, 189, 46, 0.3) 0%, transparent 70%);
  }
}

.mac-btn.maximize {
  background: #27c93f;
  border: 1px solid #1aab29;

  &:hover::after {
    background: radial-gradient(circle, rgba(39, 201, 63, 0.3) 0%, transparent 70%);
  }
}

.mac-title {
  flex: 1;
  text-align: center;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  font-weight: 600;
}

.preview-box.style-mac .code-content {
  padding: 16px 14px;
  padding-top: 12px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--b3-theme-outline), transparent);
    opacity: 0.3;
  }
}

/* 卡通风格 */
.preview-box.style-cartoon {
  border: 2px solid;
  border-image: linear-gradient(135deg, #ff6b9d, #feca57, #48dbfb, #1dd1a1) 1;
  box-shadow: 0 3px 12px rgba(255, 107, 157, 0.25);
  background: var(--b3-theme-surface);
}

.cartoon-header {
  padding: 8px 12px;
  background: linear-gradient(135deg,
    rgba(255, 107, 157, 0.08),
    rgba(254, 202, 87, 0.08),
    rgba(72, 219, 251, 0.08),
    rgba(29, 209, 161, 0.08)
  );
  border-bottom: 1px dashed var(--b3-theme-outline);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
}

.cartoon-decoration {
  display: flex;
  gap: 6px;
  align-items: center;
}

.cartoon-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  animation: cartoonBounce 2s ease-in-out infinite;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);

  &:nth-child(1) { animation-delay: 0s; }
  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.4s; }
  &:nth-child(4) { animation-delay: 0.6s; }
}

@keyframes cartoonBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-4px) scale(1.1); }
}

.cartoon-title {
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, #ff6b9d, #feca57, #48dbfb, #1dd1a1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.5px;
}

.preview-box.style-cartoon .code-content {
  padding: 16px 14px;
  padding-top: 12px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  position: relative;

  &::before {
    content: '✨';
    position: absolute;
    top: 6px;
    right: 6px;
    font-size: 12px;
    opacity: 0.25;
    animation: sparkle 3s ease-in-out infinite;
  }
}

@keyframes sparkle {
  0%, 100% { opacity: 0.3; transform: rotate(0deg) scale(1); }
  50% { opacity: 0.8; transform: rotate(180deg) scale(1.2); }
}

.code-content {
  margin: 0;
  font-family: 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--b3-theme-on-surface);
  overflow-x: auto;
}

.code-line {
  display: flex;
  align-items: flex-start;
  min-height: 20px;
  transition: background-color 0.15s ease;
}

.code-line:hover {
  background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08);
}

.line-number {
  display: inline-block;
  min-width: 32px;
  padding-right: 12px;
  text-align: right;
  color: var(--b3-theme-on-surface-variant);
  opacity: 0.5;
  user-select: none;
  font-size: 12px;
  flex-shrink: 0;
}

.code-text {
  flex: 1;
  white-space: pre;
  word-break: break-all;
}

/* 语法高亮 */
.keyword {
  color: #c678dd;
  font-weight: 600;
}

.function {
  color: #61afef;
  font-weight: 500;
}

.variable {
  color: #e06c75;
}

.string {
  color: #98c379;
}

.number {
  color: #d19a66;
}

.boolean {
  color: #d19a66;
}

.operator {
  color: #56b6c2;
}

.punctuation {
  color: #abb2bf;
}

.parameter {
  color: #e5c07b;
}

.method {
  color: #61afef;
}

.comment {
  color: #5c6370;
  font-style: italic;
}

.indent {
  opacity: 0;
}

/* 深色主题下的语法高亮调整 */
@media (prefers-color-scheme: dark) {
  .keyword {
    color: #c678dd;
  }

  .function {
    color: #61afef;
  }

  .variable {
    color: #e06c75;
  }

  .string {
    color: #98c379;
  }

  .number,
  .boolean {
    color: #d19a66;
  }

  .operator {
    color: #56b6c2;
  }

  .punctuation {
    color: #abb2bf;
  }

  .parameter {
    color: #e5c07b;
  }

  .method {
    color: #61afef;
  }

  .comment {
    color: #5c6370;
  }
}

/* 折叠设置样式 */
.toggle-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
  cursor: pointer;
}

.toggle-input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background-color: var(--b3-theme-surface-variant);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 24px;
  cursor: pointer;
  border: 2px solid var(--b3-theme-outline);
}

.toggle-slider::before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: var(--b3-theme-on-surface-variant);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-input:checked + .toggle-slider {
  background-color: var(--b3-theme-primary);
  border-color: var(--b3-theme-primary);
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(24px);
  background-color: var(--b3-theme-on-primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.toggle-description {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  font-weight: 500;
  padding: 2px 8px;
  background: var(--b3-theme-surface-variant);
  border-radius: 8px;
  border: 1px solid var(--b3-theme-outline);
}

/* 折叠预览指示器 */
.collapse-preview-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  background: linear-gradient(to bottom, transparent, rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.05));
  border-top: 1px dashed var(--b3-theme-outline);
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
}

.collapse-text {
  font-weight: 500;
}

.collapse-height {
  padding: 2px 6px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-radius: 6px;
  font-weight: 600;
  font-size: 10px;
}

.preview-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
}

.info-item {
  padding: 2px 8px;
  background: var(--b3-theme-surface);
  border-radius: 12px;
  font-weight: 500;
  border: 1px solid var(--b3-theme-outline);
}

/* 响应式设计 */
@media (max-width: 600px) {
  .style-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 400px) {
  .codeblock-settings {
    padding: 12px;
  }

  .style-cards {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .advanced-settings {
    padding: 12px;
    gap: 12px;
  }

  .style-card {
    flex-direction: row;
    padding: 12px;

    .style-card-icon {
      font-size: 24px;
    }

    .style-card-name {
      flex: 1;
      text-align: left;
    }
  }

  .settings-container {
    gap: 16px;
  }

  .code-line {
    font-size: 11px;
  }

  .line-number {
    min-width: 24px;
    padding-right: 8px;
  }
}

@media (max-width: 320px) {
  .style-card-icon {
    font-size: 20px !important;
  }

  .style-card-name {
    font-size: 11px;
  }
}
</style>
