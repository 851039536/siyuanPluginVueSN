<!-- 统计面板头部：标题栏 + 刷新按钮 + 存储路径展示 -->
<template>
  <div class="statistics-header">
    <div class="header-left">
      <Button
        :icon="refreshIcon"
        variant="ghost"
        size="xsmall"
        :loading="loading"
        :title="i18n.refresh"
        @click="handleRefresh"
      />
      <button
        class="storage-toggle-btn"
        :title="showStorage ? i18n.hideStoragePath : i18n.showStoragePath"
        @click="showStorage = !showStorage"
      >
        <svg><use xlink:href="#iconFolder"></use></svg>
      </button>
      <!-- 自动刷新间隔下拉："关闭"选项值为 0 -->
      <select
        class="refresh-interval-select"
        :value="autoRefreshInterval"
        :title="i18n.autoRefresh"
        @change="handleIntervalChange"
      >
        <option
          v-for="opt in intervalOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ i18n[opt.labelKey] }}
        </option>
      </select>
    </div>
    <div class="header-right">
      <div class="last-update">
        {{ i18n.lastUpdate }}: {{ lastUpdateTime }}
      </div>
    </div>
  </div>
  <div
    v-if="showStorage && storagePaths && storagePaths.length > 0"
    class="storage-paths"
  >
    <div
      v-for="item in storagePaths"
      :key="item.key"
      class="storage-path-item"
    >
      <span class="storage-key">{{ item.key }}</span>
      <span class="storage-desc">{{ item.desc }}</span>
      <span
        class="storage-path"
        :title="item.path"
      >{{ item.path }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import {
  computed,
  ref,
} from "vue"
import Button from "@/components/Button.vue"

interface StoragePathItem {
  key: string
  desc: string
  path: string
}

interface Props {
  loading?: boolean
  lastUpdateTime?: string
  storagePaths?: StoragePathItem[]
  /** 当前自动刷新间隔（分钟，0 = 关闭） */
  autoRefreshInterval?: number
  i18n?: Record<string, any>
}

interface Emits {
  (e: "refresh"): void
  (e: "autoRefreshChange", interval: number): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  lastUpdateTime: "",
  storagePaths: () => [],
  autoRefreshInterval: 0,
  i18n: () => ({}),
})

const emit = defineEmits<Emits>()

const showStorage = ref(false)

const refreshIcon = computed<IconKey>(() => {
  return props.loading ? "loading" : "refresh"
})

/** 自动刷新间隔选项（分钟），0 = 关闭；label 直接取 i18n 键，不硬编码兜底 */
const intervalOptions = [
  { value: 0, labelKey: "refreshOff" },
  { value: 1, labelKey: "interval1min" },
  { value: 5, labelKey: "interval5min" },
  { value: 10, labelKey: "interval10min" },
  { value: 30, labelKey: "interval30min" },
  { value: 60, labelKey: "interval1hour" },
  { value: 120, labelKey: "interval2hour" },
  { value: 360, labelKey: "interval6hour" },
] as const

function handleRefresh() {
  emit("refresh")
}

function handleIntervalChange(e: Event): void {
  const value = Number((e.target as HTMLSelectElement).value)
  emit("autoRefreshChange", value)
}
</script>

<style scoped lang="scss">
@use "../../styles/StatisticsHeader.scss";
@use '../../styles/index.scss' as stats;
</style>

