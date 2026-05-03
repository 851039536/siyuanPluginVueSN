<template>
  <div class="setting-input-wrapper">
    <TextInput
      :model-value="modelValue"
      :type="visible ? 'text' : 'password'"
      :placeholder="getPlaceholder()"
      @update:model-value="handleInput"
    />
    <Button
      variant="ghost"
      size="small"
      :icon="visible ? 'eyeOff' : 'eye'"
      :icon-size="14"
      :title="visible ? '隐藏密钥' : '显示密钥'"
      @click="toggleVisibility"
    />
  </div>
  <div class="setting-desc">{{ getDescription() }}</div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "@/components/Button.vue";
import TextInput from "./TextInput.vue";

interface Props {
  provider: string;
  modelValue: string;
  i18n: {
    tongyiQianwen?: string;
    openAI?: string;
    deepSeek?: string;
    customApi?: string;
    tongyiQianwenPlaceholder?: string;
    openAIPlaceholder?: string;
    deepSeekPlaceholder?: string;
    customApiPlaceholder?: string;
    [key: string]: any;
  };
}

interface Emits {
  (e: "update:modelValue", value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const visible = ref(false);

const toggleVisibility = () => {
  visible.value = !visible.value;
};

const getPlaceholder = () => {
  const i18nPlaceholders: Record<string, string | undefined> = {
    tongyi: props.i18n.tongyiQianwenPlaceholder,
    openai: props.i18n.openAIPlaceholder,
    deepseek: props.i18n.deepSeekPlaceholder,
    custom: props.i18n.customApiPlaceholder,
  };

  return (
    i18nPlaceholders[props.provider] ||
    `请输入${props.provider === "tongyi" ? "通义千问" : props.provider === "openai" ? "OpenAI" : props.provider === "deepseek" ? "DeepSeek" : "自定义API"}API密钥`
  );
};

const getDescription = () => {
  const providerNames: Record<string, string> = {
    tongyi: props.i18n.tongyiQianwen || "通义千问",
    openai: props.i18n.openAI || "OpenAI",
    deepseek: props.i18n.deepSeek || "DeepSeek",
    custom: props.i18n.customApi || "自定义API",
  };

  return `${providerNames[props.provider]} API密钥，用于所有AI功能`;
};

const handleInput = (value: string) => {
  emit("update:modelValue", value);
};
</script>


