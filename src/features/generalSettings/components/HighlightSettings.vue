<template>
  <div class="highlight-settings">
    <label class="setting-label">
      <span class="label-icon">🖍️</span>
      {{ i18n?.enableHighlight || '双击高亮功能' }}
    </label>
    <SiSwitch
      v-model="enableHighlight"
      @change="handleToggleChange"
    />
    <p class="toggle-description">
      {{ i18n?.highlightDescription || '双击选中文本自动高亮显示' }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { showMessage } from 'siyuan'
import SiSwitch from '@/components/Switch.vue'

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: any
}>()

const enableHighlight = ref(true)

const loadSettings = async () => {
  try {
    const data = await props.plugin?.loadData('highlight-settings')
    if (data) enableHighlight.value = data.enableHighlight ?? true
  } catch (e) {
    console.error('加载高亮设置失败:', e)
  }
}

const handleToggleChange = async () => {
  try {
    await props.plugin?.saveData('highlight-settings', {
      enableHighlight: enableHighlight.value
    })
    showMessage(
      enableHighlight.value ? '双击高亮功能已启用' : '双击高亮功能已禁用',
      2000,
      'info'
    )
  } catch (e) {
    console.error('保存高亮设置失败:', e)
  }
}

onMounted(loadSettings)

defineExpose({ loadSettings, enableHighlight })
</script>

<style scoped>
.highlight-settings {
  padding: 16px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 12px;
}

.label-icon {
  font-size: 14px;
  opacity: 0.8;
}

.toggle-description {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  margin-top: 8px;
  line-height: 1.4;
}
</style>
