<!-- 超级面板主视图：功能搜索与功能卡片列表 -->
<template>
  <!-- 面板容器 -->
  <div class="super-panel-container">
    <!-- 头部 -->
    <SuperPanelHeader
      :title="i18n.title || '超级面板'"
      :i18n="i18n"
      @toggle-ai-settings="props.onOpenAiSettings?.()"
      @close="emit('close')"
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
      <!-- 空结果提示 -->
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

      <!-- 功能卡片列表 -->
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
          :color-value="getColorValue(feature.id)"
          :color-label="feature.id === 'themeColor' ? (props.themeColorI18n.customColorLabel || '自定义颜色') : undefined"
          @action="emit('action', $event)"
          @toggle="emit('toggleFeature', feature.id, $event)"
          @select="emit('selectFeature', feature.id, $event)"
          @toggle-sub-feature="emit('toggleSubFeature', $event)"
          @color-change="(value) => emit('colorChange', feature.id, value)"
        />
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SelectorOption } from "./components/FeatureCard.vue"
import type {
  Feature,
  SubFeature,
} from "./types"
import type { IconKey } from "@/config/icons"
import type { PluginSettings } from "@/config/settings"
import type {
  FeatureMeta,
  SubFeatureMeta,
} from "@/features/config"
import {
  computed,
  nextTick,
  onMounted,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { featureIdToSettingKey } from "@/config/settings"
import { FEATURE_CONFIG } from "@/features/config"
import {
  DEFAULT_THEME_SCHEME,
  isThemeColorSchemeId,
  THEMES,
} from "@/features/themeColor"
import FeatureCard from "./components/FeatureCard.vue"
import SuperPanelHeader from "./components/SuperPanelHeader.vue"

interface Props {
  settings: PluginSettings
  i18n: Record<string, any>
  themeColorI18n: Record<string, any>
  onOpenAiSettings?: () => void
}

interface Emits {
  (e: "close"): void
  (e: "action", action: string): void
  (e: "toggleFeature", featureId: string, enabled: boolean): void
  (e: "selectFeature", featureId: string, value: string): void
  (e: "toggleSubFeature", featureId: string): void
  (e: "colorChange", featureId: string, value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 搜索状态
const searchQuery = ref("")
const searchInputRef = ref<HTMLInputElement | null>(null)

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
    subFeatures,
  }) => {
    return {
      id,
      iconKey: id as IconKey,
      title: (titleI18nKey ? resolveI18n(props.i18n, titleI18nKey) : props.i18n[id]) || defaultTitle,
      desc: (descI18nKey ? resolveI18n(props.i18n, descI18nKey) : props.i18n[`${id}Desc`]) || defaultDesc,
      actions: actions || [],
      subFeatures: subFeatures?.map((sub: SubFeatureMeta): SubFeature => ({
        id: sub.id,
        label: (sub.labelI18nKey ? resolveI18n(props.i18n, sub.labelI18nKey) : "") || sub.defaultLabel,
        icon: sub.icon,
        color: sub.color,
        enabled: getFeatureEnabled(sub.id),
      })),
    }
  }),
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

const themeSchemeOptions = computed<SelectorOption[]>(() => [
  ...Object.entries(THEMES).map(([id, scheme]) => ({
    value: id,
    label: props.themeColorI18n[id] || scheme.name,
    color: scheme.primary,
  })),
  {
    value: "custom",
    label: props.themeColorI18n.custom || "自定义",
    color: props.settings.customThemeColor || "#d97757",
  },
])

const getSelectorOptions = (featureId: string): SelectorOption[] => {
  if (featureId === "themeColor") return themeSchemeOptions.value
  return []
}

const getSelectedOption = (featureId: string): string => {
  if (featureId === "themeColor") {
    const scheme = props.settings.themeColorScheme
    return isThemeColorSchemeId(scheme) ? scheme : DEFAULT_THEME_SCHEME
  }
  return ""
}

const getColorValue = (featureId: string): string | undefined => {
  if (featureId === "themeColor") return props.settings.customThemeColor || "#d97757"
  return undefined
}

</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "./styles/index.scss";
</style>
