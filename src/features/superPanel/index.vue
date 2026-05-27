<template>
  <!-- 遮罩层 -->
  <div
    v-if="visible"
    class="super-panel-overlay"
    @click="emit('close')"
  />

  <!-- 面板容器 -->
  <div
    v-if="visible"
    class="super-panel-container"
  >
    <!-- 头部 -->
    <SuperPanelHeader
      :title="i18n.title || '超级面板'"
      :i18n="i18n"
      @toggle-ai-settings="toggleAiSettings"
      @refresh="emit('refresh')"
      @close="emit('close')"
    />

    <!-- AI配置区域 -->
    <AiSettingsPanel
      :visible="showAiSettings"
      :settings="aiSettings"
      :i18n="i18n"
      @close="toggleAiSettings"
      @update:settings="emit('updateAiSettings', $event)"
    />

    <!-- 搜索栏 -->
    <div class="super-panel-search">
      <div class="search-input-wrapper">
        <IconWrapper
          name="search"
          :size="15"
          class="search-icon"
        />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          class="search-input"
          type="text"
          :placeholder="i18n.searchPlaceholder || '搜索功能...'"
        >
        <button
          v-if="searchQuery"
          class="search-clear"
          @click="clearSearch"
        >
          <IconWrapper
            name="close"
            :size="13"
          />
        </button>
      </div>
      <span
        v-if="searchQuery"
        class="search-count"
      >{{ filteredFeatures.length }}/{{ features.length }}</span>
    </div>

    <!-- 内容区 -->
    <div class="super-panel-content">
      <div
        v-if="searchQuery && filteredFeatures.length === 0"
        class="search-empty"
      >
        <IconWrapper
          name="search"
          :size="32"
          class="search-empty-icon"
        />
        <span class="search-empty-text">{{ i18n.noResults || '未找到匹配的功能' }}</span>
      </div>
      <TransitionGroup
        name="feature-list"
        tag="div"
        class="feature-list-inner"
      >
        <FeatureCard
          v-for="feature in filteredFeatures"
          :key="feature.id"
          :feature="feature"
          :enabled="getFeatureEnabled(feature.id)"
          :show-toggle="canToggle(feature.id)"
          :selector-options="getSelectorOptions(feature.id)"
          :selected-option="getSelectedOption(feature.id)"
          @action="emit('action', $event)"
          @toggle="handleToggle(feature.id, $event)"
          @select="handleSelect(feature.id, $event)"
        />
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SelectorOption } from "./components/FeatureCard.vue"
import type {
  AiSettings,
  Feature,
} from "./types"
import type { IconKey } from "@/config/icons"
import type { PluginSettings } from "@/config/settings"
import type { FeatureMeta } from "@/features/config"
import {
  computed,
  nextTick,
  onMounted,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { featureIdToSettingKey } from "@/config/settings"
import { FEATURE_CONFIG } from "@/features/config"
import { THEMES } from "@/features/themeColor"
import AiSettingsPanel from "./components/AiSettingsPanel.vue"
import FeatureCard from "./components/FeatureCard.vue"
import SuperPanelHeader from "./components/SuperPanelHeader.vue"

interface Props {
  visible: boolean
  settings: PluginSettings
  i18n: Record<string, any>
}

interface Emits {
  (e: "close"): void
  (e: "action", action: string): void
  (e: "refresh"): void
  (e: "updateAiSettings", settings: AiSettings): void
  (e: "toggleFeature", featureId: string, enabled: boolean): void
  (e: "selectFeature", featureId: string, value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 搜索状态
const searchQuery = ref("")
const searchInputRef = ref<HTMLInputElement | null>(null)

// AI配置状态
const showAiSettings = ref(false)

// AI设置数据
const aiSettings = computed<AiSettings>(() => ({
  provider: props.settings.aiApiProvider || "tongyi",
  model: props.settings.aiModel || "qwen-plus",
  customModel: props.settings.aiCustomModel || "",
  apiKey: props.settings.aiApiKeys?.[props.settings.aiApiProvider || "tongyi"] || "",
  apiKeys: props.settings.aiApiKeys || {},
  customEndpoint: props.settings.aiCustomEndpoint || "",
  enableThinking: props.settings.aiEnableThinking ?? false,
  searchProvider: props.settings.searchProvider || "jina",
  searchBochaApiKey: props.settings.searchBochaApiKey || "",
  searchSearxngUrl: props.settings.searchSearxngUrl || "",
}))

// 切换AI配置面板
const toggleAiSettings = (): void => {
  showAiSettings.value = !showAiSettings.value
}

// ==================== 功能列表配置 ====================
// 元数据定义于 src/features/config.ts（单一数据源）

const resolveI18n = (obj: Record<string, any>, key: string): any => {
  if (!key.includes(".")) return obj[key]
  return key.split(".").reduce((acc, k) => acc?.[k], obj)
}

const features = computed<Feature[]>(() =>
  (FEATURE_CONFIG as unknown as FeatureMeta[]).map(({
    id,
    defaultTitle,
    defaultDesc,
    titleI18nKey,
    descI18nKey,
    actions,
  }) => ({
    id,
    iconKey: id as IconKey,
    title: (titleI18nKey ? resolveI18n(props.i18n, titleI18nKey) : props.i18n[id]) || defaultTitle,
    desc: (descI18nKey ? resolveI18n(props.i18n, descI18nKey) : props.i18n[`${id}Desc`]) || defaultDesc,
    actions: actions || [],
  })),
)

const filteredFeatures = computed<Feature[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return features.value
  return features.value.filter(
    (f) =>
      f.title.toLowerCase().includes(q)
      || f.desc.toLowerCase().includes(q),
  )
})

const clearSearch = (): void => {
  searchQuery.value = ""
  searchInputRef.value?.focus()
}

onMounted(() => {
  nextTick(() => searchInputRef.value?.focus())
})

const getFeatureEnabled = (featureId: string): boolean => {
  if (featureId === "superPanel") return true
  const key = featureIdToSettingKey(featureId)
  return (props.settings as any)[key] ?? true
}

const canToggle = (featureId: string): boolean => featureId !== "superPanel"

const handleToggle = (featureId: string, enabled: boolean): void => {
  emit("toggleFeature", featureId, enabled)
}

const themeSchemeOptions = computed<SelectorOption[]>(() =>
  Object.values(THEMES).map((t) => ({
    value: t.id,
    label: t.name,
    color: t.primary,
  })),
)

const getSelectorOptions = (featureId: string): SelectorOption[] => {
  if (featureId === "themeColor") return themeSchemeOptions.value
  return []
}

const getSelectedOption = (featureId: string): string => {
  if (featureId === "themeColor") return props.settings.themeColorScheme || "orange"
  return ""
}

const handleSelect = (featureId: string, value: string): void => {
  emit("selectFeature", featureId, value)
}
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
