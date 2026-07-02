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
@use "@/variables" as *;
@use "../styles/index.scss" as stats;

.notebook-table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--b3-border-color);
    border-radius: 2px;
  }
}

.notebook-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.nb-th {
  padding: 6px 8px;
  text-align: left;
  font-family: stats.$font-mono;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  border-bottom: 1px solid var(--b3-border-color);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  position: sticky;
  top: 0;
  background: var(--b3-theme-surface);
  z-index: 1;

  &:hover {
    opacity: 0.8;
  }

  &.nb-th-active {
    opacity: 1;
    color: var(--b3-theme-primary);
  }
}

.sort-arrow {
  margin-left: 2px;
  font-size: 10px;
}

.nb-tr {
  transition: background 0.15s, box-shadow 0.15s;

  &:hover {
    background: var(--b3-list-hover);
  }

  &.nb-tr-highlight {
    background: rgba(var(--b3-theme-primary-rgb), 0.1);
    box-shadow: inset 3px 0 0 var(--b3-theme-primary);
  }
}

.nb-td {
  padding: 5px 8px;
  border-bottom: 1px solid rgba(var(--b3-border-color-rgb, 128, 128, 128), 0.15);
}

.nb-td-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.nb-color-dot {
  width: 8px;
  height: 8px;
  border-radius: stats.$radius-sm;
  flex-shrink: 0;
}

.nb-td-num {
  font-family: stats.$font-mono;
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}

.nb-td-pct {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}

.pct-bar-wrap {
  width: 48px;
  height: 6px;
  background: rgba(var(--b3-theme-on-surface-rgb), 0.06);
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}

.pct-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
  min-width: 1px;
}
</style>
