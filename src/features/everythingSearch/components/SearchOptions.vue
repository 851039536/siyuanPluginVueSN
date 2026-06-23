<template>
  <div class="vp-options">
    <!-- 区分大小写 -->
    <label class="vp-options__item">
      <Switch
        :model-value="options.matchCase"
        size="small"
        label="区分大小写"
        @update:model-value="updateOption('matchCase', $event)"
      />
    </label>

    <!-- 全词匹配 -->
    <label class="vp-options__item">
      <Switch
        :model-value="options.matchWholeWord"
        size="small"
        label="全词匹配"
        @update:model-value="updateOption('matchWholeWord', $event)"
      />
    </label>

    <!-- 匹配路径 -->
    <label class="vp-options__item">
      <Switch
        :model-value="options.matchPath"
        size="small"
        label="匹配路径"
        @update:model-value="updateOption('matchPath', $event)"
      />
    </label>

    <!-- 正则 -->
    <label class="vp-options__item">
      <Switch
        :model-value="options.regex"
        size="small"
        label="正则"
        @update:model-value="updateOption('regex', $event)"
      />
    </label>

    <!-- 配置选单组 -->
    <div class="vp-options__group">
      <div class="vp-options__item">
        <Switch
          :model-value="options.advancedMode"
          size="small"
          label="高级模式"
          @update:model-value="updateOption('advancedMode', $event)"
        />
      </div>

      <div class="vp-options__item vp-options__item--select">
        <span class="vp-options__key">数量</span>
        <Select
          :model-value="options.maxResults"
          :options="MAX_RESULTS_OPTIONS"
          size="small"
          @update:model-value="updateOption('maxResults', $event as number)"
        />
      </div>

      <div class="vp-options__item vp-options__item--select">
        <span class="vp-options__key">延迟</span>
        <Select
          :model-value="options.debounceDelay"
          :options="DEBOUNCE_OPTIONS"
          size="small"
          @update:model-value="updateOption('debounceDelay', $event as number)"
        />
      </div>

      <div class="vp-options__item vp-options__item--select">
        <span class="vp-options__key">排序</span>
        <Select
          :model-value="options.sort"
          :options="SORT_OPTIONS"
          size="small"
          @update:model-value="updateOption('sort', $event as string)"
        />
        <Switch
          :model-value="options.ascending"
          size="small"
          label="↑"
          @update:model-value="updateOption('ascending', $event)"
        />
      </div>

      <div class="vp-options__item vp-options__item--select">
        <span class="vp-options__key">盘符</span>
        <Select
          :model-value="options.selectedDrive"
          :options="driveOptions"
          size="small"
          @update:model-value="handleDriveChange"
        />
        <button
          class="vp-options__refresh"
          title="刷新盘符列表"
          aria-label="刷新盘符列表"
          @click="handleRefreshDrives"
        >
          ↻
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SearchOptions } from "../types"
import { computed } from "vue"
import Select from "@/components/Select.vue"
import Switch from "@/components/Switch.vue"

interface Props {
  /** 搜索选项 */
  options: SearchOptions
  /** 可用盘符列表 */
  availableDrives: string[]
}

interface Emits {
  (
    e: "update:options",
    key: keyof SearchOptions,
    value: SearchOptions[keyof SearchOptions],
  ): void
  (e: "driveChange", drive: string): void
  (e: "refreshDrives"): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 最大结果选项 */
const MAX_RESULTS_OPTIONS = [
  { value: 50, label: "50" },
  { value: 100, label: "100" },
  { value: 200, label: "200" },
  { value: 500, label: "500" },
]

/** 防抖延迟选项 */
const DEBOUNCE_OPTIONS = [
  { value: 200, label: "200ms" },
  { value: 500, label: "500ms" },
  { value: 1000, label: "1s" },
]

/** 排序选项 */
const SORT_OPTIONS = [
  { value: "date_modified", label: "修改时间" },
  { value: "name", label: "名称" },
  { value: "path", label: "路径" },
  { value: "size", label: "大小" },
]

/** 盘符选项 */
const driveOptions = computed(() => [
  { value: "", label: "全部" },
  ...props.availableDrives.map((drive) => ({
    value: drive,
    label: drive,
  })),
])

/** 更新选项 */
const updateOption = (
  key: keyof SearchOptions,
  value: SearchOptions[keyof SearchOptions],
) => {
  emit("update:options", key, value)
}

/** 处理盘符变化 */
const handleDriveChange = (value: string | number | boolean | null) => {
  emit("driveChange", String(value || ""))
}

/** 处理刷新盘符 */
const handleRefreshDrives = () => {
  emit("refreshDrives")
}
</script>

<style scoped lang="scss">
@use "../styles/SearchOptions.scss";
</style>
