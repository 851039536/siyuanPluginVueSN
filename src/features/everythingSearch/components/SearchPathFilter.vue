<!-- 路径范围过滤：仅搜索路径 / 排除路径两组（共享 Textarea + Switch），每行一个路径 -->
<template>
  <div class="vp-path-filter">
    <div class="vp-path-filter__group">
      <div class="vp-path-filter__head">
        <!-- 标签："仅搜索路径" + 启用开关（开关无可视文案，可访问名称由 aria-label 提供） -->
        <span class="vp-path-filter__key">{{ i18n.includePathsLabel }}</span>
        <Switch
          :model-value="options.includePathsEnabled"
          size="xsmall"
          :aria-label="i18n.includePathsLabel"
          @update:model-value="updateSwitch('includePathsEnabled', $event)"
        />
      </div>
      <Textarea
        class="vp-path-filter__input"
        size="xsmall"
        :rows="PATH_ROWS"
        :model-value="includePathsText"
        :disabled="!options.includePathsEnabled"
        :placeholder="i18n.includePathsPlaceholder"
        :aria-label="i18n.includePathsLabel"
        @update:model-value="onPathsInput('includePaths', $event)"
      />
    </div>
    <div class="vp-path-filter__group">
      <div class="vp-path-filter__head">
        <!-- 标签："排除路径" + 启用开关 -->
        <span class="vp-path-filter__key">{{ i18n.excludePathsLabel }}</span>
        <Switch
          :model-value="options.excludePathsEnabled"
          size="xsmall"
          :aria-label="i18n.excludePathsLabel"
          @update:model-value="updateSwitch('excludePathsEnabled', $event)"
        />
      </div>
      <Textarea
        class="vp-path-filter__input"
        size="xsmall"
        :rows="PATH_ROWS"
        :model-value="excludePathsText"
        :disabled="!options.excludePathsEnabled"
        :placeholder="i18n.excludePathsPlaceholder"
        :aria-label="i18n.excludePathsLabel"
        @update:model-value="onPathsInput('excludePaths', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SearchOptions } from "../types"
import { computed } from "vue"
import Switch from "@/components/Switch.vue"
import Textarea from "@/components/Textarea.vue"

interface Props {
  /** 搜索选项（本组件只读写路径过滤相关字段） */
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

/** 路径输入框可见行数（与整改前的 rows="2" 一致） */
const PATH_ROWS = 2

/** 仅搜索路径文本（数组 ↔ 换行文本，每行一个路径） */
const includePathsText = computed(() => props.options.includePaths.join("\n"))

/** 排除路径文本（数组 ↔ 换行文本，每行一个路径） */
const excludePathsText = computed(() => props.options.excludePaths.join("\n"))

/** 处理路径文本输入：按换行拆分、去空行后写回数组 */
const onPathsInput = (key: "includePaths" | "excludePaths", raw: string) => {
  const paths = raw
    .split(/[\r\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  emit("update:options", key, paths)
}

/** 更新启用开关 */
const updateSwitch = (key: "includePathsEnabled" | "excludePathsEnabled", value: boolean) => {
  emit("update:options", key, value)
}
</script>

<style scoped lang="scss">
@use "../styles/SearchPathFilter.scss";
</style>
