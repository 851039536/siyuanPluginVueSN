<template>
  <div>
    <select
      v-if="!showCustomInput"
      :value="modelValue"
      class="setting-select"
      @change="handleModelChange"
    >
      <!-- 分组标签："常用模型" -->
      <optgroup
        v-if="availableModels.common.length > 0"
        :label="i18n.commonModels"
      >
        <option
          v-for="model in availableModels.common"
          :key="model.value"
          :value="model.value"
        >
          {{ model.label }}
        </option>
      </optgroup>
      <!-- 分组标签："全部模型" -->
      <optgroup
        v-if="availableModels.all.length > 0"
        :label="i18n.allModels"
      >
        <option
          v-for="model in availableModels.all"
          :key="model.value"
          :value="model.value"
        >
          {{ model.label }}
        </option>
      </optgroup>
      <!-- 选项文案："自定义模型" -->
      <option value="custom">
        {{ i18n.customModel }}
      </option>
    </select>

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

const handleModelChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit("update:modelValue", target.value)
}

const handleCustomModelChange = (value: string) => {
  emit("update:customModel", value)
}
</script>

