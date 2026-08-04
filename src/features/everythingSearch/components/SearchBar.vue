<template>
  <div class="vp-search">
    <Input
      ref="inputRef"
      :model-value="modelValue"
      type="text"
      size="xsmall"
      :placeholder="i18n.searchPlaceholder"
      prefix-icon="search"
      :clearable="true"
      @update:model-value="handleInput"
      @keydown="handleKeydown"
      @clear="handleClear"
    />
    <!-- 搜索按钮："搜索" -->
    <Button
      variant="primary"
      size="xsmall"
      :disabled="isSearching || !modelValue?.trim()"
      :loading="isSearching"
      @click="handleSearch"
    >
      {{ i18n.search }}
    </Button>
    <!-- 按钮："空文件夹"（点击直接查询空文件夹，自动排除系统路径） -->
    <Button
      variant="secondary"
      size="xsmall"
      :disabled="isSearching"
      @click="handleEmptySearch"
    >
      {{ i18n.emptyFolders }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import {
  nextTick,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"

interface Props {
  /** 搜索关键词 */
  modelValue: string
  /** 是否正在搜索 */
  isSearching: boolean
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  (e: "update:modelValue", value: string): void
  (e: "search"): void
  (e: "empty-search"): void
  (e: "clear"): void
  (e: "escape"): void
}

defineProps<Props>()

const emit = defineEmits<Emits>()

const inputRef = ref<InstanceType<typeof Input> | null>(null)

/** 处理输入 */
const handleInput = (value: string | number | null) => {
  emit("update:modelValue", String(value || ""))
}

/** 处理键盘事件 */
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    emit("search")
  } else if (event.key === "Escape") {
    emit("escape")
  }
}

/** 处理清除 */
const handleClear = () => {
  emit("update:modelValue", "")
  emit("clear")
}

/** 处理搜索 */
const handleSearch = () => {
  emit("search")
}

/** 处理空文件夹搜索 */
const handleEmptySearch = () => {
  emit("empty-search")
}

/** 聚焦输入框 */
const focus = async () => {
  await nextTick()
  inputRef.value?.focus()
}

// 暴露方法供父组件调用
defineExpose({
  focus,
})
</script>

<style scoped lang="scss">
@use "../styles/SearchBar.scss";
</style>
