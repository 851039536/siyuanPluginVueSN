<!-- 笔记本块类型堆叠图：各笔记本块类型分布可视化 -->
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
import type { NotebookBlockTypeStat } from "../../types"
import { computed } from "vue"
import { useNotebookHover } from "../../composables/useNotebookHover"
import { NOTEBOOK_COLORS } from "../../types/constants"

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
@use "../../styles/NotebookBlockTypeChart.scss";
</style>
