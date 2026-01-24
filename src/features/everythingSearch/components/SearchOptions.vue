<template>
  <div class="search-options">
    <!-- 自动搜索选项 -->
    <label class="option-item checkbox-option">
      <input type="checkbox" :checked="options.autoSearch" @change="updateOption('autoSearch', ($event.target as HTMLInputElement).checked)" />
      <span>自动搜索</span>
    </label>

    <!-- 区分大小写 -->
    <label class="option-item checkbox-option">
      <input type="checkbox" :checked="options.matchCase" @change="updateOption('matchCase', ($event.target as HTMLInputElement).checked)" />
      <span>区分大小写</span>
    </label>

    <!-- 全词匹配 -->
    <label class="option-item checkbox-option">
      <input type="checkbox" :checked="options.matchWholeWord" @change="updateOption('matchWholeWord', ($event.target as HTMLInputElement).checked)" />
      <span>全词匹配</span>
    </label>

    <!-- 匹配路径 -->
    <label class="option-item checkbox-option">
      <input type="checkbox" :checked="options.matchPath" @change="updateOption('matchPath', ($event.target as HTMLInputElement).checked)" />
      <span>匹配路径</span>
    </label>

    <!-- 正则表达式 -->
    <label class="option-item checkbox-option">
      <input type="checkbox" :checked="options.regex" @change="updateOption('regex', ($event.target as HTMLInputElement).checked)" />
      <span>正则表达式</span>
    </label>

    <!-- 最大结果数 -->
    <div class="option-item select-option">
      <span>最大结果:</span>
      <select :value="options.maxResults" @change="updateOption('maxResults', Number(($event.target as HTMLSelectElement).value))" class="results-select">
        <option :value="50">50</option>
        <option :value="100">100</option>
        <option :value="200">200</option>
        <option :value="500">500</option>
      </select>
    </div>

    <!-- 防抖延迟（仅自动搜索时显示） -->
    <div v-if="options.autoSearch" class="option-item select-option debounce-delay">
      <span>延迟:</span>
      <select :value="options.debounceDelay" @change="updateOption('debounceDelay', Number(($event.target as HTMLSelectElement).value))" class="delay-select">
        <option :value="200">200ms</option>
        <option :value="500">500ms</option>
        <option :value="1000">1s</option>
      </select>
    </div>

    <!-- 排序选项 -->
    <div class="option-item select-option sort-option">
      <span>排序:</span>
      <select :value="options.sort" @change="updateOption('sort', ($event.target as HTMLSelectElement).value)" class="sort-select">
        <option value="date_modified">修改时间</option>
        <option value="name">名称</option>
        <option value="path">路径</option>
        <option value="size">大小</option>
      </select>
      <label class="ascending-label">
        <input type="checkbox" :checked="options.ascending" @change="updateOption('ascending', ($event.target as HTMLInputElement).checked)" />
        <span>升序</span>
      </label>
    </div>

    <!-- 盘符过滤 -->
    <div class="option-item select-option drive-filter">
      <span>盘符:</span>
      <select :value="options.selectedDrive" @change="handleDriveChange" class="drive-select">
        <option value="">所有盘符</option>
        <option v-for="drive in availableDrives" :key="drive" :value="drive">
          {{ drive }}
        </option>
      </select>
      <button class="refresh-drives-btn" @click="handleRefreshDrives" title="刷新盘符列表" aria-label="刷新盘符列表">
        <span class="refresh-icon">🔄</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SearchOptions } from '../types'

interface Props {
  /** 搜索选项 */
  options: SearchOptions
  /** 可用盘符列表 */
  availableDrives: string[]
}

interface Emits {
  (e: 'update:options', key: keyof SearchOptions, value: SearchOptions[keyof SearchOptions]): void
  (e: 'driveChange', drive: string): void
  (e: 'refreshDrives'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 更新选项 */
const updateOption = (key: keyof SearchOptions, value: SearchOptions[keyof SearchOptions]) => {
  emit('update:options', key, value)
}

/** 处理盘符变化 */
const handleDriveChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  emit('driveChange', value)
}

/** 处理刷新盘符 */
const handleRefreshDrives = () => {
  emit('refreshDrives')
}
</script>

<style scoped lang="scss">
@import '@/index.scss';

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

.checkbox-option {
  cursor: pointer;
}

.option-item input[type="checkbox"] {
  width: 12px;
  height: 12px;
  cursor: pointer;
  accent-color: $brand-orange;
}

.select-option span {
  white-space: nowrap;
}

.results-select,
.delay-select,
.sort-select,
.drive-select {
  padding: 2px 6px;
  border: 1px solid var(--b3-border-color);
  border-radius: 3px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 11px;
  font-family: $font-body;
  cursor: pointer;
  transition: border-color 0.15s;
}

.results-select:hover,
.delay-select:hover,
.sort-select:hover,
.drive-select:hover {
  border-color: $brand-orange;
}

.results-select:focus,
.delay-select:focus,
.sort-select:focus,
.drive-select:focus {
  outline: none;
  border-color: $brand-orange;
  box-shadow: 0 0 0 2px rgba(217, 119, 87, 0.1);
}

.debounce-delay {
  margin-left: 4px;
}

.sort-option {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ascending-label {
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
}

.drive-filter {
  display: flex;
  align-items: center;
  gap: 4px;
}

.refresh-drives-btn {
  padding: 3px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 3px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 20px;
}

.refresh-drives-btn:hover {
  background: $brand-blue;
  border-color: $brand-blue;
  color: $brand-light;
}

.refresh-icon {
  font-size: 11px;
  line-height: 1;
}
</style>
