<template>
  <select
    :value="modelValue"
    class="setting-select"
    @change="handleChange"
  >
    <option value="tongyi">
      {{ i18n.tongyiQianwen || '通义千问' }}
    </option>
    <option value="openai">
      {{ i18n.openAI || 'OpenAI' }}
    </option>
    <option value="deepseek">
      {{ i18n.deepSeek || 'DeepSeek' }}
    </option>
    <option value="zhipu">
      {{ i18n.zhipuAI || '智谱AI' }}
    </option>
    <option value="xiaomi">
      {{ i18n.xiaomiMiMo || '小米MiMo' }}
    </option>
    <option value="custom">
      {{ i18n.customApi || '自定义API' }}
    </option>
  </select>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string
  i18n: {
    tongyiQianwen?: string
    openAI?: string
    deepSeek?: string
    zhipuAI?: string
    xiaomiMiMo?: string
    customApi?: string
    [key: string]: any
  }
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


