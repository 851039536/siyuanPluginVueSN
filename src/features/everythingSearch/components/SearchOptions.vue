<template>
  <div class="search-options">
    <!-- 自动搜索选项 -->
    <div class="option-item">
      <Switch
        :model-value="options.autoSearch"
        size="small"
        label="自动搜索"
        @update:model-value="updateOption('autoSearch', $event)"
      />
    </div>

    <!-- 区分大小写 -->
    <div class="option-item">
      <Switch
        :model-value="options.matchCase"
        size="small"
        label="区分大小写"
        @update:model-value="updateOption('matchCase', $event)"
      />
    </div>

    <!-- 全词匹配 -->
    <div class="option-item">
      <Switch
        :model-value="options.matchWholeWord"
        size="small"
        label="全词匹配"
        @update:model-value="updateOption('matchWholeWord', $event)"
      />
    </div>

    <!-- 匹配路径 -->
    <div class="option-item">
      <Switch
        :model-value="options.matchPath"
        size="small"
        label="匹配路径"
        @update:model-value="updateOption('matchPath', $event)"
      />
    </div>

    <!-- 正则表达式 -->
    <div class="option-item">
      <Switch
        :model-value="options.regex"
        size="small"
        label="正则表达式"
        @update:model-value="updateOption('regex', $event)"
      />
    </div>

    <!-- 最大结果数 -->
    <div class="option-item select-option">
      <span class="option-label">最大结果:</span>
      <Select
        :model-value="options.maxResults"
        :options="maxResultsOptions"
        size="small"
        @update:model-value="updateOption('maxResults', $event as number)"
      />
    </div>

    <!-- 防抖延迟（仅自动搜索时显示） -->
    <div v-if="options.autoSearch" class="option-item select-option debounce-delay">
      <span class="option-label">延迟:</span>
      <Select
        :model-value="options.debounceDelay"
        :options="debounceOptions"
        size="small"
        @update:model-value="updateOption('debounceDelay', $event as number)"
      />
    </div>

    <!-- 排序选项 -->
    <div class="option-item select-option sort-option">
      <span class="option-label">排序:</span>
      <Select
        :model-value="options.sort"
        :options="sortOptions"
        size="small"
        @update:model-value="updateOption('sort', $event as string)"
      />
      <Switch
        :model-value="options.ascending"
        size="small"
        label="升序"
        @update:model-value="updateOption('ascending', $event)"
      />
    </div>

    <!-- 盘符过滤 -->
    <div class="option-item select-option drive-filter">
      <span class="option-label">盘符:</span>
      <Select
        :model-value="options.selectedDrive"
        :options="driveOptions"
        size="small"
        @update:model-value="handleDriveChange"
      />
      <Button
        variant="ghost"
        size="small"
        icon="refresh"
        :icon-size="12"
        title="刷新盘符列表"
        aria-label="刷新盘符列表"
        @click="handleRefreshDrives"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Switch from "@/components/Switch.vue";
import Select from "@/components/Select.vue";
import Button from "@/components/Button.vue";
import type { SearchOptions } from "../types";

interface Props {
	/** 搜索选项 */
	options: SearchOptions;
	/** 可用盘符列表 */
	availableDrives: string[];
}

interface Emits {
	(
		e: "update:options",
		key: keyof SearchOptions,
		value: SearchOptions[keyof SearchOptions],
	): void;
	(e: "driveChange", drive: string): void;
	(e: "refreshDrives"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

/** 最大结果选项 */
const maxResultsOptions = computed(() => [
	{ value: 50, label: "50" },
	{ value: 100, label: "100" },
	{ value: 200, label: "200" },
	{ value: 500, label: "500" },
]);

/** 防抖延迟选项 */
const debounceOptions = computed(() => [
	{ value: 200, label: "200ms" },
	{ value: 500, label: "500ms" },
	{ value: 1000, label: "1s" },
]);

/** 排序选项 */
const sortOptions = computed(() => [
	{ value: "date_modified", label: "修改时间" },
	{ value: "name", label: "名称" },
	{ value: "path", label: "路径" },
	{ value: "size", label: "大小" },
]);

/** 盘符选项 */
const driveOptions = computed(() => [
	{ value: "", label: "所有盘符" },
	...props.availableDrives.map((drive) => ({ value: drive, label: drive })),
]);

/** 更新选项 */
const updateOption = (
	key: keyof SearchOptions,
	value: SearchOptions[keyof SearchOptions],
) => {
	emit("update:options", key, value);
};

/** 处理盘符变化 */
const handleDriveChange = (value: string | number | boolean | null) => {
	emit("driveChange", String(value || ""));
};

/** 处理刷新盘符 */
const handleRefreshDrives = () => {
	emit("refreshDrives");
};
</script>

<style scoped lang="scss">
@use "@/variables" as *;

.search-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 16px;
  background: var(--b3-theme-surface-light);
  border-bottom: 1px solid var(--b3-border-color);
}

.option-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-family: $font-body;
  color: var(--b3-theme-on-surface);
}

.option-label {
  white-space: nowrap;
  font-size: 12px;
}

.select-option {
  display: flex;
  align-items: center;
  gap: 4px;
}

.debounce-delay {
  margin-left: 4px;
}

.sort-option {
  display: flex;
  align-items: center;
  gap: 4px;
}

.drive-filter {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
