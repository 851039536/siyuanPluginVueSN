<template>
  <div class="settings-overlay" @click="onCancel">
    <div class="settings-panel" @click.stop>
      <div class="settings-header">
        <h2 class="settings-title">{{ i18n.pluginSettings }}</h2>
        <p class="settings-desc">{{ i18n.pluginSettingsDesc }}</p>
      </div>

    <div class="fn__hr"></div>

    <div class="settings-content">
      <div class="settings-scroll">
      <div class="setting-item b3-label">
        <div class="fn__flex">
          <span class="fn__flex-1">
            {{ i18n.enablePageLock }}
          </span>
          <span class="fn__space"></span>
          <input
            type="checkbox"
            class="b3-switch fn__flex-center"
            v-model="localSettings.enablePageLock"
          />
        </div>
        <div class="b3-label__text">{{ i18n.enablePageLockDesc }}</div>
      </div>

      <div class="setting-item b3-label">
        <div class="fn__flex">
          <span class="fn__flex-1">
            {{ i18n.enableTableOfContents }}
          </span>
          <span class="fn__space"></span>
          <input
            type="checkbox"
            class="b3-switch fn__flex-center"
            v-model="localSettings.enableTableOfContents"
          />
        </div>
        <div class="b3-label__text">{{ i18n.enableTableOfContentsDesc }}</div>
      </div>

      <div class="setting-item b3-label">
        <div class="fn__flex">
          <span class="fn__flex-1">
            {{ i18n.enableImageCompressor }}
          </span>
          <span class="fn__space"></span>
          <input
            type="checkbox"
            class="b3-switch fn__flex-center"
            v-model="localSettings.enableImageCompressor"
          />
        </div>
        <div class="b3-label__text">{{ i18n.enableImageCompressorDesc }}</div>
      </div>

      <div class="setting-item b3-label">
        <div class="fn__flex">
          <span class="fn__flex-1">
            {{ i18n.enableDocNavigation }}
          </span>
          <span class="fn__space"></span>
          <input
            type="checkbox"
            class="b3-switch fn__flex-center"
            v-model="localSettings.enableDocNavigation"
          />
        </div>
        <div class="b3-label__text">{{ i18n.enableDocNavigationDesc }}</div>
      </div>

      <div class="setting-item b3-label">
        <div class="fn__flex">
          <span class="fn__flex-1">
            {{ i18n.enableShortcuts || '快捷键面板' }}
          </span>
          <span class="fn__space"></span>
          <input
            type="checkbox"
            class="b3-switch fn__flex-center"
            v-model="localSettings.enableShortcuts"
          />
        </div>
        <div class="b3-label__text">{{ i18n.enableShortcutsDesc || '在右侧边栏显示快捷键面板' }}</div>
      </div>

      <div class="setting-item b3-label">
        <div class="fn__flex">
          <span class="fn__flex-1">
            {{ i18n.enableWordQuery || '单词查询' }}
          </span>
          <span class="fn__space"></span>
          <input
            type="checkbox"
            class="b3-switch fn__flex-center"
            v-model="localSettings.enableWordQuery"
          />
        </div>
        <div class="b3-label__text">{{ i18n.enableWordQueryDesc || '在右侧边栏查询单词释义、音标、谐音等信息' }}</div>
      </div>

      <div class="setting-item b3-label">
        <div class="fn__flex">
          <span class="fn__flex-1">
            {{ i18n.enableGeneralSettings || '通用设置' }}
          </span>
          <span class="fn__space"></span>
          <input
            type="checkbox"
            class="b3-switch fn__flex-center"
            v-model="localSettings.enableGeneralSettings"
          />
        </div>
        <div class="b3-label__text">{{ i18n.enableGeneralSettingsDesc || '在右侧边栏提供字体设置等通用配置功能' }}</div>
      </div>

      <div class="setting-item b3-label">
        <div class="fn__flex">
          <span class="fn__flex-1">
            {{ i18n.qrcodeGenerate || '二维码生成' }}
          </span>
          <span class="fn__space"></span>
          <input
            type="checkbox"
            class="b3-switch fn__flex-center"
            v-model="localSettings.enableQRCode"
          />
        </div>
        <div class="b3-label__text">{{ i18n.qrcodeDesc || '右键选中文本生成二维码，支持复制和下载' }}</div>
      </div>

      <div class="setting-item b3-label">
        <div class="fn__flex">
          <span class="fn__flex-1">
            {{ i18n.unitConverter || '单位转换' }}
          </span>
          <span class="fn__space"></span>
          <input
            type="checkbox"
            class="b3-switch fn__flex-center"
            v-model="localSettings.enableUnitConverter"
          />
        </div>
        <div class="b3-label__text">{{ i18n.unitConverterDesc || '在右侧边栏提供长度、面积、体积、质量、功率、时间、速度、数据存储、进制、ASCII等转换功能' }}</div>
      </div>

      <div class="setting-item b3-label">
        <div class="fn__flex">
          <span class="fn__flex-1">
            {{ i18n.enableDiskBrowser || '本地磁盘浏览器' }}
          </span>
          <span class="fn__space"></span>
          <input
            type="checkbox"
            class="b3-switch fn__flex-center"
            v-model="localSettings.enableDiskBrowser"
          />
        </div>
        <div class="b3-label__text">{{ i18n.enableDiskBrowserDesc || '在右侧边栏显示本地磁盘列表，可快速打开文件夹' }}</div>
      </div>
      </div>
    </div>

    <div class="fn__hr"></div>

    <div class="settings-footer">
      <button class="b3-button b3-button--outline" @click="onReset">
        <svg class="b3-button__icon"><use xlink:href="#iconUndo"></use></svg>
        <span class="b3-button__text">{{ i18n.resetSettings }}</span>
      </button>
      <span class="fn__flex-1"></span>
      <button class="b3-button b3-button--cancel" @click="onCancel">
        {{ i18n.cancel }}
      </button>
      <span class="fn__space"></span>
      <button class="b3-button b3-button--text" @click="onSave">
        {{ i18n.save }}
      </button>
    </div>

    <div class="settings-notice">
      <svg class="icon"><use xlink:href="#iconInfo"></use></svg>
      <span>{{ i18n.settingsNotice }}</span>
    </div>
  </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { showMessage } from 'siyuan'
import type { PluginSettings } from '@/config/settings'
import { DEFAULT_SETTINGS } from '@/config/settings'

interface Props {
  settings: PluginSettings
  i18n: any
}

interface Emits {
  (e: 'save', settings: PluginSettings): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 本地配置副本
const localSettings = ref<PluginSettings>({ ...props.settings })

// 保存设置
const onSave = () => {
  // 清理定时器
  const overlay = document.querySelector('.settings-overlay') as HTMLElement
  if (overlay && (overlay as any)._focusTimer) {
    clearInterval((overlay as any)._focusTimer)
  }
  emit('save', localSettings.value)
}

// 取消
const onCancel = () => {
  // 清理定时器
  const overlay = document.querySelector('.settings-overlay') as HTMLElement
  if (overlay && (overlay as any)._focusTimer) {
    clearInterval((overlay as any)._focusTimer)
  }
  emit('cancel')
}

// 重置为默认设置
const onReset = () => {
  localSettings.value = { ...DEFAULT_SETTINGS }
  showMessage(props.i18n.resetSettingsSuccess || '已重置为默认设置', 2000, 'info')
}

onMounted(() => {
  // 确保本地配置与传入的配置同步
  localSettings.value = { ...props.settings }

  // 确保设置面板在最上层
  const overlay = document.querySelector('.settings-overlay') as HTMLElement
  if (overlay) {
    // 使用更高的z-index确保在集市之上
    overlay.style.zIndex = '30000'

    // 添加事件监听，确保焦点始终在设置面板上
    const focusTimer = setInterval(() => {
      if (document.activeElement && document.activeElement !== document.body) {
        const activeElement = document.activeElement as HTMLElement
        // 如果当前焦点元素不在设置面板内，强制焦点回到设置面板
        if (!activeElement.closest('.settings-panel')) {
          const firstInput = overlay.querySelector('input') as HTMLInputElement
          if (firstInput) {
            firstInput.focus()
          }
        }
      }
    }, 200)

    // 存储定时器ID以便清理
    ;(overlay as any)._focusTimer = focusTimer
  }
})

onBeforeUnmount(() => {
  // 清理定时器
  const overlay = document.querySelector('.settings-overlay') as HTMLElement
  if (overlay && (overlay as any)._focusTimer) {
    clearInterval((overlay as any)._focusTimer)
  }
})
</script>

<style lang="scss" scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000;
  pointer-events: auto;
}

.settings-panel {
  padding: 12px 16px;
  max-width: 580px;
  width: 90%;
  max-height: 85vh;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  color: #333333;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.settings-title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.settings-desc {
  margin: 0;
  font-size: 13px;
  color: #666666;
  line-height: 1.4;
}

.settings-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.settings-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 4px;
  margin: 0 -4px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;

    &:hover {
      background: #a8a8a8;
    }
  }
}

.setting-item {
  margin-bottom: 12px;
  padding: 10px;
  background: #fafafa;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: #f5f5f5;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .fn__flex-1 {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a1a;
  }

  .b3-label__text {
    font-size: 12px;
    color: #666666;
    line-height: 1.5;
    margin-top: 4px;
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.settings-footer {
  display: flex;
  align-items: center;
  padding: 12px 0 8px;
  gap: 8px;
  flex-shrink: 0;
  border-top: 1px solid #e8e8e8;
  margin-top: 12px;
}

.settings-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  margin-top: 8px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 4px;
  font-size: 12px;
  color: #0050b3;
  line-height: 1.5;
  flex-shrink: 0;

  .icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: #1890ff;
  }
}

.fn__hr {
  margin: 8px 0;
  border: none;
  border-top: 1px solid #e8e8e8;
}
</style>
