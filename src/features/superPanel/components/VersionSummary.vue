<template>
  <div class="vs">
    <!-- 汇总统计 -->
    <div class="vs-meta">
      <div class="vs-meta-row">
        <span class="vs-meta-key">FEATURES</span>
        <code class="vs-meta-val vs-meta-val--primary">{{ rows.length }}</code>
      </div>
      <div class="vs-meta-row">
        <span class="vs-meta-key">RELEASES</span>
        <code class="vs-meta-val">{{ totalVersions }}</code>
      </div>
    </div>

    <!-- 版本表格 -->
    <div class="vs-table-wrap">
      <table class="vs-table">
        <thead>
          <tr>
            <th class="vs-th">
              {{ i18n.title || '功能' }}
            </th>
            <th
              class="vs-th vs-th--sortable"
              @click="toggleSort('version')"
            >
              {{ i18n.versionColumn || '版本' }}
              <span
                v-if="sortKey === 'version'"
                class="vs-sort-icon"
              >{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th
              class="vs-th vs-th--sortable"
              @click="toggleSort('date')"
            >
              {{ i18n.lastUpdate || '最近更新' }}
              <span
                v-if="sortKey === 'date'"
                class="vs-sort-icon"
              >{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th
              class="vs-th vs-th--sortable vs-th--center"
              @click="toggleSort('count')"
            >
              {{ i18n.versionCount || '版本数' }}
              <span
                v-if="sortKey === 'count'"
                class="vs-sort-icon"
              >{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th class="vs-th vs-th--right">
              {{ i18n.actionColumn || '操作' }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in sortedRows"
            :key="row.id"
            class="vs-row"
          >
            <td class="vs-td">
              <div class="vs-feature">
                <IconWrapper
                  :name="row.iconKey"
                  :size="14"
                  class="vs-feature-icon"
                />
                <span class="vs-feature-title">{{ row.title }}</span>
              </div>
            </td>
            <td class="vs-td vs-td--mono">
              {{ row.version }}
            </td>
            <td class="vs-td vs-td--mono vs-td--muted">
              {{ row.lastDate || (i18n.noVersions || '—') }}
            </td>
            <td class="vs-td vs-td--center vs-td--mono">
              {{ row.count }}
            </td>
            <td class="vs-td vs-td--right">
              <button
                class="vs-detail-btn"
                @click="emit('openVersions', row.id)"
              >
                {{ i18n.viewDetails || '详情' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeatureVersionEntry } from "../types"
import type { IconKey } from "@/config/icons"
import type { FeatureMeta } from "@/features/config"
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { FEATURE_CONFIG } from "@/features/config"
import { DEFAULT_VERSION } from "../types"

interface FeatureRow {
  id: string
  iconKey: IconKey
  title: string
  version: string
  lastDate: string
  count: number
}

interface Props {
  i18n: Record<string, any>
  featureVersions?: Record<string, FeatureVersionEntry[]>
}

interface Emits {
  (e: "openVersions", featureId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const sortKey = ref<"version" | "date" | "count">("date")
const sortDir = ref<"asc" | "desc">("desc")

const toggleSort = (key: "version" | "date" | "count"): void => {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc"
  } else {
    sortKey.value = key
    sortDir.value = key === "count" ? "desc" : "desc"
  }
}

const rows = computed<FeatureRow[]>(() =>
  (FEATURE_CONFIG as unknown as FeatureMeta[]).map((meta) => {
    const versions = props.featureVersions?.[meta.id] || []
    const latest = versions[0]
    return {
      id: meta.id,
      iconKey: meta.id as IconKey,
      title: meta.defaultTitle,
      version: latest?.version || DEFAULT_VERSION,
      lastDate: latest?.date || "",
      count: versions.length,
    }
  }),
)

const totalVersions = computed(() =>
  rows.value.reduce((sum, r) => sum + r.count, 0),
)

const sortedRows = computed(() => {
  const sorted = [...rows.value]
  const dir = sortDir.value === "asc" ? 1 : -1

  sorted.sort((a, b) => {
    if (sortKey.value === "count") {
      return (a.count - b.count) * dir
    }
    if (sortKey.value === "date") {
      const da = a.lastDate || ""
      const db = b.lastDate || ""
      return da.localeCompare(db) * dir
    }
    // version: 按段比较
    const pa = a.version.split(".").map(Number)
    const pb = b.version.split(".").map(Number)
    const len = Math.max(pa.length, pb.length)
    for (let i = 0; i < len; i++) {
      const va = pa[i] || 0
      const vb = pb[i] || 0
      if (va !== vb) return (va - vb) * dir
    }
    return 0
  })

  return sorted
})
</script>
