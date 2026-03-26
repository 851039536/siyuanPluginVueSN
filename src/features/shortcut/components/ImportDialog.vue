<template>
  <div v-if="visible" class="shortcut-dialog-overlay" @click="$emit('close')">
    <div class="shortcut-dialog" @click.stop>
      <div class="dialog-header">
        <div class="dialog-title">{{ title }}</div>
        <Button variant="ghost" size="small" icon="close" @click="$emit('close')" />
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>{{ fileLabel }}</label>
          <input type="file" accept=".json" @change="handleFileChange" />
        </div>
        <div class="import-hint">
          <p>{{ hintText }}</p>
        </div>
      </div>
      <div class="dialog-footer">
        <Button variant="secondary" @click="$emit('close')">{{ closeText }}</Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/Button.vue'
import type { ShortcutInfo } from '../types'

interface Props {
  visible: boolean
  title?: string
  fileLabel?: string
  hintText?: string
  closeText?: string
  formatErrorText?: string
  importSuccessText?: string
  importErrorText?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '导入快捷键',
  fileLabel: '选择 JSON 文件',
  hintText: '请选择符合格式的 JSON 文件',
  closeText: '关闭',
  formatErrorText: '文件格式错误',
  importSuccessText: '成功导入',
  importErrorText: '导入失败，请检查文件格式'
})

const emit = defineEmits<{
  'close': []
  'import': [shortcuts: ShortcutInfo[]]
}>()

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text) as ShortcutInfo[]

    if (!Array.isArray(data)) {
      alert(props.formatErrorText)
      return
    }

    emit('import', data)
    alert(`${props.importSuccessText} ${data.length} 个快捷键`)
  } catch (error) {
    console.error('导入失败:', error)
    alert(props.importErrorText)
  }
}
</script>

<style scoped lang="scss">
.shortcut-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.shortcut-dialog {
  background: var(--b3-theme-background);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 450px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: dialogSlideIn 0.3s ease-out;
}

@keyframes dialogSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.dialog-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.dialog-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 12px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 4px;
}

.form-group input[type="file"] {
  width: 100%;
  padding: 8px;
  border: 1px dashed var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.form-group input[type="file"]:hover {
  border-color: var(--b3-theme-primary);
}

.import-hint {
  padding: 12px;
  background: var(--b3-theme-surface);
  border-radius: 4px;
  border-left: 3px solid var(--b3-theme-primary);
}

.import-hint p {
  margin: 0;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
}

.dialog-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}
</style>
