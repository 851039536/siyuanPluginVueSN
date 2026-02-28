<template>
  <div class="copy-dropdown">
    <Button class="dropdown-toggle" variant="ghost" size="small" icon="contentCopy" :icon-size="14" @click="toggle">
      {{ buttonText }}
      <span class="dropdown-arrow">▼</span>
    </Button>
    <div v-if="isOpen" class="dropdown-menu">
      <button v-for="option in options" :key="option.value" class="dropdown-item" @click="select(option.value)">
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/Button.vue'

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

const toggle = () => {
  isOpen.value = !isOpen.value
}

const select = (value: string) => {
  emit('select', value)
  isOpen.value = false
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
