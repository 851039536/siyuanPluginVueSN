<template>
  <div class="shortcut-header">
    <Input
      :model-value="searchKeyword"
      :placeholder="placeholder"
      prefix-icon="search"
      size="medium"
      @update:model-value="$emit('update:searchKeyword', $event)"
    />
    <div class="header-actions">
      <Button variant="ghost" size="small" icon="refresh" title="刷新" @click="$emit('refresh')" />
      <Button variant="ghost" size="small" icon="download" title="导出" @click="$emit('export')" />
      <Button variant="ghost" size="small" :icon="'file' as any" title="导入" @click="$emit('import')" />
      <Button variant="primary" size="small" icon="add" :title="addTitle" @click="$emit('add')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/Button.vue'
import Input from '@/components/Input.vue'

interface Props {
  searchKeyword: string
  placeholder: string
  addTitle: string
}

defineProps<Props>()

defineEmits<{
  'update:searchKeyword': [value: string]
  'refresh': []
  'export': []
  'import': []
  'add': []
}>()
</script>

<style scoped lang="scss">
.shortcut-header {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}

.header-actions {
  display: flex;
  gap: 6px;
}
</style>
