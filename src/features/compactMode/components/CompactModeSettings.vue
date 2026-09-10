<!-- 紧凑模式设置面板：密度档位、字号缩放与生效区域开关配置 -->
<template>
  <div class="compact-mode-settings">
    <!-- 主开关 -->
    <div class="master-row">
      <Label
        class="setting-title"
        icon="formatSize"
        :icon-size="14"
        size="small"
      >
        {{ i18n?.compactModeSettings || '紧凑模式' }}
      </Label>
      <Switch
        v-model="compactMode"
        @change="save"
      />
    </div>
    <p class="toggle-description">
      {{ i18n?.compactModeDescription || '启用后全局应用紧凑样式，可独立调节间距密度和字号缩放' }}
    </p>

    <template v-if="compactMode">
      <!-- 密度级别 -->
      <div class="sub-section">
        <Label
          class="sub-title"
          icon="formatSize"
          :icon-size="14"
          size="xsmall"
        >
          {{ i18n?.compactModeDensity || '密度级别' }}
        </Label>
        <div class="options-row">
          <Button
            v-for="opt in densityOptions"
            :key="opt.value"
            :variant="opt.value === density ? 'primary' : 'ghost'"
            text
            size="xsmall"
            :aria-pressed="opt.value === density"
            @click="selectDensity(opt.value)"
          >
            {{ opt.label }}
          </Button>
        </div>
      </div>

      <!-- 字号缩放 -->
      <div class="sub-section">
        <Label
          class="sub-title"
          icon="code"
          :icon-size="14"
          size="xsmall"
        >
          {{ i18n?.compactModeFontScale || '字号缩放' }}
        </Label>
        <div class="options-row">
          <Button
            v-for="opt in fontScaleOptions"
            :key="opt.value"
            :variant="opt.value === fontScale ? 'primary' : 'ghost'"
            text
            size="xsmall"
            :aria-pressed="opt.value === fontScale"
            @click="selectFontScale(opt.value)"
          >
            {{ opt.label }}
          </Button>
        </div>
      </div>

      <!-- 生效区域 -->
      <div class="sub-section">
        <Label
          class="sub-title"
          icon="forward"
          :icon-size="14"
          size="xsmall"
        >
          {{ i18n?.compactModeAreas || '生效区域' }}
        </Label>
        <div class="areas-grid">
          <div
            v-for="area in areaOptions"
            :key="area.id"
            class="area-row"
          >
            <Label size="small">{{ area.label }}</Label>
            <Switch
              :model-value="areas[area.id]"
              @update:model-value="setArea(area.id, $event)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type PluginSample from "@/index"
import {
  ALL_AREAS,
  ALL_DENSITIES,
  ALL_FONT_SCALES,
  applyCompactMode,
  type CompactArea,
  type CompactDensity,
  type CompactModeSettings,
} from "@/features/compactMode"
import {
  computed,
  reactive,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Label from "@/components/Label.vue"
import Switch from "@/components/Switch.vue"
import { saveSettings } from "@/config/settings"

interface Props {
  i18n?: Record<string, string>
  plugin?: PluginSample
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: undefined,
})

/** 未持久化过字号档位时的默认值（与 DEFAULT_SETTINGS 一致） */
const DEFAULT_FONT_SCALE = 94
/** 未持久化过密度档位时的默认值（与 DEFAULT_SETTINGS 一致） */
const DEFAULT_DENSITY: CompactDensity = "compact"

/** 密度档位 → i18n 键 */
const DENSITY_LABEL_KEYS: Record<CompactDensity, string> = {
  moderate: "compactDensityModerate",
  compact: "compactDensityCompact",
  extreme: "compactDensityExtreme",
}

/** 密度档位 → i18n 键缺失时的兜底文案 */
const DENSITY_FALLBACK_TEXT: Record<CompactDensity, string> = {
  moderate: "适中",
  compact: "紧凑",
  extreme: "极简",
}

/** 生效区域 → i18n 键 */
const AREA_LABEL_KEYS: Record<CompactArea, string> = {
  sidebar: "compactAreaSidebar",
  editor: "compactAreaEditor",
  tabs: "compactAreaTabs",
  dialogs: "compactAreaDialogs",
  controls: "compactAreaControls",
}

/** 生效区域 → i18n 键缺失时的兜底文案 */
const AREA_FALLBACK_TEXT: Record<CompactArea, string> = {
  sidebar: "侧边栏与文件树",
  editor: "编辑区",
  tabs: "页签栏",
  dialogs: "对话框",
  controls: "按钮与菜单",
}

const compactMode = ref(props.plugin?.settings.compactMode ?? true)
const density = ref<CompactDensity>(props.plugin?.settings.compactModeDensity ?? DEFAULT_DENSITY)
const fontScale = ref(props.plugin?.settings.compactModeFontScale ?? DEFAULT_FONT_SCALE)

/** 区域开关初值：区域清单与 CSS 类体系共用 ALL_AREAS，避免两处各写一份 */
const areas = reactive<Record<string, boolean>>(
  Object.fromEntries(
    ALL_AREAS.map((area) => [area, props.plugin?.settings.compactModeAreas?.[area] ?? true]),
  ),
)

/** 密度档位按钮（选中态由 Button 的 variant 表达） */
const densityOptions = computed(() =>
  ALL_DENSITIES.map((value) => ({
    value,
    label: props.i18n?.[DENSITY_LABEL_KEYS[value]] || DENSITY_FALLBACK_TEXT[value],
  })),
)

/** 字号档位按钮：值为百分比，无需 i18n */
const fontScaleOptions = ALL_FONT_SCALES.map((value) => ({
  value,
  label: `${value}%`,
}))

/** 生效区域开关行 */
const areaOptions = computed(() =>
  ALL_AREAS.map((id) => ({
    id,
    label: props.i18n?.[AREA_LABEL_KEYS[id]] || AREA_FALLBACK_TEXT[id],
  })),
)

function selectDensity(value: CompactDensity): void {
  density.value = value
  save()
}

function selectFontScale(value: number): void {
  fontScale.value = value
  save()
}

function setArea(id: string, value: boolean): void {
  areas[id] = value
  save()
}

function buildSettings(): CompactModeSettings {
  return {
    compactMode: compactMode.value,
    compactModeDensity: density.value,
    compactModeFontScale: fontScale.value,
    compactModeAreas: { ...areas },
  }
}

/** 写回插件设置 → 落盘 → 同步 html 上的紧凑模式类名 */
async function save(): Promise<void> {
  const plugin = props.plugin
  if (!plugin) {
    return
  }

  const next = buildSettings()
  Object.assign(plugin.settings, next)
  await saveSettings(plugin, plugin.settings)
  applyCompactMode(next)
}
</script>

<style scoped lang="scss">
@use "../styles/CompactModeSettings.scss";
</style>
