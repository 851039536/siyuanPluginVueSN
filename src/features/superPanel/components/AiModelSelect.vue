<template>
  <div>
    <!-- 模型下拉：共享 Select（分组走 isGroup 形式；纯受控 ⇒ handler 内回写） -->
    <Select
      v-if="!showCustomInput"
      class="setting-select"
      :model-value="modelValue"
      :options="modelOptions"
      :aria-label="i18n.commonModels"
      @update:model-value="handleModelChange"
    />

    <!-- 占位提示："输入模型名称，如: gpt-4" -->
    <TextInput
      v-if="showCustomInput"
      :model-value="customModel"
      :placeholder="i18n.customModelPlaceholder"
      @update:model-value="handleCustomModelChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Select from "@/components/Select.vue"
import { PROVIDER_MAP } from "./providers"
import TextInput from "./TextInput.vue"

interface Props {
  provider: string
  modelValue: string
  customModel: string
  i18n: {
    commonModels?: string
    allModels?: string
    customModel?: string
    customModelPlaceholder?: string
    [key: string]: any
  }
}

interface Emits {
  (e: "update:modelValue", value: string): void
  (e: "update:customModel", value: string): void
}

const props = defineProps<Props>()

const emit = defineEmits<Emits>()

const EMPTY_MODELS = {
  common: [] as never[],
  all: [] as never[],
}

const showCustomInput = computed(() => props.modelValue === "custom")

const availableModels = computed(() => {
  return PROVIDER_MAP[props.provider]?.models ?? EMPTY_MODELS
})

/** 模型选项：两个分组（常用/全部）+ 末尾"自定义模型"（与原生 optgroup 结构等价） */
const modelOptions = computed(() => {
  const list: Array<
    | { isGroup: true, label: string, options: { value: string, label: string }[] }
    | { value: string, label: string }
  > = []
  if (availableModels.value.common.length > 0) {
    list.push({
      isGroup: true,
      label: props.i18n.commonModels ?? "",
      options: availableModels.value.common.map((m) => ({ value: m.value, label: m.label })),
    })
  }
  if (availableModels.value.all.length > 0) {
    list.push({
      isGroup: true,
      label: props.i18n.allModels ?? "",
      options: availableModels.value.all.map((m) => ({ value: m.value, label: m.label })),
    })
  }
  list.push({ value: "custom", label: props.i18n.customModel ?? "" })
  return list
})

const handleModelChange = (value: string | number | boolean | null) => {
  emit("update:modelValue", value === null ? "" : String(value))
}

const handleCustomModelChange = (value: string) => {
  emit("update:customModel", value)
}
</script>

