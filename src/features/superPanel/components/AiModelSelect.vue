<template>
  <div>
    <select
      v-if="!showCustomInput"
      :value="modelValue"
      class="setting-select"
      @change="handleModelChange"
    >
      <optgroup
        v-if="availableModels.common.length > 0"
        :label="i18n.commonModels || '常用模型'"
      >
        <option
          v-for="model in availableModels.common"
          :key="model.value"
          :value="model.value"
        >
          {{ model.label }}
        </option>
      </optgroup>
      <optgroup
        v-if="availableModels.all.length > 0"
        :label="i18n.allModels || '全部模型'"
      >
        <option
          v-for="model in availableModels.all"
          :key="model.value"
          :value="model.value"
        >
          {{ model.label }}
        </option>
      </optgroup>
      <option value="custom">{{ i18n.customModel || '自定义模型' }}</option>
    </select>

    <TextInput
      v-if="showCustomInput"
      :model-value="customModel"
      :placeholder="i18n.customModelPlaceholder || '输入模型名称，如: gpt-4'"
      @update:model-value="handleCustomModelChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TextInput from "./TextInput.vue";

interface ModelOption {
	value: string;
	label: string;
}

interface ProviderModels {
	common: ModelOption[];
	all: ModelOption[];
}

const AI_MODELS_CONFIG: Record<string, ProviderModels> = {
	tongyi: {
		common: [
			{ value: "qwen-plus", label: "Qwen Plus (推荐)" },
			{ value: "qwen-turbo", label: "Qwen Turbo (快速)" },
			{ value: "qwen-max", label: "Qwen Max (最强)" },
		],
		all: [
			{ value: "qwen-long", label: "Qwen Long (长文本)" },
			{ value: "qwen-vl-plus", label: "Qwen VL Plus (视觉)" },
			{ value: "qwen-vl-max", label: "Qwen VL Max (视觉最强)" },
		],
	},
	openai: {
		common: [
			{ value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (推荐)" },
			{ value: "gpt-4", label: "GPT-4" },
			{ value: "gpt-4-turbo", label: "GPT-4 Turbo" },
		],
		all: [
			{ value: "gpt-4o", label: "GPT-4o" },
			{ value: "gpt-4o-mini", label: "GPT-4o Mini" },
		],
	},
	deepseek: {
		common: [
			{ value: "deepseek-chat", label: "DeepSeek Chat (推荐)" },
			{ value: "deepseek-coder", label: "DeepSeek Coder (代码)" },
			{ value: "deepseek-reasoner", label: "DeepSeek Reasoner (思考)" },
		],
		all: [],
	},
	custom: {
		common: [],
		all: [],
	},
};

interface Props {
	provider: string;
	modelValue: string;
	customModel: string;
	i18n: {
		commonModels?: string;
		allModels?: string;
		customModel?: string;
		customModelPlaceholder?: string;
		[key: string]: any;
	};
}

interface Emits {
	(e: "update:modelValue", value: string): void;
	(e: "update:customModel", value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const showCustomInput = computed(() => props.modelValue === "custom");

// 使用 computed 缓存模型配置，避免每次渲染都创建新对象
const availableModels = computed(() => {
	return AI_MODELS_CONFIG[props.provider] || { common: [], all: [] };
});

const handleModelChange = (event: Event) => {
	const target = event.target as HTMLSelectElement;
	emit("update:modelValue", target.value);
};

const handleCustomModelChange = (value: string) => {
	emit("update:customModel", value);
};
</script>

<style scoped lang="scss">
@use '../styles/index.scss';
</style>
