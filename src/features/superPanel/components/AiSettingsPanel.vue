<template>
  <div class="ai-settings-panel" v-if="visible">
    <div class="ai-settings-header">
      <span>{{ i18n.aiSettings || 'AI大模型配置' }}</span>
      <Button
        variant="ghost"
        size="small"
        icon="close"
        :icon-size="14"
        @click="handleClose"
      />
    </div>
    <div class="ai-settings-content">
      <!-- API供应商选择 -->
      <SettingGroup>
        <template #label>{{ i18n.apiProvider || 'API供应商' }}</template>
        <AiProviderSelect
          :model-value="settings.provider"
          :i18n="i18n"
          @update:model-value="handleProviderChange"
        />
      </SettingGroup>

      <!-- 模型选择 -->
      <SettingGroup v-if="settings.provider !== 'custom'">
        <template #label>{{ i18n.aiModel || '模型' }}</template>
        <AiModelSelect
          :provider="settings.provider"
          :model-value="settings.model"
          :custom-model="settings.customModel"
          :i18n="i18n"
          @update:model-value="(v: string) => updateSetting('model', v)"
          @update:custom-model="(v: string) => updateSetting('customModel', v)"
        />
      </SettingGroup>

      <!-- 思考模式开关（仅DeepSeek显示） -->
      <SettingGroup v-if="settings.provider === 'deepseek'">
        <div class="thinking-toggle-row">
          <label class="thinking-toggle-label">{{ i18n.thinkingMode || '思考模式' }}</label>
          <button
            class="thinking-toggle-btn"
            :class="{ active: settings.enableThinking }"
            @click="updateSetting('enableThinking', !settings.enableThinking)"
          >
            {{ settings.enableThinking ? (i18n.thinkingOn || '已开启') : (i18n.thinkingOff || '已关闭') }}
          </button>
        </div>
        <div class="setting-desc">{{ i18n.thinkingDesc || '开启后模型会先进行深度思考再回答，适合复杂推理任务' }}</div>
      </SettingGroup>

      <!-- API密钥输入 -->
      <SettingGroup>
        <template #label>{{ i18n.apiKey || 'API密钥' }}</template>
        <ApiKeyInput
          :provider="settings.provider"
          :model-value="settings.apiKey"
          :i18n="i18n"
          @update:model-value="(v: string) => updateSetting('apiKey', v)"
        />
      </SettingGroup>

      <!-- 自定义API端点 -->
      <SettingGroup v-if="settings.provider === 'custom'">
        <template #label>{{ i18n.customEndpoint || 'API端点' }}</template>
        <TextInput
          :model-value="settings.customEndpoint"
          placeholder="https://api.example.com/v1/chat/completions"
          @update:model-value="(v: string) => updateSetting('customEndpoint', v)"
        />
        <div class="setting-desc">自定义API端点URL，用于连接自定义API服务</div>
      </SettingGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from "siyuan";
import Button from "@/components/Button.vue";
import AiProviderSelect from "./AiProviderSelect.vue";
import AiModelSelect from "./AiModelSelect.vue";
import ApiKeyInput from "./ApiKeyInput.vue";
import SettingGroup from "./SettingGroup.vue";
import TextInput from "./TextInput.vue";
import type { AiSettings } from "../types";

interface Props {
	visible: boolean;
	settings: AiSettings;
	i18n: {
		aiSettings?: string;
		apiProvider?: string;
		aiModel?: string;
		apiKey?: string;
		customEndpoint?: string;
		tongyiQianwen?: string;
		openAI?: string;
		deepSeek?: string;
		customApi?: string;
		[key: string]: any;
	};
}

interface Emits {
	(e: "close"): void;
	(e: "update:settings", settings: AiSettings): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const handleClose = () => {
	emit("close");
};

const updateSetting = (field: keyof AiSettings, value: string | boolean) => {
	emit("update:settings", { ...props.settings, [field]: value });
};

const handleProviderChange = async (provider: string) => {
	const defaultModels: Record<string, string> = {
		tongyi: "qwen-plus",
		openai: "gpt-3.5-turbo",
		deepseek: "deepseek-v4-flash",
		custom: "",
	};
	updateSetting("provider", provider);
	updateSetting("model", defaultModels[provider] || "");
	showMessage("供应商已更新", 2000, "info");
};
</script>

<style scoped lang="scss">
@use '../styles/index.scss';

.thinking-toggle-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
}

.thinking-toggle-label {
	font-size: 12px;
	color: var(--b3-theme-on-surface);
	white-space: nowrap;
}

.thinking-toggle-btn {
	font-size: 11px;
	padding: 2px 10px;
	border-radius: 4px;
	border: 1px solid var(--b3-border-color);
	background: var(--b3-theme-surface);
	color: var(--b3-theme-on-surface);
	cursor: pointer;
	transition: all 0.2s ease;

	&.active {
		background: var(--b3-theme-primary);
		color: #fff;
		border-color: var(--b3-theme-primary);
	}
}
</style>
