<template>
  <div class="vp-search">
    <Input
      ref="inputRef"
      :model-value="modelValue"
      type="text"
      size="small"
      :placeholder="placeholder"
      prefix-icon="search"
      :clearable="true"
      @update:model-value="handleInput"
      @keydown="handleKeydown"
      @clear="handleClear"
    />
    <Button
      variant="primary"
      size="small"
      :disabled="isSearching || !modelValue?.trim()"
      :loading="isSearching"
      @click="handleSearch"
    >
      {{ searchButtonText }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
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
  /** 是否启用自动搜索 */
  autoSearch?: boolean
  /** 输入框占位符 */
  placeholder?: string
}

interface Emits {
  (e: "update:modelValue", value: string): void
  (e: "search"): void
  (e: "clear"): void
  (e: "escape"): void
}

const props = withDefaults(defineProps<Props>(), {
  autoSearch: true,
  placeholder: "输入关键词搜索本地文件...",
})

const emit = defineEmits<Emits>()

const inputRef = ref<InstanceType<typeof Input> | null>(null)

/** 搜索按钮文本 */
const searchButtonText = computed(() =>
  props.autoSearch ? "搜索" : "搜索",
)

/** 处理输入 */
const handleInput = (value: string | number | null) => {
  emit("update:modelValue", String(value || ""))
}

/** 处理键盘事件 */
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter" && !props.autoSearch) {
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
@use "@/variables" as *;

.vp-search {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);

  .si-input {
    flex: 1;
  }
}
</style>
