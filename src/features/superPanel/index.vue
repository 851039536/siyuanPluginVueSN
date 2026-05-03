<template>
  <!-- 遮罩层 -->
  <div
    v-if="visible"
    class="super-panel-overlay"
    @click="emit('close')"
  />

  <!-- 面板容器 -->
  <div v-if="visible" class="super-panel-container">
    <!-- 头部 -->
    <SuperPanelHeader
      :title="i18n.title || '超级面板'"
      :i18n="i18n"
      @toggle-all="(v: boolean) => emit('toggleAllFeatures', v)"
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

    <!-- 内容区 -->
    <div class="super-panel-content">
      <FeatureCard
        v-for="feature in features"
        :key="feature.id"
        :feature="feature"
        :i18n="i18n"
        @action="emit('action', $event)"
        @toggle="(id: string, v: boolean) => emit('toggleFeature', id, v)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import SuperPanelHeader from "./components/SuperPanelHeader.vue";
import AiSettingsPanel from "./components/AiSettingsPanel.vue";
import FeatureCard from "./components/FeatureCard.vue";
import type { PluginSettings } from "@/config/settings";
import type { Feature, AiSettings } from "./types";
import { FEATURE_SETTINGS_MAP } from "./types";
import { FEATURE_CONFIG } from "@/features/config";
import type { IconKey } from "@/config/icons";

interface Props {
  visible: boolean;
  settings: PluginSettings;
  i18n: Record<string, any>;
}

interface Emits {
  (e: "close"): void;
  (e: "action", action: string): void;
  (e: "toggleFeature", featureId: string, enabled: boolean): void;
  (e: "toggleAllFeatures", enabled: boolean): void;
  (e: "refresh"): void;
  (e: "updateAiSettings", settings: AiSettings): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// AI配置状态
const showAiSettings = ref(false);

// AI设置数据
const aiSettings = computed<AiSettings>(() => ({
  provider: props.settings.aiApiProvider || "tongyi",
  model: props.settings.aiModel || "qwen-plus",
  customModel: props.settings.aiCustomModel || "",
  apiKey: props.settings.aiApiKey || "",
  customEndpoint: props.settings.aiCustomEndpoint || "",
  enableThinking: props.settings.aiEnableThinking ?? false,
}));

// 切换AI配置面板
const toggleAiSettings = () => {
  showAiSettings.value = !showAiSettings.value;
};

// ==================== 功能列表配置 ====================
// 元数据定义于 src/features/config.ts（单一数据源）

const resolveI18n = (obj: Record<string, any>, key: string): any => {
  if (!key.includes(".")) return obj[key];
  return key.split(".").reduce((acc, k) => acc?.[k], obj);
};

const features = computed<Feature[]>(() =>
  FEATURE_CONFIG.map(({ id, defaultTitle, defaultDesc, titleI18nKey, descI18nKey, actions }) => ({
    id,
    iconKey: id as IconKey,
    title: (titleI18nKey ? resolveI18n(props.i18n, titleI18nKey) : props.i18n[id]) || defaultTitle,
    desc: (descI18nKey ? resolveI18n(props.i18n, descI18nKey) : props.i18n[`${id}Desc`]) || defaultDesc,
    enabled: (props.settings as any)[FEATURE_SETTINGS_MAP[id]] ?? false,
    actions: actions || [],
  })),
);
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
