<template>
  <select
    :value="modelValue"
    class="setting-select"
    @change="handleChange"
  >
    <option
      v-for="p in PROVIDERS"
      :key="p.id"
      :value="p.id"
    >
      {{ i18n[p.i18nKey] || p.fallbackName }}
    </option>
  </select>
</template>

<script setup lang="ts">
import { PROVIDERS } from "./providers"

interface Props {
  modelValue: string
  i18n: Record<string, any>
}

interface Emits {
  (e: "update:modelValue", value: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit("update:modelValue", target.value)
}
</script>
