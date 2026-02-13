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
@use '../styles/index.scss';
</style>
