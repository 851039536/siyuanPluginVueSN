<template>
  <div class="search-bar">
    <div class="search-input-wrapper">
      <svg class="search-icon"><use xlink:href="#iconSearch"></use></svg>
      <input
        ref="inputRef"
        :model-value="modelValue"
        @input="handleInput"
        type="text"
        class="search-input"
        :placeholder="placeholder"
        @keyup.enter="handleSearchKey"
        @keyup.esc="handleEscapeKey"
      />
      <button v-if="modelValue" class="clear-btn" @click="handleClear" aria-label="清除搜索">
        <svg class="clear-icon"><use xlink:href="#iconClose"></use></svg>
      </button>
    </div>
    <button class="search-btn" @click="handleSearch" :disabled="isSearching || !modelValue?.trim()">
      <span v-if="isSearching" class="loading-spinner"></span>
      <span v-else>{{ searchButtonText }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'

interface Props {
  /** 搜索关键词 */
  modelValue: string
  /** 是否正在搜索 */
  isSearching: boolean
  /** 是否启用自动搜索 */
  autoSearch?: boolean
  /** 输入框占位符 */
  placeholder?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'search'): void
  (e: 'clear'): void
  (e: 'escape'): void
}

const props = withDefaults(defineProps<Props>(), {
  autoSearch: true,
  placeholder: '输入关键词搜索本地文件...'
})

const emit = defineEmits<Emits>()

const inputRef = ref<HTMLInputElement | null>(null)

/** 搜索按钮文本 */
const searchButtonText = computed(() => props.autoSearch ? '立即搜索' : '搜索')

/** 处理输入 */
const handleInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

/** 处理搜索按键 */
const handleSearchKey = () => {
  if (!props.autoSearch) {
    emit('search')
  }
}

/** 处理 Escape 键 */
const handleEscapeKey = () => {
  emit('escape')
}

/** 处理清除 */
const handleClear = () => {
  emit('update:modelValue', '')
  emit('clear')
}

/** 处理搜索 */
const handleSearch = () => {
  emit('search')
}

/** 聚焦输入框 */
const focus = async () => {
  await nextTick()
  inputRef.value?.focus()
}

// 暴露方法供父组件调用
defineExpose({
  focus
})
</script>

<style scoped lang="scss">
@use "@/index.scss" as *;

.search-bar {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input-wrapper:focus-within {
  border-color: $brand-orange;
  box-shadow: 0 0 0 2px rgba(217, 119, 87, 0.1);
}

.search-icon {
  width: 14px;
  height: 14px;
  color: $brand-mid-gray;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-background);
  font-size: 13px;
  font-family: $font-body;
  outline: none;
}

.search-input::placeholder {
  color: $brand-mid-gray;
}

.clear-btn {
  padding: 3px;
  background: transparent;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  color: $brand-mid-gray;
  transition: all 0.15s;
}

.clear-btn:hover {
  color: $brand-orange;
  background: rgba(217, 119, 87, 0.1);
}

.clear-icon {
  width: 12px;
  height: 12px;
}

.search-btn {
  padding: 6px 14px;
  background: $brand-orange;
  color: $brand-light;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: $font-heading;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 65px;
}

.search-btn:hover:not(:disabled) {
  background: shade($brand-orange, 10%);
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(250, 249, 245, 0.3);
  border-top-color: $brand-light;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
