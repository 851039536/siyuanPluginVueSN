<template>
  <div class="panel-header">
    <h4 class="panel-title">
      <IconWrapper name="headphones" :size="20" />
      <span>{{ i18n.panelTitle || '单词阅读' }}</span>
    </h4>
    <div class="header-actions">
      <Button
        variant="ghost"
        size="small"
        icon="help"
        @click="$emit('showHelp')"
        :title="i18n.usageGuide || '使用说明'"
      />
      <Button
        variant="ghost"
        size="small"
        icon="add"
        @click="$emit('addCard')"
        :title="i18n.addCard || '添加卡片'"
      />
      <Button
        variant="ghost"
        size="small"
        icon="refresh"
        @click="$emit('refresh')"
        :title="i18n.refresh || '刷新'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from '@/components/IconWrapper.vue'
import Button from '@/components/Button.vue'
import type { I18n } from '../types'

defineProps<{
  i18n: I18n
}>()

defineEmits<{
  showHelp: []
  addCard: []
  refresh: []
}>()
</script>
