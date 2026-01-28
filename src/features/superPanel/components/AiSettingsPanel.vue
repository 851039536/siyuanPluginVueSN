<template>
  <div class="ai-settings-panel" v-if="visible">
    <div class="ai-settings-header">
      <span>{{ i18n.aiSettings || 'AI大模型配置' }}</span>
      <button class="ai-settings-close-btn" @click="handleClose">
        <IconWrapper name="close" :size="14" />
      </button>
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
          @update:model-value="handleModelChange"
          @update:custom-model="handleCustomModelChange"
        />
      </SettingGroup>

      <!-- API密钥输入 -->
      <SettingGroup>
        <template #label>{{ i18n.apiKey || 'API密钥' }}</template>
        <ApiKeyInput
          :provider="settings.provider"
          :model-value="settings.apiKey"
          :i18n="i18n"
          @update:model-value="handleApiKeyChange"
        />
      </SettingGroup>

      <!-- 自定义API端点 -->
      <SettingGroup v-if="settings.provider === 'custom'">
        <template #label>{{ i18n.customEndpoint || 'API端点' }}</template>
        <TextInput
          :model-value="settings.customEndpoint"
          placeholder="https://api.example.com/v1/chat/completions"
          @update:model-value="handleEndpointChange"
        />
        <div class="setting-desc">自定义API端点URL，用于连接自定义API服务</div>
      </SettingGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from 'siyuan'
import IconWrapper from '@/components/IconWrapper.vue'
import AiProviderSelect from './AiProviderSelect.vue'
import AiModelSelect from './AiModelSelect.vue'
import ApiKeyInput from './ApiKeyInput.vue'
import SettingGroup from './SettingGroup.vue'
import TextInput from './TextInput.vue'

export interface AiSettings {
  provider: string
  model: string
  customModel: string
  apiKey: string
  customEndpoint: string
}

interface Props {
  visible: boolean
  settings: AiSettings
  i18n: {
    aiSettings?: string
    apiProvider?: string
    aiModel?: string
    apiKey?: string
    customEndpoint?: string
    tongyiQianwen?: string
    openAI?: string
    deepSeek?: string
    customApi?: string
    [key: string]: any
  }
}

interface Emits {
  (e: 'close'): void
  (e: 'update:settings', settings: AiSettings): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleClose = () => {
  emit('close')
}

const handleProviderChange = async (provider: string) => {
  const defaultModels: Record<string, string> = {
    tongyi: 'qwen-plus',
    openai: 'gpt-3.5-turbo',
    deepseek: 'deepseek-chat',
    custom: ''
  }

  emit('update:settings', {
    ...props.settings,
    provider,
    model: defaultModels[provider] || ''
  })
  showMessage('供应商已更新', 2000, 'info')
}

const handleModelChange = (model: string) => {
  emit('update:settings', {
    ...props.settings,
    model
  })
}

const handleCustomModelChange = (customModel: string) => {
  emit('update:settings', {
    ...props.settings,
    customModel
  })
}

const handleApiKeyChange = (apiKey: string) => {
  emit('update:settings', {
    ...props.settings,
    apiKey
  })
}

const handleEndpointChange = (customEndpoint: string) => {
  emit('update:settings', {
    ...props.settings,
    customEndpoint
  })
}
</script>

<style scoped lang="scss">
.ai-settings-panel {
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface-lighter);
  animation: slideDown 0.3s ease-out;
  flex-shrink: 0;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}

.ai-settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.ai-settings-close-btn {
  border: none;
  background: var(--b3-theme-surface-lighter);
  padding: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface);
  transition: all 0.2s ease;
  cursor: pointer;
  outline: none;

  &:hover {
    background: var(--b3-theme-surface-light);
    color: var(--b3-theme-on-surface);
  }
}

.ai-settings-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-desc {
  margin-top: 4px;
}
</style>
