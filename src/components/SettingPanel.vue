<template>
  <div class="settings-overlay" @click="onCancel">
    <div class="settings-panel" @click.stop>
      <div class="settings-header">
        <h2 class="settings-title">{{ i18n.pluginSettings }}</h2>
        <p class="settings-desc">{{ i18n.pluginSettingsDesc }}</p>
      </div>

    <div class="fn__hr"></div>

    <div class="settings-content">
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
import { ref, onMounted } from 'vue'
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
  emit('save', localSettings.value)
}

// 取消
const onCancel = () => {
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
  z-index: 10001;
  pointer-events: auto;
}

.settings-panel {
  padding: 8px 16px;
  max-width: 520px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  color: #333333;
  font-size: 14px;
}

.settings-header {
  margin-bottom: 8px;
}

.settings-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.settings-desc {
  margin: 0;
  font-size: 12px;
  color: #666666;
  line-height: 1.3;
}

.settings-content {
  padding: 8px 0;
}

.setting-item {
  margin-bottom: 12px;

  .fn__flex-1 {
    font-size: 13px;
    font-weight: 500;
    color: #1a1a1a;
  }

  .b3-label__text {
    font-size: 11px;
    color: #666666;
    line-height: 1.4;
    margin-top: 1px;
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.settings-footer {
  display: flex;
  align-items: center;
  padding: 8px 0 4px;
  gap: 6px;
}

.settings-notice {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  margin-top: 6px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 11px;
  color: #666666;
  line-height: 1.4;

  .icon {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    color: #1890ff;
  }
}
</style>
