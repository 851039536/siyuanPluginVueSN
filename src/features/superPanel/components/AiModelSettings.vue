<!-- AI 设置 - 「模型」Tab：供应商 / 模型 / 思考模式 / API 密钥 / 自定义端点 -->
<template>
  <div class="ai-model-settings">
    <!-- API供应商选择 -->
    <SettingGroup>
      <template #label>
        <!-- 分组标签："API供应商" -->
        {{ i18n.apiProvider }}
      </template>
      <AiProviderSelect
        :model-value="settings.provider"
        :i18n="i18n"
        @update:model-value="$emit('provider-change', $event)"
      />
    </SettingGroup>

    <!-- 模型选择 -->
    <SettingGroup v-if="settings.provider !== 'custom'">
      <template #label>
        <!-- 分组标签："模型" -->
        {{ i18n.aiModel }}
      </template>
      <AiModelSelect
        :provider="settings.provider"
        :model-value="settings.model"
        :custom-model="settings.customModel"
        :i18n="i18n"
        @update:model-value="emitUpdate('model', $event)"
        @update:custom-model="emitUpdate('customModel', $event)"
      />
    </SettingGroup>

    <!-- 自定义模型名（自定义API供应商时直接输入） -->
    <SettingGroup v-else>
      <template #label>
        <!-- 分组标签："模型" -->
        {{ i18n.aiModel }}
      </template>
      <TextInput
        :model-value="settings.customModel"
        :placeholder="i18n.customModelPlaceholder"
        @update:model-value="emitUpdate('customModel', $event)"
      />
      <div class="setting-desc">
        <!-- 说明文字：模型名称须与 API 服务实际提供的名称一致 -->
        {{ i18n.customModelDesc }}
      </div>
    </SettingGroup>

    <!-- 思考模式开关（仅DeepSeek显示） -->
    <SettingGroup v-if="settings.provider === 'deepseek'">
      <div class="thinking-toggle-row">
        <!-- 开关标签："思考模式" -->
        <label class="thinking-toggle-label">{{ i18n.thinkingMode }}</label>
        <button
          class="toggle-btn"
          :class="{ active: settings.enableThinking }"
          @click="emitUpdate('enableThinking', !settings.enableThinking)"
        >
          <!-- 开关状态文案："已开启" / "已关闭" -->
          {{ settings.enableThinking ? i18n.thinkingOn : i18n.thinkingOff }}
        </button>
      </div>
      <div class="setting-desc">
        <!-- 说明文字：开启后模型会先进行深度思考再回答 -->
        {{ i18n.thinkingDesc }}
      </div>
    </SettingGroup>

    <!-- API密钥输入 -->
    <SettingGroup>
      <template #label>
        <!-- 分组标签："API密钥" -->
        {{ i18n.apiKey }}
      </template>
      <ApiKeyInput
        :provider="settings.provider"
        :model-value="settings.apiKey"
        :i18n="i18n"
        @update:model-value="emitUpdate('apiKey', $event)"
      />
    </SettingGroup>

    <!-- 自定义API端点 -->
    <SettingGroup v-if="settings.provider === 'custom'">
      <template #label>
        <!-- 分组标签："API端点" -->
        {{ i18n.customEndpoint }}
      </template>
      <TextInput
        :model-value="settings.customEndpoint"
        placeholder="https://api.example.com/v1"
        @update:model-value="emitUpdate('customEndpoint', $event)"
      />
      <div class="setting-desc">
        <!-- 说明文字：支持 OpenAI 兼容基地址（自动补全 /chat/completions）或完整端点 URL -->
        {{ i18n.customEndpointDesc }}
      </div>
    </SettingGroup>
  </div>
</template>

<script setup lang="ts">
import type { AiSettings } from "../types"
import AiModelSelect from "./AiModelSelect.vue"
import AiProviderSelect from "./AiProviderSelect.vue"
import ApiKeyInput from "./ApiKeyInput.vue"
import SettingGroup from "./SettingGroup.vue"
import TextInput from "./TextInput.vue"

interface Props {
  settings: AiSettings
  i18n: Record<string, any>
}

interface Emits {
  (e: "update", field: keyof AiSettings, value: string | boolean): void
  (e: "provider-change", provider: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const emitUpdate = (field: keyof AiSettings, value: string | boolean) => {
  emit("update", field, value)
}
</script>

<style lang="scss" scoped>
@use "../styles/AiModelSettings.scss";
</style>
