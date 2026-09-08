<template>
  <div
    v-if="visible"
    class="ai-settings-panel"
  >
    <div class="ai-settings-header">
      <!-- 面板标题："AI大模型配置" -->
      <span>{{ i18n.aiSettings }}</span>
      <Button
        variant="ghost"
        size="xsmall"
        icon="close"
        :icon-size="14"
        @click="handleClose"
      />
    </div>
    <div class="ai-settings-content">
      <!-- API供应商选择 -->
      <SettingGroup>
        <template #label>
          <!-- 分组标签："API供应商" -->
          {{ i18n.apiProvider }}
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
          <!-- 分组标签："模型" -->
          {{ i18n.aiModel }}
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

      <!-- 自定义模型名（自定义API供应商时直接输入） -->
      <SettingGroup v-if="settings.provider === 'custom'">
        <template #label>
          <!-- 分组标签："模型" -->
          {{ i18n.aiModel }}
        </template>
        <TextInput
          :model-value="settings.customModel"
          :placeholder="i18n.customModelPlaceholder"
          @update:model-value="(v: string) => updateSetting('customModel', v)"
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
            @click="updateSetting('enableThinking', !settings.enableThinking)"
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
          @update:model-value="(v: string) => updateSetting('apiKey', v)"
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
          @update:model-value="(v: string) => updateSetting('customEndpoint', v)"
        />
        <div class="setting-desc">
          <!-- 说明文字：支持 OpenAI 兼容基地址（自动补全 /chat/completions）或完整端点 URL -->
          {{ i18n.customEndpointDesc }}
        </div>
      </SettingGroup>

      <!-- ====== 联网搜索配置 ====== -->
      <div class="search-section-divider">
        <!-- 分隔线标题："联网搜索（RAG 模式）" -->
        <span class="divider-text">{{ i18n.searchSectionTitle }}</span>
      </div>

      <!-- 搜索引擎选择 -->
      <SettingGroup>
        <template #label>
          <!-- 分组标签："搜索引擎" -->
          {{ i18n.searchEngine }}
        </template>
        <div class="search-provider-options">
          <button
            v-for="opt in searchProviderOptions"
            :key="opt.value"
            class="toggle-btn"
            :class="{ active: settings.searchProvider === opt.value }"
            @click="updateSetting('searchProvider', opt.value)"
          >
            <!-- 选项文案：如"Jina（免费）"、"博查搜索" -->
            {{ i18n[opt.labelKey] }}
          </button>
        </div>
      </SettingGroup>

      <!-- 博查 API Key（仅博查搜索时显示） -->
      <SettingGroup v-if="settings.searchProvider === 'bocha'">
        <template #label>
          <!-- 分组标签："博查 API Key" -->
          {{ i18n.searchBochaApiKeyLabel }}
        </template>
        <TextInput
          :model-value="settings.searchBochaApiKey"
          type="password"
          :placeholder="i18n.searchBochaApiKeyPlaceholder"
          @update:model-value="(v: string) => updateSetting('searchBochaApiKey', v)"
        />
        <div class="setting-desc">
          <!-- 说明文字："注册 博查AI 获取 API Key，免费额度 1000 次/月"（链接拆三段渲染） -->
          {{ i18n.bochaDescStart }}
          <a
            href="https://open.bochaai.com"
            target="_blank"
            class="setting-link"
          >{{ i18n.bochaBrand }}</a>
          {{ i18n.bochaDescEnd }}
        </div>
      </SettingGroup>

      <!-- Jina 搜索提示 -->
      <SettingGroup v-if="settings.searchProvider === 'jina'">
        <div class="setting-desc jina-hint">
          <!-- 提示文案：Jina Search 免费无需 API Key，国内可访问，开箱即用 -->
          {{ i18n.searchJinaHint }}
        </div>
      </SettingGroup>

      <!-- 测试搜索 -->
      <SettingGroup>
        <button
          class="test-search-btn"
          :disabled="isTestingSearch"
          @click="testSearch"
        >
          <!-- 按钮文案："测试联网搜索" / "搜索中..." -->
          {{ isTestingSearch ? i18n.searching : i18n.testSearchButton }}
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
    deepSeek?: string
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

// labelKey 为 i18n 键名，模板以 i18n[opt.labelKey] 渲染（键值见 superPanel.json）
const searchProviderOptions: { value: SearchProvider, labelKey: string }[] = [
  {
    value: "jina",
    labelKey: "searchProviderJina",
  },
  {
    value: "bocha",
    labelKey: "searchProviderBocha",
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
    })

    if (results.length > 0) {
      searchTestResult.value = `搜索成功！获取到 ${results.length} 条结果，首条：${results[0].title} - ${results[0].content.slice(0, 80)}...`
      showMessage("联网搜索测试成功", 2000, "info")
    } else {
      searchTestError.value = true
      searchTestResult.value = props.i18n.searchNoResults
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
