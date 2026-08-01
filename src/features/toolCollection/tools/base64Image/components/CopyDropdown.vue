<template>
  <div
    ref="rootRef"
    class="copy-dropdown"
  >
    <Button
      class="dropdown-toggle"
      variant="ghost"
      size="xsmall"
      icon="contentCopy"
      :icon-size="14"
      @click="toggle"
    >
      {{ buttonText }}
      <span class="dropdown-arrow">▼</span>
    </Button>
    <div
      v-if="isOpen"
      class="dropdown-menu"
    >
      <button
        v-for="option in options"
        :key="option.value"
        class="dropdown-item"
        @click="select(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// 复制下拉菜单：提供多种格式的复制选项，点击外部自动关闭
import { onMounted, onUnmounted, ref } from "vue"
import Button from "@/components/Button.vue"

interface CopyOption {
  value: string
  label: string
}

interface Props {
  buttonText: string
  options: CopyOption[]
}

defineProps<Props>()
const emit = defineEmits<{
  select: [value: string]
}>()

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const toggle = () => {
  isOpen.value = !isOpen.value
}

const select = (value: string) => {
  emit("select", value)
  isOpen.value = false
}

// 点击菜单外部时关闭
const handleClickOutside = (e: MouseEvent) => {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener("click", handleClickOutside))
onUnmounted(() => document.removeEventListener("click", handleClickOutside))
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
