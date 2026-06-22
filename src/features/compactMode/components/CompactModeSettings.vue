<template>
  <div class="compact-mode-settings">
    <!-- 主开关 -->
    <div class="master-row">
      <label class="section-header setting-label">
        <IconWrapper name="formatSize" :size="14" class="section-icon" />
        {{ i18n?.compactModeSettings || '紧凑模式' }}
      </label>
      <SiSwitch
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
        <div class="section-header sub-title">
          <IconWrapper name="formatSize" :size="14" class="section-icon" />
          {{ i18n?.compactModeDensity || '密度级别' }}
        </div>
        <div class="options-row">
          <label
            v-for="opt in densityOptions"
            :key="opt.value"
            class="chip-option"
            :class="{ active: density === opt.value }"
          >
            <input
              v-model="density"
              type="radio"
              :value="opt.value"
              name="compact-density"
              class="hidden-radio"
              @change="save"
            />
            {{ opt.desc }}
          </label>
        </div>
      </div>

      <!-- 字号缩放 -->
      <div class="sub-section">
        <div class="section-header sub-title">
          <IconWrapper name="code" :size="14" class="section-icon" />
          {{ i18n?.compactModeFontScale || '字号缩放' }}
        </div>
        <div class="options-row">
          <label
            v-for="opt in fontScaleOptions"
            :key="opt.value"
            class="chip-option"
            :class="{ active: fontScale === opt.value }"
          >
            <input
              v-model="fontScale"
              type="radio"
              :value="opt.value"
              name="compact-font-scale"
              class="hidden-radio"
              @change="save"
            />
            {{ opt.desc }}
          </label>
        </div>
      </div>

      <!-- 区域独立开关 -->
      <div class="sub-section">
        <div class="section-header sub-title">
          <IconWrapper name="forward" :size="14" class="section-icon" />
          {{ i18n?.compactModeAreas || '生效区域' }}
        </div>
        <div class="areas-grid">
          <div
            v-for="area in areaOptions"
            :key="area.id"
            class="area-row"
          >
            <label class="area-label">{{ area.label }}</label>
            <SiSwitch
              :model-value="areas[area.id]"
              @update:model-value="(v: boolean) => { areas[area.id] = v; save() }"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue"
import SiSwitch from "@/components/Switch.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { applyCompactMode } from "@/features/compactMode"
import type { CompactModeSettings } from "@/features/compactMode"
import { saveSettings } from "@/config/settings"

interface Props {
  i18n?: Record<string, string>
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
})

const s = () => props.plugin?.settings

const compactMode = ref(s()?.compactMode ?? true)

const density = ref(s()?.compactModeDensity ?? 'compact')
const densityOptions = [
  { value: 'moderate', desc: '适中' },
  { value: 'compact',  desc: '紧凑' },
  { value: 'extreme',  desc: '极简' },
]

const fontScale = ref(s()?.compactModeFontScale ?? 94)
const fontScaleOptions = [
  { value: 100, desc: '100%' },
  { value: 98,  desc: '98%' },
  { value: 96,  desc: '96%' },
  { value: 94,  desc: '94%' },
  { value: 92,  desc: '92%' },
  { value: 90,  desc: '90%' },
]

const areas = reactive<Record<string, boolean>>({
  sidebar: s()?.compactModeAreas?.sidebar ?? true,
  editor: s()?.compactModeAreas?.editor ?? true,
  tabs: s()?.compactModeAreas?.tabs ?? true,
  dialogs: s()?.compactModeAreas?.dialogs ?? true,
  controls: s()?.compactModeAreas?.controls ?? true,
})

const areaOptions = computed(() => [
  { id: "sidebar",  label: props.i18n?.compactAreaSidebar  || "侧边栏与文件树" },
  { id: "editor",   label: props.i18n?.compactAreaEditor   || "编辑区" },
  { id: "tabs",     label: props.i18n?.compactAreaTabs     || "页签栏" },
  { id: "dialogs",  label: props.i18n?.compactAreaDialogs  || "对话框" },
  { id: "controls", label: props.i18n?.compactAreaControls || "按钮与菜单" },
])

function buildSettings(): CompactModeSettings {
  return {
    compactMode: compactMode.value,
    compactModeDensity: density.value as CompactModeSettings['compactModeDensity'],
    compactModeFontScale: fontScale.value,
    compactModeAreas: { ...areas },
  }
}

async function save() {
  const plugin = props.plugin
  if (!plugin) return

  const cs = buildSettings()
  plugin.settings.compactMode = cs.compactMode
  plugin.settings.compactModeDensity = cs.compactModeDensity
  plugin.settings.compactModeFontScale = cs.compactModeFontScale
  plugin.settings.compactModeAreas = cs.compactModeAreas

  await saveSettings(plugin, plugin.settings)
  applyCompactMode(cs)
}
</script>

<style scoped>
.compact-mode-settings {
  padding: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.setting-label { margin-bottom: 0; }

.section-icon {
  font-size: 14px;
  opacity: 0.8;
}

.toggle-description {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  margin-top: 8px;
  line-height: 1.4;
}

.master-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sub-section {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
}

/* --- Chip 选项（密度 / 字号共用） --- */
.options-row {
  display: flex;
  gap: 6px;
}

.chip-option {
  flex: 1;
  text-align: center;
  padding: 5px 2px;
  font-size: 11px;
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace;
  color: var(--b3-theme-on-surface-variant);
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s, color 0.12s, box-shadow 0.12s;
  user-select: none;
}

.chip-option:hover {
  border-color: var(--b3-theme-primary-light);
}

.chip-option.active {
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-primary);
  background: var(--b3-theme-surface);
  box-shadow: 0 0 0 1px var(--b3-theme-primary);
}

.sub-title {
  margin-bottom: 10px;
  font-size: 10px;
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--b3-theme-on-surface-variant);
}

.hidden-radio {
  display: none;
}

/* --- 区域开关 --- */
.areas-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.area-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

.area-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}
</style>
