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
          @update:model-value="updateOption('sort', ($event as unknown) as SearchOptions['sort'])"
        />
        <Switch
          :model-value="options.ascending"
          size="small"
          :label="options.ascending ? '↑' : '↓'"
          @update:model-value="updateOption('ascending', $event)"
        />
      </div>

      <!-- 文件大小过滤 -->
      <div class="vp-options__item vp-options__item--size">
        <span class="vp-options__key">大小</span>
        <input
          type="number"
          class="vp-options__size-input"
          :value="options.minSize || ''"
          min="0"
          placeholder="≥"
          @input="onMinSizeInput"
        />
        <Select
          :model-value="options.minSizeUnit"
          :options="SIZE_UNIT_OPTIONS"
          size="small"
          @update:model-value="updateOption('minSizeUnit', $event as SearchOptions['minSizeUnit'])"
        />
        <span class="vp-options__size-sep">-</span>
        <input
          type="number"
          class="vp-options__size-input"
          :value="options.maxSize || ''"
          min="0"
          placeholder="≤"
          @input="onMaxSizeInput"
        />
        <Select
          :model-value="options.maxSizeUnit"
          :options="SIZE_UNIT_OPTIONS"
          size="small"
          @update:model-value="updateOption('maxSizeUnit', $event as SearchOptions['maxSizeUnit'])"
        />
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import type { SearchOptions } from "../types"
import Select from "@/components/Select.vue"
import Switch from "@/components/Switch.vue"

interface Props {
  /** 搜索选项 */
  options: SearchOptions
}

interface Emits {
  (
    e: "update:options",
    key: keyof SearchOptions,
    value: SearchOptions[keyof SearchOptions],
  ): void
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

/** 文件大小单位选项 */
const SIZE_UNIT_OPTIONS = [
  { value: "KB", label: "KB" },
  { value: "MB", label: "MB" },
  { value: "GB", label: "GB" },
]

/** 更新选项 */
const updateOption = (
  key: keyof SearchOptions,
  value: SearchOptions[keyof SearchOptions],
) => {
  emit("update:options", key, value)
}

/** 处理最小尺寸输入 */
const onMinSizeInput = (event: Event) => {
  const val = (event.target as HTMLInputElement).valueAsNumber
  emit("update:options", "minSize", isNaN(val) || val < 0 ? 0 : val)
}

/** 处理最大尺寸输入 */
const onMaxSizeInput = (event: Event) => {
  const val = (event.target as HTMLInputElement).valueAsNumber
  emit("update:options", "maxSize", isNaN(val) || val < 0 ? 0 : val)
}
</script>

<style scoped lang="scss">
@use "../styles/SearchOptions.scss";
</style>
