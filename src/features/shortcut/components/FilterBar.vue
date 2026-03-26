<template>
  <div class="shortcut-filters">
    <div class="filter-group">
      <Button
        v-for="filter in filters"
        :key="filter.key"
        :variant="activeFilter === filter.key ? 'primary' : 'ghost'"
        size="small"
        @click="$emit('update:activeFilter', filter.key)"
      >
        {{ filter.label }}
      </Button>
    </div>
    <div class="view-toggle">
      <Button
        :variant="viewMode === 'grid' ? 'primary' : 'ghost'"
        size="small"
        title="网格视图"
        @click="$emit('update:viewMode', 'grid')"
      >
        <span class="grid-icon">
          <span class="square"></span>
          <span class="square"></span>
        </span>
      </Button>
      <Button
        :variant="viewMode === 'three-col' ? 'primary' : 'ghost'"
        size="small"
        title="三列视图"
        @click="$emit('update:viewMode', 'three-col')"
      >
        <span class="three-col-icon">
          <span class="square"></span>
          <span class="square"></span>
          <span class="square"></span>
        </span>
      </Button>
      <Button
        :variant="viewMode === 'list' ? 'primary' : 'ghost'"
        size="small"
        title="列表视图"
        @click="$emit('update:viewMode', 'list')"
      >
        <span class="list-icon">
          <span class="line"></span>
        </span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/Button.vue'
import type { QuickFilter, ViewMode } from '../types'

interface Props {
  activeFilter: string
  viewMode: ViewMode
  filters: QuickFilter[]
}

defineProps<Props>()

defineEmits<{
  'update:activeFilter': [value: string]
  'update:viewMode': [value: ViewMode]
}>()
</script>

<style scoped lang="scss">
// 样式已在 ../styles/index.scss 中定义
</style>
