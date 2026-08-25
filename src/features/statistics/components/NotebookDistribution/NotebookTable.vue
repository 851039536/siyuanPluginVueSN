<!-- 笔记本详情表格：可排序的文档数/字数/总占比表格（数值列内联占比） -->
<template>
  <div class="notebook-table-wrap">
    <table class="notebook-table">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            class="nb-th"
            :class="{ 'nb-th-active': sortKey === col.key }"
            @click="toggleSort(col.key)"
          >
            {{ col.label }}
            <span
              v-if="sortKey === col.key"
              class="sort-arrow"
            >{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in sortedRows"
          :key="row.name"
          class="nb-tr"
          :class="{ 'nb-tr-highlight': hoveredNotebook === row.name }"
          @mouseenter="onHover(row.name)"
          @mouseleave="onHover(null)"
        >
          <td class="nb-td nb-td-name">
            <span
              class="nb-color-dot"
              :style="{ background: row.color }"
            ></span>
            {{ row.name }}
          </td>
          <td class="nb-td nb-td-num">
            {{ row.docs.toLocaleString() }} ({{ row.docPct }}%)
          </td>
          <td class="nb-td nb-td-num">
            {{ row.words.toLocaleString() }} ({{ row.wordPct }}%)
          </td>
          <td class="nb-td nb-td-num nb-td-pct">
            <div class="pct-bar-wrap">
              <div
                class="pct-bar"
                :style="{
                  width: `${row.pct}%`,
                  background: row.color,
                }"
              ></div>
            </div>
            {{ row.pct }}%
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
// 笔记本详情表格：可排序表格，表头文案走 i18n
import type {
  NotebookDocCount,
  NotebookWordStat,
} from "../../types"
import {
  computed,
  ref,
} from "vue"
import { useNotebookHover } from "../../composables/useNotebookHover"

interface Props {
  docStats?: NotebookDocCount[]
  wordStats?: NotebookWordStat[]
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  docStats: () => [],
  wordStats: () => [],
  i18n: () => ({}),
})

const {
  hoveredNotebook,
  onHover,
} = useNotebookHover()

type SortKey = 'name' | 'docs' | 'words' | 'pct'

// 表头映射 i18n：笔记本/文档数/字数/总占比
const columns = computed(() => [
  {
    key: 'name' as SortKey,
    label: props.i18n.notebookName,
  },
  {
    key: 'docs' as SortKey,
    label: props.i18n.docCount,
  },
  {
    key: 'words' as SortKey,
    label: props.i18n.words,
  },
  {
    key: 'pct' as SortKey,
    label: props.i18n.totalProportion,
  },
])

const sortKey = ref<SortKey>('docs')
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'name' ? 'asc' : 'desc'
  }
}

const mergedRows = computed(() => {
  const docMap = new Map(props.docStats.map((d) => [d.name, d.count]))
  const wordMap = new Map(props.wordStats.map((d) => [d.name, d]))

  const names = new Set([...docMap.keys(), ...wordMap.keys()])
  const rows: Array<{
    name: string
    docs: number
    words: number
    docPct: number
    wordPct: number
    pct: number
    color: string
  }> = []

  for (const name of names) {
    const docs = docMap.get(name) ?? 0
    const ws = wordMap.get(name)
    rows.push({
      name,
      docs,
      words: ws?.words ?? 0,
      docPct: 0,
      wordPct: 0,
      pct: 0,
      color: ws?.color ?? '#888',
    })
  }

  const totalDocs = rows.reduce((sum, r) => sum + r.docs, 0)
  const totalWords = rows.reduce((sum, r) => sum + r.words, 0)

  // 文档数/字数各自占比，总占比取两者平均
  for (const r of rows) {
    r.docPct = totalDocs > 0 ? Math.round((r.docs / totalDocs) * 100) : 0
    r.wordPct = totalWords > 0 ? Math.round((r.words / totalWords) * 100) : 0
    r.pct = Math.round((r.docPct + r.wordPct) / 2)
  }
  return rows
})

const sortedRows = computed(() => {
  const rows = [...mergedRows.value]
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1

  rows.sort((a, b) => {
    if (key === 'name') {
      return dir * a.name.localeCompare(b.name, 'zh-CN')
    }
    return dir * ((a[key] as number) - (b[key] as number))
  })
  return rows
})
</script>

<style scoped lang="scss">
@use "../../styles/NotebookTable.scss";
@use '../../styles/index.scss' as stats;
</style>
