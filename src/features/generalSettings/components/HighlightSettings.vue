<!-- 双击高亮功能设置面板：功能开关 + 功能说明 + 高亮样式配置（颜色/长度限制） -->
<template>
  <div class="highlight-settings">
    <!-- 功能开关标题："双击高亮功能" -->
    <SettingLabel
      icon="edit"
      :text="i18n.enableHighlight"
      class="toggle-label"
    />
    <SiSwitch
      v-model="enableHighlight"
      @change="handleToggleChange"
    />
    <!-- 开关说明："双击选中文本自动高亮显示" -->
    <p class="toggle-description">
      {{ i18n.highlightDescription }}
    </p>

    <!-- 高亮样式设置区块（开关开启时显示） -->
    <div
      v-if="enableHighlight"
      class="style-settings"
    >
      <!-- 区块标题："高亮样式设置" -->
      <SettingLabel
        icon="format"
        :text="i18n.highlightStyleSettings"
        class="style-settings-title"
      />

      <!-- 背景颜色行 -->
      <div class="style-row">
        <!-- 行标签："背景颜色" -->
        <label class="style-label">
          {{ i18n.highlightBgColor }}
        </label>
        <ColorField
          v-model="backgroundColor"
          placeholder="rgb(255, 220, 60)"
          class="style-color"
          @update:model-value="handleStyleChange"
        />
      </div>

      <!-- 长度限制行：最小/最大文字与字母长度 -->
      <div
        v-for="field in LENGTH_FIELDS"
        :key="field.key"
        class="style-row"
      >
        <!-- 行标签："最小文字长度 / 最小字母长度 / 最大文字长度 / 最大字母长度" -->
        <label class="style-label">
          {{ i18n[field.labelKey] }}
        </label>
        <SiInput
          :model-value="lengths[field.key]"
          type="number"
          size="small"
          class="style-number"
          @change="(value) => handleLengthChange(field, value)"
        />
      </div>

      <!-- 双击解释单词开关行 -->
      <div class="style-row">
        <!-- 行标签："双击解释单词" -->
        <label class="style-label">
          {{ i18n.highlightWordExplain }}
        </label>
        <SiSwitch
          v-model="enableWordExplain"
          @change="handleStyleChange"
        />
      </div>
      <!-- 解释功能说明："优先读取单词本释义，未收录时调用 AI 翻译（仅英文单词）" -->
      <p class="toggle-description">
        {{ i18n.highlightWordExplainDesc }}
      </p>

      <!-- 自动播放单词发音开关行（解释开关开启时显示） -->
      <div
        v-if="enableWordExplain"
        class="style-row"
      >
        <!-- 行标签："自动播放单词发音" -->
        <label class="style-label">
          {{ i18n.highlightAutoPlayWord }}
        </label>
        <SiSwitch
          v-model="autoPlayWord"
          @change="handleStyleChange"
        />
      </div>

      <!-- 发音来源选择行（解释 + 自动播放均开启时显示） -->
      <div
        v-if="enableWordExplain && autoPlayWord"
        class="style-row"
      >
        <!-- 行标签："发音来源" -->
        <label class="style-label">
          {{ i18n.highlightPronunciationSource }}
        </label>
        <SiSelect
          v-model="pronunciationSource"
          :options="sourceOptions"
          size="small"
          class="style-color"
          @change="handleStyleChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { GeneralSettings } from "../GeneralSettings"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  reactive,
  ref,
} from "vue"
import SiInput from "@/components/Input.vue"
import SiSelect from "@/components/Select.vue"
import SiSwitch from "@/components/Switch.vue"
import {
  DEFAULT_HIGHLIGHT_SETTINGS,
  GeneralSettingsStorage,
} from "../types/storage"
import type { PronunciationSource } from "../types/storage"
import ColorField from "./ColorField.vue"
import SettingLabel from "./SettingLabel.vue"

interface Props {
  i18n?: Record<string, string>
  plugin?: Plugin | null
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
})

/** 长度限制输入行配置：key 对应设置字段，labelKey 对应 i18n 键，max 为允许上限 */
const LENGTH_FIELDS = [
  { key: "minTextLength", labelKey: "highlightMinTextLength", max: 100 },
  { key: "minLetterLength", labelKey: "highlightMinLetterLength", max: 100 },
  { key: "maxTextLength", labelKey: "highlightMaxTextLength", max: 1000 },
  { key: "maxLetterLength", labelKey: "highlightMaxLetterLength", max: 1000 },
] as const

type LengthField = (typeof LENGTH_FIELDS)[number]

const enableHighlight = ref(DEFAULT_HIGHLIGHT_SETTINGS.enableHighlight)
const backgroundColor = ref(DEFAULT_HIGHLIGHT_SETTINGS.backgroundColor)
const enableWordExplain = ref(DEFAULT_HIGHLIGHT_SETTINGS.enableWordExplain)
const autoPlayWord = ref(DEFAULT_HIGHLIGHT_SETTINGS.autoPlayWord)
const pronunciationSource = ref<PronunciationSource>(DEFAULT_HIGHLIGHT_SETTINGS.pronunciationSource)

/** 发音来源选项：标签文案取自 i18n（"系统合成（离线）" / "有道词典（在线）"） */
const sourceOptions = computed(() => [
  { label: props.i18n.highlightSourceWebSpeech, value: "webSpeech" },
  { label: props.i18n.highlightSourceYoudao, value: "youdao" },
])
const lengths = reactive<Record<LengthField["key"], number>>({
  minTextLength: DEFAULT_HIGHLIGHT_SETTINGS.minTextLength,
  minLetterLength: DEFAULT_HIGHLIGHT_SETTINGS.minLetterLength,
  maxTextLength: DEFAULT_HIGHLIGHT_SETTINGS.maxTextLength,
  maxLetterLength: DEFAULT_HIGHLIGHT_SETTINGS.maxLetterLength,
})
let storage: GeneralSettingsStorage | null = null

/** 获取挂载在 plugin 上的 GeneralSettings 实例（注册于 registerGeneralSettings） */
const getGeneralSettings = (): GeneralSettings | null => {
  const host = props.plugin as unknown as { __generalSettings?: GeneralSettings } | null
  return host?.__generalSettings ?? null
}

const loadSettings = async () => {
  if (!storage) return
  try {
    // loadOrDefault 保证返回带 DEFAULT_HIGHLIGHT_SETTINGS 默认值的完整对象
    const settings = await storage.highlight.loadOrDefault()
    enableHighlight.value = settings.enableHighlight
    backgroundColor.value = settings.backgroundColor
    enableWordExplain.value = settings.enableWordExplain
    autoPlayWord.value = settings.autoPlayWord
    pronunciationSource.value = settings.pronunciationSource
    for (const field of LENGTH_FIELDS) {
      lengths[field.key] = settings[field.key]
    }
  } catch (e) {
    console.error("加载高亮设置失败:", e)
  }
}

const handleToggleChange = () => {
  try {
    getGeneralSettings()?.updateHighlight(enableHighlight.value)
    showMessage(
      enableHighlight.value ? props.i18n.highlightEnabled : props.i18n.highlightDisabled,
      2000,
      "info",
    )
  } catch (e) {
    console.error("保存高亮设置失败:", e)
  }
}

const handleStyleChange = () => {
  try {
    getGeneralSettings()?.updateHighlightOptions({
      backgroundColor: backgroundColor.value,
      enableWordExplain: enableWordExplain.value,
      autoPlayWord: autoPlayWord.value,
      pronunciationSource: pronunciationSource.value,
      ...lengths,
    })
  } catch (e) {
    console.error("更新高亮样式失败:", e)
  }
}

const handleLengthChange = (field: LengthField, value: string | number) => {
  const num = Number(value)
  // 非法输入或越界时钳制到 [1, field.max]
  lengths[field.key] = Number.isFinite(num)
    ? Math.min(Math.max(Math.round(num), 1), field.max)
    : 1
  handleStyleChange()
}

onMounted(() => {
  if (props.plugin) {
    storage = new GeneralSettingsStorage(props.plugin)
  }
  loadSettings()
})
</script>

<style scoped lang="scss">
@use "../styles/HighlightSettings.scss";
</style>
