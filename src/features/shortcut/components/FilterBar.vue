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
    <div class="stats-group">
      <span class="stat-chip">{{ totalLabel }} {{ totalCount }}</span>
      <span class="stat-chip">{{ favoriteLabel }} {{ favoriteCount }}</span>
      <span class="stat-chip">{{ customLabel }} {{ customCount }}</span>
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
import Button from "@/components/Button.vue";
import type { QuickFilter, ViewMode } from "../types";

interface Props {
  activeFilter: string;
  viewMode: ViewMode;
  filters: QuickFilter[];
  totalCount?: number;
  favoriteCount?: number;
  customCount?: number;
  totalLabel?: string;
  favoriteLabel?: string;
  customLabel?: string;
}

withDefaults(defineProps<Props>(), {
  totalCount: 0,
  favoriteCount: 0,
  customCount: 0,
  totalLabel: "总计",
  favoriteLabel: "收藏",
  customLabel: "自定义",
});

defineEmits<{
  "update:activeFilter": [value: string];
  "update:viewMode": [value: ViewMode];
}>();
</script>

<style scoped lang="scss">
.shortcut-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.filter-group {
  display: flex;
  gap: 4px;
}

.stats-group {
  display: flex;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.stat-chip {
  font-size: 10px;
  color: var(--b3-theme-on-surface-variant);
  white-space: nowrap;

  &::after {
    content: attr(data-value);
  }
}

.view-toggle {
  display: flex;
  gap: 3px;
  background: var(--b3-theme-background);
  border-radius: 6px;
  padding: 2px;
}

.grid-icon,
.list-icon {
  display: flex;
  align-items: center;
  gap: 2px;
}

.square {
  width: 4px;
  height: 4px;
  background-color: currentColor;
  border-radius: 1px;
  display: inline-block;
}

.line {
  width: 8px;
  height: 4px;
  background-color: currentColor;
  border-radius: 1px;
  display: inline-block;
}
</style>
