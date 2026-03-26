<template>
  <div class="shortcut-stats">
    <div class="stat-item">
      <span class="stat-label">{{ totalLabel }}</span>
      <span class="stat-value">{{ totalCount }}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">{{ favoriteLabel }}</span>
      <span class="stat-value">{{ favoriteCount }}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">{{ customLabel }}</span>
      <span class="stat-value">{{ customCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  totalCount: number
  favoriteCount: number
  customCount: number
  totalLabel?: string
  favoriteLabel?: string
  customLabel?: string
}

withDefaults(defineProps<Props>(), {
  totalLabel: '总计',
  favoriteLabel: '收藏',
  customLabel: '自定义'
})
</script>

<style scoped lang="scss">
.shortcut-stats {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  background: linear-gradient(135deg, var(--b3-theme-primary-lightest) 0%, var(--b3-theme-surface) 100%);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 12px;
  background: var(--b3-theme-background);
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface-variant);
  font-weight: 500;
  text-transform: uppercase;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--b3-theme-primary);
}
</style>
