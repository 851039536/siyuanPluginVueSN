<!-- 笔记本详情表格：可排序的文档数/字数/占比表格 -->
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
            {{ row.docs.toLocaleString() }}
          </td>
          <td class="nb-td nb-td-num">
            {{ row.words.toLocaleString() }}
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
import type { NotebookWordStat } from "../types"
import {
  computed,
  ref,
} from "vue"
import { useNotebookHover } from "../composables/useNotebookHover"

interface DocStat {
  name: string
  count: number
}

interface Props {
  docStats?: DocStat[]
  wordStats?: NotebookWordStat[]
}

const props = withDefaults(defineProps<Props>(), {
  docStats: () => [],
  wordStats: () => [],
})

const {
  hoveredNotebook,
  onHover,
} = useNotebookHover()

const columns = [
  {
    key: 'name',
    label: '笔记本',
    type: 'string' as const,
  },
  {
    key: 'docs',
    label: '文档数',
    type: 'number' as const,
  },
  {
    key: 'words',
    label: '字数',
    type: 'number' as const,
  },
  {
    key: 'pct',
    label: '占比',
    type: 'number' as const,
  },
] as const

type SortKey = typeof columns[number]['key']

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
  const rows: Array<{ name: string, docs: number, words: number, pct: number, color: string }> = []

  for (const name of names) {
    const docs = docMap.get(name) ?? 0
    const ws = wordMap.get(name)
    rows.push({
      name,
      docs,
      words: ws?.words ?? 0,
      pct: ws?.percentage ?? 0,
      color: ws?.color ?? '#888',
    })
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
@use "../styles/NotebookTable.scss";
</style>
