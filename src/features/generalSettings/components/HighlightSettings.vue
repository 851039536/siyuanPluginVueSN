<template>
  <div class="highlight-settings">
    <div class="settings-container">
      <!-- 双击高亮功能开关 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🖍️</span>
            {{ i18n.enableHighlight || '双击高亮功能' }}
          </label>
          <div class="toggle-container">
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="enableHighlight"
                @change="handleToggleChange"
                class="toggle-input"
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-description">
              {{ i18n.highlightDescription || '双击选中文本自动高亮显示' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Props {
  i18n?: any
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null
})

const enableHighlight = ref(true)

// 加载设置
async function loadSettings() {
  if (props.plugin) {
    try {
      const data = await props.plugin.loadData('highlight-settings')
      if (data) {
        enableHighlight.value = data.enableHighlight ?? true
      }
    } catch (error) {
      console.error('加载高亮设置失败:', error)
    }
  }
}

// 处理开关变化
async function handleToggleChange() {
  if (props.plugin) {
    try {
      await props.plugin.saveData('highlight-settings', {
        enableHighlight: enableHighlight.value
      })
      console.log('高亮设置已保存:', enableHighlight.value)

      // 显示提示消息
      if (typeof window !== 'undefined' && window.siyuan?.showMessage) {
        window.siyuan.showMessage(
          enableHighlight.value ? '双击高亮功能已启用' : '双击高亮功能已禁用',
          'info'
        )
      }
    } catch (error) {
      console.error('保存高亮设置失败:', error)
    }
  }
}

// 初始化时加载设置
onMounted(() => {
  loadSettings()
})

// 暴露方法
defineExpose({
  loadSettings,
  enableHighlight
})
</script>

<style scoped>
.highlight-settings {
  padding: 16px;
  box-sizing: border-box;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 100%;
}

/* 设置行样式 */
.setting-row {
  display: flex;
  width: 100%;
}

/* 设置项样式 */
.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin: 0;
  white-space: nowrap;
}

.label-icon {
  font-size: 14px;
  opacity: 0.8;
}

/* 开关容器 */
.toggle-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 28px;
}

.toggle-input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--b3-theme-surface-variant);
  transition: 0.3s;
  border-radius: 28px;
  border: 2px solid var(--b3-theme-outline);
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: var(--b3-theme-background);
  transition: 0.3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-input:checked + .toggle-slider {
  background-color: var(--b3-theme-primary);
  border-color: var(--b3-theme-primary);
}

.toggle-input:checked + .toggle-slider:before {
  transform: translateX(22px);
  background-color: var(--b3-theme-background);
}

.toggle-input:focus + .toggle-slider {
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb), 0.2);
}

.toggle-description {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  margin-left: 0;
  line-height: 1.4;
}

/* 响应式设计 */
@media (max-width: 400px) {
  .highlight-settings {
    padding: 12px;
  }

  .settings-container {
    gap: 16px;
  }
}
</style>
