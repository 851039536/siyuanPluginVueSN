<template>
  <div
    v-if="visible"
    class="ai-settings-panel"
  >
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
        <template #label>
          {{ i18n.apiProvider || 'API供应商' }}
        </template>
        <AiProviderSelect
          :model-value="settings.provider"
          :i18n="i18n"
          @update:model-value="handleProviderChange"
        />
      </SettingGroup>

      <!-- 模型选择 -->
      <SettingGroup v-if="settings.provider !== 'custom'">
        <template #label>
          {{ i18n.aiModel || '模型' }}
        </template>
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
        <div class="setting-desc">
          {{ i18n.thinkingDesc || '开启后模型会先进行深度思考再回答，适合复杂推理任务' }}
        </div>
      </SettingGroup>

      <!-- API密钥输入 -->
      <SettingGroup>
        <template #label>
          {{ i18n.apiKey || 'API密钥' }}
        </template>
        <ApiKeyInput
          :provider="settings.provider"
          :model-value="settings.apiKey"
          :i18n="i18n"
          @update:model-value="(v: string) => updateSetting('apiKey', v)"
        />
      </SettingGroup>

      <!-- 自定义API端点 -->
      <SettingGroup v-if="settings.provider === 'custom'">
        <template #label>
          {{ i18n.customEndpoint || 'API端点' }}
        </template>
        <TextInput
          :model-value="settings.customEndpoint"
          placeholder="https://api.example.com/v1/chat/completions"
          @update:model-value="(v: string) => updateSetting('customEndpoint', v)"
        />
        <div class="setting-desc">
          自定义API端点URL，用于连接自定义API服务
        </div>
      </SettingGroup>

      <!-- ====== 联网搜索配置 ====== -->
      <div class="search-section-divider">
        <span class="divider-text">联网搜索（RAG 模式）</span>
      </div>

      <!-- 搜索引擎选择 -->
      <SettingGroup>
        <template #label>
          搜索引擎
        </template>
        <div class="search-provider-options">
          <button
            v-for="opt in searchProviderOptions"
            :key="opt.value"
            class="search-provider-btn"
            :class="{ active: settings.searchProvider === opt.value }"
            @click="updateSetting('searchProvider', opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </SettingGroup>

      <!-- 博查 API Key（仅博查搜索时显示） -->
      <SettingGroup v-if="settings.searchProvider === 'bocha'">
        <template #label>
          博查 API Key
        </template>
        <TextInput
          :model-value="settings.searchBochaApiKey"
          type="password"
          placeholder="在 open.bochaai.com 注册获取"
          @update:model-value="(v: string) => updateSetting('searchBochaApiKey', v)"
        />
        <div class="setting-desc">
          注册 <a
            href="https://open.bochaai.com"
            target="_blank"
            class="setting-link"
          >博查AI</a> 获取 API Key，免费额度 1000 次/月
        </div>
      </SettingGroup>

      <!-- SearXNG 实例地址（仅 SearXNG 时显示） -->
      <SettingGroup v-if="settings.searchProvider === 'searxng'">
        <template #label>
          SearXNG 实例地址
        </template>
        <TextInput
          :model-value="settings.searchSearxngUrl"
          placeholder="http://localhost:8080"
          @update:model-value="(v: string) => updateSetting('searchSearxngUrl', v)"
        />
        <div class="setting-desc">
          自建或公共 SearXNG 实例地址，需启用 JSON 格式输出
        </div>
      </SettingGroup>

      <!-- Jina 搜索提示 -->
      <SettingGroup v-if="settings.searchProvider === 'jina'">
        <div class="setting-desc jina-hint">
          Jina Search 免费无需 API Key，国内可访问，开箱即用。适合轻度使用，重度推荐博查搜索。
        </div>
      </SettingGroup>

      <!-- 测试搜索 -->
      <SettingGroup>
        <button
          class="test-search-btn"
          :disabled="isTestingSearch"
          @click="testSearch"
        >
          {{ isTestingSearch ? '搜索中...' : '测试联网搜索' }}
        </button>
        <div
          v-if="searchTestResult"
          class="setting-desc search-test-result"
          :class="{ error: searchTestError }"
        >
          {{ searchTestResult }}
        </div>
      </SettingGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiSettings } from "../types"
import type { SearchProvider } from "@/types/ai"
import { showMessage } from "siyuan"
import {
  reactive,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import { searchWeb } from "@/utils/webSearch"
import AiModelSelect from "./AiModelSelect.vue"
import AiProviderSelect from "./AiProviderSelect.vue"
import ApiKeyInput from "./ApiKeyInput.vue"
import { getDefaultModel } from "./providers"
import SettingGroup from "./SettingGroup.vue"
import TextInput from "./TextInput.vue"

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
    zhipuAI?: string
    xiaomiMiMo?: string
    customApi?: string
    [key: string]: any
  }
}

interface Emits {
  (e: "close"): void
  (e: "update:settings", settings: AiSettings): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 本地响应式副本，确保切换供应商时 UI 立即更新
const settings = reactive<AiSettings>({ ...props.settings })

const searchProviderOptions: { value: SearchProvider, label: string }[] = [
  {
    value: "jina",
    label: "Jina（免费）",
  },
  {
    value: "bocha",
    label: "博查搜索",
  },
  {
    value: "searxng",
    label: "SearXNG（自建）",
  },
]

const isTestingSearch = ref(false)
const searchTestResult = ref("")
const searchTestError = ref(false)

const handleClose = () => {
  emit("close")
}

const updateSetting = (field: keyof AiSettings, value: string | boolean) => {
  (settings as any)[field] = value
  emit("update:settings", { ...settings })
}

const handleProviderChange = (provider: string) => {
  settings.provider = provider
  settings.model = getDefaultModel(provider)
  settings.apiKey = settings.apiKeys[provider] || ""
  emit("update:settings", { ...settings })
  showMessage("供应商已更新", 2000, "info")
}

const testSearch = async () => {
  isTestingSearch.value = true
  searchTestResult.value = ""
  searchTestError.value = false

  try {
    const results = await searchWeb("今天是几号 最新新闻", {
      searchProvider: settings.searchProvider as SearchProvider,
      bochaApiKey: settings.searchBochaApiKey || "",
      searxngUrl: settings.searchSearxngUrl || "",
    })

    if (results.length > 0) {
      searchTestResult.value = `搜索成功！获取到 ${results.length} 条结果，首条：${results[0].title} - ${results[0].content.slice(0, 80)}...`
      showMessage("联网搜索测试成功", 2000, "info")
    } else {
      searchTestError.value = true
      searchTestResult.value = "搜索未返回结果，请检查配置"
    }
  } catch (error) {
    searchTestError.value = true
    searchTestResult.value = `搜索失败: ${(error as Error).message}`
  } finally {
    isTestingSearch.value = false
  }
}
</script>

<style lang="scss" scoped>
@use "../styles/AiSettingsPanel.scss";
</style>
