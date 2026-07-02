<template>
  <div class="notebook-blocktype-chart">
    <div
      v-if="!data || data.length === 0"
      class="empty-hint"
    >
      暂无数据
    </div>

    <div
      v-else
      class="chart-body"
    >
      <div
        v-for="item in data"
        :key="item.notebook"
        class="nb-row"
        :class="{ 'nb-row-highlight': hoveredNotebook === item.notebook }"
        @mouseenter="onHover(item.notebook)"
        @mouseleave="onHover(null)"
      >
        <span class="nb-label">{{ item.notebook }}</span>
        <div class="nb-bar-wrap">
          <div
            v-for="(bt, bi) in item.blockTypes"
            :key="bt.name"
            class="nb-segment"
            :style="{
              flex: bt.count,
              backgroundColor: segmentColor(bi),
            }"
            :title="`${bt.label}: ${bt.count}`"
          ></div>
        </div>
        <span class="nb-total">{{ totalCount(item) }}</span>
      </div>

      <div class="legend">
        <span
          v-for="(label, name, idx) in legendLabels"
          :key="name"
          class="legend-item"
        >
          <span
            class="legend-dot"
            :style="{ backgroundColor: segmentColor(idx) }"
          ></span>
          {{ label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NotebookBlockTypeStat } from "../types"
import { computed } from "vue"
import { useNotebookHover } from "../composables/useNotebookHover"
import { NOTEBOOK_COLORS } from "../types/constants"

interface Props {
  data?: NotebookBlockTypeStat[]
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
})

const {
  hoveredNotebook,
  onHover,
} = useNotebookHover()

const legendLabels = computed(() => {
  const seen = new Map<string, string>()
  for (const nb of props.data) {
    for (const bt of nb.blockTypes) {
      if (!seen.has(bt.name)) {
        seen.set(bt.name, bt.label)
      }
    }
  }
  return Object.fromEntries(seen.entries())
})

function segmentColor(idx: number): string {
  return NOTEBOOK_COLORS[idx % NOTEBOOK_COLORS.length]
}

function totalCount(item: NotebookBlockTypeStat): number {
  return item.blockTypes.reduce((sum, bt) => sum + bt.count, 0)
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/shared" as *;
@use "../styles/index.scss" as stats;

.notebook-blocktype-chart {
  display: flex;
  flex-direction: column;
  min-height: 0;

  .empty-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 60px;
    color: var(--b3-theme-on-surface);
    opacity: 0.4;
    font-size: 12px;
  }

  .chart-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    @include scrollbar-thin;
  }

  .nb-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    border-radius: stats.$radius-sm;
    transition: background 0.15s, box-shadow 0.15s;

    &:hover {
      background: var(--b3-list-hover);
    }

    &.nb-row-highlight {
      background: rgba(var(--b3-theme-primary-rgb), 0.1);
      box-shadow: inset 3px 0 0 var(--b3-theme-primary);
    }

    .nb-label {
      flex-shrink: 0;
      width: 80px;
      font-family: $font-body;
      font-size: 11px;
      font-weight: 500;
      color: var(--b3-theme-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: right;
    }

    .nb-bar-wrap {
      flex: 1;
      height: 14px;
      border-radius: stats.$radius-sm;
      overflow: hidden;
      display: flex;
      min-width: 40px;
      background: rgba(var(--b3-theme-on-surface-rgb), 0.06);

      .nb-segment {
        height: 100%;
        min-width: 2px;
        transition: opacity 0.15s;

        &:hover {
          opacity: 0.8;
        }
      }
    }

    .nb-total {
      flex-shrink: 0;
      width: 32px;
      font-family: stats.$font-mono;
      font-size: 10px;
      font-weight: 700;
      color: var(--b3-theme-primary);
      text-align: right;
    }
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin-top: 8px;
    padding: 6px 0 0;
    border-top: 1px solid var(--b3-border-color);

    .legend-item {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      color: var(--b3-theme-on-surface-light);
      font-family: $font-body;
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: stats.$radius-sm;
      flex-shrink: 0;
    }
  }
}
</style>
