<template>
  <div class="doc-count-settings">
    <label class="setting-label">
      <span class="label-icon">📊</span>
      {{ i18n?.enableDocCount || '笔记本文档数统计' }}
    </label>
    <SiSwitch
      v-model="enableDocCount"
      @change="handleToggleChange"
    />
    <p class="toggle-description">
      {{ i18n?.docCountDescription || '在笔记本名称后显示文档数量' }}
    </p>

    <!-- 功能说明 -->
    <div class="feature-description">
      <div class="description-title">
        <span class="title-icon">💡</span>
        {{ i18n?.featureDescription || '功能说明' }}
      </div>
      <ul class="description-list">
        <li>{{ i18n?.docCountFeature1 || '在笔记本列表中显示每个笔记本的文档数量' }}</li>
        <li>{{ i18n?.docCountFeature3 || '支持手机端和桌面端' }}</li>
        <li>{{ i18n?.docCountFeature4 || '每小时自动更新笔记本文档数' }}</li>
      </ul>
    </div>

    <!-- 更新间隔设置 -->
    <div class="update-interval">
      <label class="interval-label">
        {{ i18n?.updateInterval || '更新间隔' }}
      </label>
      <select v-model="updateInterval" class="interval-select" @change="handleIntervalChange">
        <option value="1800000">{{ i18n?.interval30min || '30分钟' }}</option>
        <option value="3600000">{{ i18n?.interval1hour || '1小时' }}</option>
        <option value="7200000">{{ i18n?.interval2hour || '2小时' }}</option>
        <option value="14400000">{{ i18n?.interval4hour || '4小时' }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { showMessage } from 'siyuan'
import SiSwitch from '@/components/Switch.vue'
import { DocCountManager } from '../modules/DocCountManager'

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: any
}>()

const emit = defineEmits<{
  change: [settings: any]
}>()

const enableDocCount = ref(true)
const updateInterval = ref('3600000')
let docCountManager: DocCountManager | null = null

const loadSettings = async () => {
  try {
    const data = await props.plugin?.loadData('doc-count-settings')
    if (data) {
      enableDocCount.value = data.enableDocCount ?? true
      updateInterval.value = data.updateInterval || '3600000'
    }
  } catch (e) {
    console.error('加载文档数统计设置失败:', e)
  }
}

const handleToggleChange = async () => {
  try {
    await props.plugin?.saveData('doc-count-settings', {
      enableDocCount: enableDocCount.value,
      updateInterval: updateInterval.value
    })
    
    if (enableDocCount.value) {
      docCountManager?.start()
    } else {
      docCountManager?.stop()
    }
    
    showMessage(
      enableDocCount.value ? '笔记本文档数统计已启用' : '笔记本文档数统计已禁用',
      2000,
      'info'
    )
    
    emit('change', {
      enableDocCount: enableDocCount.value,
      updateInterval: updateInterval.value
    })
  } catch (e) {
    console.error('保存文档数统计设置失败:', e)
  }
}

const handleIntervalChange = async () => {
  try {
    await props.plugin?.saveData('doc-count-settings', {
      enableDocCount: enableDocCount.value,
      updateInterval: updateInterval.value
    })
    
    docCountManager?.setUpdateInterval(parseInt(updateInterval.value))
    
    showMessage('更新间隔已修改', 2000, 'info')
  } catch (e) {
    console.error('保存更新间隔失败:', e)
  }
}

onMounted(async () => {
  await loadSettings()
  
  if (enableDocCount.value) {
    docCountManager = new DocCountManager()
    docCountManager.start()
    docCountManager.setUpdateInterval(parseInt(updateInterval.value))
  }
})

onUnmounted(() => {
  docCountManager?.stop()
})

defineExpose({ loadSettings, enableDocCount })
</script>

<style scoped>
.doc-count-settings {
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

.feature-description {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
}

.description-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 10px;
}

.title-icon {
  font-size: 14px;
}

.description-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  line-height: 1.8;
}

.description-list li {
  margin-bottom: 4px;
}

.description-list li:last-child {
  margin-bottom: 0;
}

.update-interval {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
}

.interval-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
}

.interval-select {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
  transition: all 0.2s;
}

.interval-select:hover {
  border-color: var(--b3-theme-primary);
}

.interval-select:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
}
</style>
