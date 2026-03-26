<template>
  <div
    class="feature-card"
    :class="{ 'enabled': feature.enabled, 'disabled': !feature.enabled }"
    @click="handleCardClick"
  >
    <!-- 功能头部 -->
    <div class="feature-header">
      <div class="feature-icon">
        <IconWrapper :name="feature.iconKey" :size="20" />
      </div>
      <div class="feature-info">
        <div class="feature-title">{{ feature.title }}</div>
        <div class="feature-desc">{{ feature.desc }}</div>
      </div>
      <div class="feature-toggle" @click.stop>
        <Switch
          :model-value="feature.enabled"
          size="small"
          @update:model-value="handleToggle"
        />
      </div>
    </div>

    <!-- 功能操作按钮 -->
    <div v-if="feature.actions.length > 0 && feature.enabled" class="feature-actions">
      <Button
        v-for="action in feature.actions"
        :key="action.key"
        variant="ghost"
        size="small"
        block
        @click.stop="handleAction(action.key)"
      >
        <span>{{ action.label }}</span>
        <span class="action-hotkey">{{ action.hotkey }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from 'siyuan'
import IconWrapper from '@/components/IconWrapper.vue'
import Switch from '@/components/Switch.vue'
import Button from '@/components/Button.vue'
import type { Feature } from '../types'

interface Props {
  feature: Feature
  i18n: any
}

interface Emits {
  (e: 'action', action: string): void
  (e: 'toggle', featureId: string, enabled: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleCardClick = () => {
  if (!props.feature.enabled) {
    showMessage(props.i18n.featureDisabled || '该功能未启用', 2000, 'info')
  }
}

const handleToggle = (newValue: boolean) => {
  emit('toggle', props.feature.id, newValue)
}

const handleAction = (actionKey: string) => {
  emit('action', actionKey)
}
</script>

<style scoped lang="scss">
// 引入模块样式
@use '../styles/index.scss';
</style>
