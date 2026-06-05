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
      :active-tab="activeTab"
      :i18n="i18n"
      @toggle-ai-settings="props.onOpenAiSettings?.()"
      @refresh="emit('refresh')"
      @close="emit('close')"
      @change-tab="activeTab = $event"
    />

    <!-- 搜索栏（仅功能列表 Tab） -->
    <div
      v-if="activeTab === 'features'"
      class="super-panel-search"
    >
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

    <!-- 状态统计（仅功能列表 Tab） -->
    <div
      v-if="activeTab === 'features'"
      class="super-panel-stats"
    >
      <span
        v-for="s in FEATURE_STATUSES"
        :key="s"
        class="stats-item"
        :class="`stats-${s}`"
      >
        <span class="stats-dot" />
        {{ statusLabels[s] || s }}
        <span class="stats-count">{{ statusStats[s] }}</span>
      </span>
    </div>

    <!-- 内容区 -->
    <div class="super-panel-content">
      <!-- 版本汇总 Tab -->
      <VersionSummary
        v-if="activeTab === 'versions'"
        :i18n="i18n"
        :feature-versions="featureVersions"
        @open-versions="emit('openVersions', $event)"
      />

      <!-- 功能列表 Tab -->
      <template v-else>
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
            :status-labels="statusLabels"
            @action="emit('action', $event)"
            @toggle="emit('toggleFeature', feature.id, $event)"
            @select="emit('selectFeature', feature.id, $event)"
            @status-change="emit('statusFeature', feature.id, $event)"
            @open-versions="emit('openVersions', feature.id)"
          />
        </TransitionGroup>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SelectorOption } from "./components/FeatureCard.vue"
import type {
  Feature,
  FeatureStatus,
  FeatureVersionEntry,
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
import FeatureCard from "./components/FeatureCard.vue"
import SuperPanelHeader from "./components/SuperPanelHeader.vue"
import VersionSummary from "./components/VersionSummary.vue"
import {
  DEFAULT_VERSION,
  FEATURE_STATUSES,
} from "./types"

interface Props {
  visible: boolean
  settings: PluginSettings
  i18n: Record<string, any>
  featureVersions?: Record<string, FeatureVersionEntry[]>
  onOpenAiSettings?: () => void
}

interface Emits {
  (e: "close"): void
  (e: "action", action: string): void
  (e: "refresh"): void
  (e: "toggleFeature", featureId: string, enabled: boolean): void
  (e: "selectFeature", featureId: string, value: string): void
  (e: "statusFeature", featureId: string, status: string): void
  (e: "openVersions", featureId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Tab 状态
const activeTab = ref<"features" | "versions">("features")

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
  }) => {
    const versions = props.featureVersions?.[id] || []
    return {
      id,
      iconKey: id as IconKey,
      title: (titleI18nKey ? resolveI18n(props.i18n, titleI18nKey) : props.i18n[id]) || defaultTitle,
      desc: (descI18nKey ? resolveI18n(props.i18n, descI18nKey) : props.i18n[`${id}Desc`]) || defaultDesc,
      actions: actions || [],
      status: (props.settings.featureStatus?.[id] || "") as FeatureStatus,
      version: versions.length > 0 ? versions[0].version : DEFAULT_VERSION,
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

const statusStats = computed(() => {
  const counts: Record<string, number> = {}
  FEATURE_STATUSES.forEach((s) => {
    counts[s] = 0
  })
  const source = searchQuery.value ? filteredFeatures.value : features.value
  source.forEach((f) => {
    if (f.status) counts[f.status] = (counts[f.status] || 0) + 1
  })
  return counts
})

onMounted(() => {
  nextTick(() => searchInputRef.value?.focus())
})

const getFeatureEnabled = (featureId: string): boolean => {
  if (featureId === "superPanel") return true
  const key = featureIdToSettingKey(featureId)
  return (props.settings as any)[key] ?? true
}

const canToggle = (featureId: string): boolean => featureId !== "superPanel"

const statusLabels = computed<Record<string, string>>(() => ({
  stable: props.i18n.statusStable || "稳定",
  needsFix: props.i18n.statusNeedsFix || "待修复",
  critical: props.i18n.statusCritical || "严重",
  minor: props.i18n.statusMinor || "需优化",
}))

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

</script>

<style lang="scss">
@use './styles/index.scss';
</style>
