<!-- 笔记本块类型堆叠图：各笔记本块类型分布可视化 -->
<template>
  <div class="notebook-blocktype-chart">
    <div
      v-if="!data || data.length === 0"
      class="empty-hint"
    >
      <!-- 空状态："暂无数据" -->
      {{ i18n.emptyText }}
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
            v-for="bt in item.blockTypes"
            :key="bt.name"
            class="nb-segment"
            :style="{
              flex: bt.count,
              backgroundColor: colorByType.get(bt.name),
            }"
            :title="`${bt.label}: ${bt.count}`"
          ></div>
        </div>
        <span class="nb-total">{{ totalCount(item) }}</span>
      </div>

      <div class="legend">
        <span
          v-for="(label, name) in legendLabels"
          :key="name"
          class="legend-item"
        >
          <span
            class="legend-dot"
            :style="{ backgroundColor: colorByType.get(name) }"
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
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  i18n: () => ({}),
})

const {
  hoveredNotebook,
  onHover,
} = useNotebookHover()

// 块类型图例顺序 + 颜色映射（按全局首次出现顺序分配，段与图例颜色一致）
const legendMeta = computed(() => {
  const labels: Record<string, string> = {}
  const colors = new Map<string, string>()
  let i = 0
  for (const nb of props.data) {
    for (const bt of nb.blockTypes) {
      if (!(bt.name in labels)) {
        labels[bt.name] = bt.label
        colors.set(bt.name, NOTEBOOK_COLORS[i % NOTEBOOK_COLORS.length])
        i++
      }
    }
  }
  return { labels, colors }
})

const legendLabels = computed(() => legendMeta.value.labels)
const colorByType = computed(() => legendMeta.value.colors)

function totalCount(item: NotebookBlockTypeStat): number {
  return item.blockTypes.reduce((sum, bt) => sum + bt.count, 0)
}
</script>

<style scoped lang="scss">
@use "../../styles/NotebookBlockTypeChart.scss";
@use '../../styles/index.scss' as stats;
</style>
