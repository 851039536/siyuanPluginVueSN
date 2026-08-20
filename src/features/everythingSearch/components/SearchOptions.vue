<template>
  <div class="vp-options">
    <!-- 行1：开关组 -->
    <div class="vp-options__row">
      <!-- 开关标签："区分大小写" -->
      <Switch
        :model-value="options.matchCase"
        size="xsmall"
        :label="i18n.caseSensitive"
        label-before
        @update:model-value="updateOption('matchCase', $event)"
      />
      <!-- 开关标签："全词匹配" -->
      <Switch
        :model-value="options.matchWholeWord"
        size="xsmall"
        :label="i18n.wholeWord"
        label-before
        @update:model-value="updateOption('matchWholeWord', $event)"
      />
      <!-- 开关标签："匹配路径" -->
      <Switch
        :model-value="options.matchPath"
        size="xsmall"
        :label="i18n.matchPath"
        label-before
        @update:model-value="updateOption('matchPath', $event)"
      />
      <!-- 开关标签："正则" -->
      <Switch
        :model-value="options.regex"
        size="xsmall"
        :label="i18n.regex"
        label-before
        @update:model-value="updateOption('regex', $event)"
      />
      <!-- 开关标签："高级模式" -->
      <Switch
        :model-value="options.advancedMode"
        size="xsmall"
        :label="i18n.advancedMode"
        label-before
        @update:model-value="updateOption('advancedMode', $event)"
      />
    </div>

    <!-- 行2：配置选单 -->
    <div class="vp-options__row">
      <div class="vp-options__item vp-options__item--select">
        <!-- 选项标签："数量" -->
        <span class="vp-options__key">{{ i18n.maxResultsLabel }}</span>
        <Select
          :model-value="options.maxResults"
          :options="MAX_RESULTS_OPTIONS"
          size="xsmall"
          @update:model-value="updateOption('maxResults', $event as number)"
        />
      </div>
      <!-- 大小过滤（与数量同行） -->
      <div class="vp-options__item vp-options__item--size">
        <!-- 选项标签："大小" -->
        <span class="vp-options__key">{{ i18n.sizeLabel }}</span>
        <input
          type="number"
          class="vp-options__size-input"
          :value="options.minSize"
          min="0"
          @input="onSizeInput('minSize', $event)"
        />
        <Select
          :model-value="options.minSizeUnit"
          :options="SIZE_UNIT_OPTIONS"
          size="xsmall"
          @update:model-value="updateOption('minSizeUnit', $event as SearchOptions['minSizeUnit'])"
        />
        <span class="vp-options__size-sep">-</span>
        <input
          type="number"
          class="vp-options__size-input"
          :value="options.maxSize"
          min="0"
          @input="onSizeInput('maxSize', $event)"
        />
        <Select
          :model-value="options.maxSizeUnit"
          :options="SIZE_UNIT_OPTIONS"
          size="xsmall"
          @update:model-value="updateOption('maxSizeUnit', $event as SearchOptions['maxSizeUnit'])"
        />
      </div>
      <div class="vp-options__item vp-options__item--select">
        <!-- 选项标签："延迟" -->
        <span class="vp-options__key">{{ i18n.debounceLabel }}</span>
        <Select
          :model-value="options.debounceDelay"
          :options="DEBOUNCE_OPTIONS"
          size="xsmall"
          @update:model-value="updateOption('debounceDelay', $event as number)"
        />
      </div>
      <div class="vp-options__item vp-options__item--select">
        <!-- 选项标签："排序" -->
        <span class="vp-options__key">{{ i18n.sortLabel }}</span>
        <Select
          :model-value="options.sort"
          :options="sortOptions"
          size="xsmall"
          @update:model-value="updateOption('sort', ($event as unknown) as SearchOptions['sort'])"
        />
        <Switch
          :model-value="options.ascending"
          size="xsmall"
          :label="options.ascending ? '↑' : '↓'"
          @update:model-value="updateOption('ascending', $event)"
        />
      </div>
    </div>

    <!-- 行3：路径范围过滤（仅搜索路径 / 排除路径，每行一个，支持多个；开关开启才生效） -->
    <div class="vp-options__row vp-options__row--paths">
      <div class="vp-options__path-group">
        <div class="vp-options__path-head">
          <!-- 标签："仅搜索路径" + 启用开关 -->
          <span class="vp-options__key">{{ i18n.includePathsLabel }}</span>
          <Switch
            :model-value="options.includePathsEnabled"
            size="xsmall"
            @update:model-value="updateOption('includePathsEnabled', $event)"
          />
        </div>
        <textarea
          class="vp-options__path-input"
          :class="{ 'vp-options__path-input--disabled': !options.includePathsEnabled }"
          :value="includePathsText"
          rows="2"
          :disabled="!options.includePathsEnabled"
          :placeholder="i18n.includePathsPlaceholder"
          @input="onPathsInput('includePaths', $event)"
        ></textarea>
      </div>
      <div class="vp-options__path-group">
        <div class="vp-options__path-head">
          <!-- 标签："排除路径" + 启用开关 -->
          <span class="vp-options__key">{{ i18n.excludePathsLabel }}</span>
          <Switch
            :model-value="options.excludePathsEnabled"
            size="xsmall"
            @update:model-value="updateOption('excludePathsEnabled', $event)"
          />
        </div>
        <textarea
          class="vp-options__path-input"
          :class="{ 'vp-options__path-input--disabled': !options.excludePathsEnabled }"
          :value="excludePathsText"
          rows="2"
          :disabled="!options.excludePathsEnabled"
          :placeholder="i18n.excludePathsPlaceholder"
          @input="onPathsInput('excludePaths', $event)"
        ></textarea>
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
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
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
  {
    value: 50,
    label: "50",
  },
  {
    value: 100,
    label: "100",
  },
  {
    value: 200,
    label: "200",
  },
  {
    value: 500,
    label: "500",
  },
]

/** 防抖延迟选项 */
const DEBOUNCE_OPTIONS = [
  {
    value: 200,
    label: "200ms",
  },
  {
    value: 500,
    label: "500ms",
  },
  {
    value: 1000,
    label: "1s",
  },
]

/** 排序选项（label 走 i18n：修改时间/名称/路径/大小） */
const sortOptions = computed(() => [
  {
    value: "date_modified",
    label: props.i18n.sortByModTime,
  },
  {
    value: "name",
    label: props.i18n.sortByName,
  },
  {
    value: "path",
    label: props.i18n.sortByPath,
  },
  {
    value: "size",
    label: props.i18n.sortBySize,
  },
])

/** 文件大小单位选项 */
const SIZE_UNIT_OPTIONS = [
  {
    value: "KB",
    label: "KB",
  },
  {
    value: "MB",
    label: "MB",
  },
  {
    value: "GB",
    label: "GB",
  },
]

/** 更新选项 */
const updateOption = (
  key: keyof SearchOptions,
  value: SearchOptions[keyof SearchOptions],
) => {
  emit("update:options", key, value)
}

/** 处理文件大小输入（minSize/maxSize 共用） */
const onSizeInput = (key: "minSize" | "maxSize", event: Event) => {
  const val = (event.target as HTMLInputElement).valueAsNumber
  emit("update:options", key, Number.isNaN(val) || val < 0 ? 0 : val)
}

/** 仅搜索路径文本（数组 ↔ 换行文本，每行一个路径） */
const includePathsText = computed(() => props.options.includePaths.join("\n"))

/** 排除路径文本（数组 ↔ 换行文本，每行一个路径） */
const excludePathsText = computed(() => props.options.excludePaths.join("\n"))

/** 处理路径文本输入：按换行拆分、去空行后写回数组 */
const onPathsInput = (key: "includePaths" | "excludePaths", event: Event) => {
  const raw = (event.target as HTMLTextAreaElement).value
  const paths = raw
    .split(/[\r\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  emit("update:options", key, paths)
}
</script>

<style scoped lang="scss">
@use "../styles/SearchOptions.scss";
</style>
