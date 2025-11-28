<template>
  <div class="appearance-settings">
    <h4>{{ i18n.appearanceSettings || '外观设置' }}</h4>
    
    <div class="setting-list">
      <div class="setting-item">
        <label>{{ i18n.themeMode || '主题模式' }}</label>
        <select v-model="themeMode" class="compact-select">
          <option value="auto">{{ i18n.auto || '自动' }}</option>
          <option value="light">{{ i18n.light || '浅色' }}</option>
          <option value="dark">{{ i18n.dark || '深色' }}</option>
        </select>
      </div>

      <div class="setting-item">
        <label>{{ i18n.interfaceScale || '界面缩放' }}</label>
        <div class="input-group">
          <input 
            v-model.number="interfaceScale" 
            type="number" 
            min="80" 
            max="150"
            step="10"
            class="compact-number"
          />
          <span>%</span>
        </div>
      </div>

      <div class="setting-item">
        <label>{{ i18n.showSidebar || '显示侧边栏' }}</label>
        <input 
          type="checkbox" 
          v-model="showSidebar" 
          class="compact-checkbox"
        />
      </div>
    </div>

    <div class="action-buttons">
      <button @click="save" class="save-btn">{{ i18n.save || '保存' }}</button>
      <button @click="reset" class="reset-btn">{{ i18n.reset || '重置' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { showMessage } from 'siyuan'

interface Props {
  i18n?: any
}

interface Emits {
  (e: 'change', settings: any): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({})
})

const emit = defineEmits<Emits>()

const themeMode = ref('auto')
const interfaceScale = ref(100)
const showSidebar = ref(true)

const DEFAULT_SETTINGS = {
  themeMode: 'auto',
  interfaceScale: 100,
  showSidebar: true
}

watch([themeMode, interfaceScale, showSidebar], () => {
  emit('change', {
    themeMode: themeMode.value,
    interfaceScale: interfaceScale.value,
    showSidebar: showSidebar.value
  })
})

function save() {
  const settings = {
    themeMode: themeMode.value,
    interfaceScale: interfaceScale.value,
    showSidebar: showSidebar.value
  }
  try {
    localStorage.setItem('appearance-settings', JSON.stringify(settings))
    showMessage(props.i18n.settingsSaved || '已保存', 3000, 'info')
  } catch (error) {
    showMessage(props.i18n.saveFailed || '保存失败', 3000, 'error')
  }
}

function reset() {
  themeMode.value = DEFAULT_SETTINGS.themeMode
  interfaceScale.value = DEFAULT_SETTINGS.interfaceScale
  showSidebar.value = DEFAULT_SETTINGS.showSidebar
  
  try {
    localStorage.removeItem('appearance-settings')
    showMessage(props.i18n.settingsReset || '已重置', 3000, 'info')
  } catch (error) {
    console.error('重置失败:', error)
  }
}

// 加载设置
function loadSettings() {
  try {
    const saved = localStorage.getItem('appearance-settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      themeMode.value = parsed.themeMode || DEFAULT_SETTINGS.themeMode
      interfaceScale.value = parsed.interfaceScale || DEFAULT_SETTINGS.interfaceScale
      showSidebar.value = parsed.showSidebar !== undefined ? parsed.showSidebar : DEFAULT_SETTINGS.showSidebar
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

loadSettings()
</script>

<style scoped>
.appearance-settings {
  padding: 12px;
}

.appearance-settings h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.setting-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.setting-item label {
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface-variant);
  min-width: 80px;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.compact-select {
  padding: 4px 8px;
  border: 1px solid var(--b3-theme-outline);
  border-radius: 3px;
  background: var(--b3-theme-surface-variant);
  color: var(--b3-theme-on-surface-variant);
  font-size: 12px;
}

.compact-number {
  width: 60px;
  padding: 4px 6px;
  border: 1px solid var(--b3-theme-outline);
  border-radius: 3px;
  background: var(--b3-theme-surface-variant);
  color: var(--b3-theme-on-surface-variant);
  font-size: 12px;
  text-align: center;
}

.compact-checkbox {
  width: 16px;
  height: 16px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.save-btn,
.reset-btn {
  flex: 1;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

.reset-btn {
  background: var(--b3-theme-surface-variant);
  color: var(--b3-theme-on-surface-variant);
}
</style>