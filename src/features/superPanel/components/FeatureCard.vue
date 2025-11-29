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
      <div class="feature-toggle">
        <input
          type="checkbox"
          class="b3-switch fn__flex-center"
          :checked="feature.enabled"
          @click.stop="handleToggle"
        />
      </div>
    </div>

    <!-- 功能操作按钮 -->
    <div v-if="feature.actions.length > 0 && feature.enabled" class="feature-actions">
      <button
        v-for="action in feature.actions"
        :key="action.key"
        class="feature-action-btn"
        @click.stop="handleAction(action.key)"
      >
        <span>{{ action.label }}</span>
        <span class="action-hotkey">{{ action.hotkey }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from 'siyuan'
import IconWrapper from '@/components/IconWrapper.vue'
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

const handleToggle = () => {
  emit('toggle', props.feature.id, !props.feature.enabled)
}

const handleAction = (actionKey: string) => {
  emit('action', actionKey)
}
</script>

<style scoped lang="scss">
.feature-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.2s;

  &.enabled:hover {
    border-color: var(--b3-theme-primary-lighter);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.feature-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.feature-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--b3-theme-primary-lightest);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-info {
  flex: 1;
  min-width: 0;
}

.feature-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin-bottom: 4px;
}

.feature-desc {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  line-height: 1.4;
}

.feature-toggle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
}

.feature-action-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--b3-theme-on-background);
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-surface);
    border-color: var(--b3-theme-primary);
    transform: translateX(2px);
  }
}

.action-hotkey {
  font-size: 11px;
  opacity: 0.6;
  font-family: monospace;
}
</style>
