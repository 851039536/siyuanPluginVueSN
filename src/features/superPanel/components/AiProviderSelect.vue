<template>
  <!-- 提供商下拉：共享 Select（纯受控 ⇒ handler 内回写 modelValue） -->
  <Select
    class="setting-select"
    :model-value="modelValue"
    :options="options"
    :aria-label="getProviderDisplayName(modelValue, i18n)"
    @update:model-value="handleChange"
  />
</template>

<script setup lang="ts">
import { computed } from "vue"
import Select from "@/components/Select.vue"
import { PROVIDERS, getProviderDisplayName } from "./providers"

interface Props {
  modelValue: string
  i18n: Record<string, any>
}

interface Emits {
  (e: "update:modelValue", value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 提供商选项（标签走 i18n，缺失回退 fallbackName） */
const options = computed(() =>
  PROVIDERS.map((p) => ({ value: p.id, label: props.i18n[p.i18nKey] || p.fallbackName })),
)

const handleChange = (value: string | number | boolean | null) => {
  emit("update:modelValue", value === null ? "" : String(value))
}
</script>
