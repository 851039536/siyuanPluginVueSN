<template>
  <div class="highlight-settings">
    <label class="section-header setting-label">
      <IconWrapper
        name="edit"
        :size="14"
        class="section-icon"
      />
      {{ i18n?.enableHighlight || '双击高亮功能' }}
    </label>
    <SiSwitch
      v-model="enableHighlight"
      @change="handleToggleChange"
    />
    <p class="toggle-description">
      {{ i18n?.highlightDescription || '双击选中文本自动高亮显示' }}
    </p>

    <!-- 功能说明 -->
    <div class="feature-description">
      <div class="section-header description-title">
        <IconWrapper
          name="lightbulb"
          :size="14"
          class="section-icon"
        />
        {{ i18n?.featureDescription || '功能说明' }}
      </div>
      <ul class="description-list">
        <li>{{ i18n?.highlightFeature1 || '在文档编辑器中双击选中文本，自动应用高亮样式' }}</li>
      </ul>
    </div>

    <!-- 高亮样式设置 -->
    <template v-if="enableHighlight">
      <div class="style-settings">
        <div class="section-header style-settings-title">
          <IconWrapper
            name="format"
            :size="14"
            class="section-icon"
          />
          {{ i18n?.highlightStyleSettings || '高亮样式设置' }}
        </div>

        <div class="style-row">
          <label class="style-label">
            {{ i18n?.highlightBgColor || '背景颜色' }}
          </label>
          <div class="color-input-wrapper">
            <input
              v-model="backgroundColor"
              type="color"
              class="color-picker"
              @input="handleStyleChange"
            />
            <input
              v-model="backgroundColor"
              type="text"
              class="color-text"
              placeholder="rgb(255, 220, 60)"
              @change="handleStyleChange"
            />
          </div>
        </div>

        <div class="style-row">
          <label class="style-label">
            {{ i18n?.highlightFontSize || '字体大小' }}
          </label>
          <select
            v-model="fontSize"
            class="style-select"
            @change="handleStyleChange"
          >
            <option value="0">
              跟随原文
            </option>
            <option value="12">
              12px
            </option>
            <option value="13">
              13px
            </option>
            <option value="14">
              14px
            </option>
            <option value="15">
              15px
            </option>
            <option value="16">
              16px
            </option>
            <option value="18">
              18px
            </option>
            <option value="20">
              20px
            </option>
          </select>
        </div>

        <div class="style-row">
          <label class="style-label">
            {{ i18n?.highlightBold || '加粗显示' }}
          </label>
          <SiSwitch
            v-model="bold"
            @change="handleStyleChange"
          />
        </div>

        <div class="style-row">
          <label class="style-label">
            {{ i18n?.highlightMinTextLength || '最小文字长度' }}
          </label>
          <input
            v-model.number="minTextLength"
            type="number"
            class="style-number"
            min="1"
            max="100"
            @change="handleStyleChange"
          />
        </div>

        <div class="style-row">
          <label class="style-label">
            {{ i18n?.highlightMinLetterLength || '最小字母长度' }}
          </label>
          <input
            v-model.number="minLetterLength"
            type="number"
            class="style-number"
            min="1"
            max="100"
            @change="handleStyleChange"
          />
        </div>

        <div class="style-row">
          <label class="style-label">
            {{ i18n?.highlightMaxTextLength || '最大文字长度' }}
          </label>
          <input
            v-model.number="maxTextLength"
            type="number"
            class="style-number"
            min="1"
            max="1000"
            @change="handleStyleChange"
          />
        </div>

        <div class="style-row">
          <label class="style-label">
            {{ i18n?.highlightMaxLetterLength || '最大字母长度' }}
          </label>
          <input
            v-model.number="maxLetterLength"
            type="number"
            class="style-number"
            min="1"
            max="1000"
            @change="handleStyleChange"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from "siyuan"
import {
  onMounted,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import SiSwitch from "@/components/Switch.vue"
import { GeneralSettingsStorage } from "@/features/generalSettings/types/storage"

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: any
}>()

const enableHighlight = ref(true)
const backgroundColor = ref("rgb(255, 220, 60)")
const fontSize = ref("0")
const bold = ref(false)
const minTextLength = ref(1)
const minLetterLength = ref(1)
const maxTextLength = ref(50)
const maxLetterLength = ref(100)
const storage = ref<GeneralSettingsStorage | null>(null)

const loadSettings = async () => {
  if (!storage.value) return
  try {
    const settings = await storage.value.highlight.loadOrDefault()
    if (settings) {
      enableHighlight.value = settings.enableHighlight ?? true
      backgroundColor.value = settings.backgroundColor ?? "rgb(255, 220, 60)"
      fontSize.value = settings.fontSize?.toString() ?? "0"
      bold.value = settings.bold ?? false
      minTextLength.value = settings.minTextLength ?? 1
      minLetterLength.value = settings.minLetterLength ?? 1
      maxTextLength.value = settings.maxTextLength ?? 50
      maxLetterLength.value = settings.maxLetterLength ?? 100
    }
  } catch (e) {
    console.error("加载高亮设置失败:", e)
  }
}

const handleToggleChange = () => {
  try {
    const generalSettings = (props.plugin as any).__generalSettings
    if (generalSettings) {
      generalSettings.updateHighlight(enableHighlight.value)
    }

    showMessage(
      enableHighlight.value
        ? (props.i18n?.highlightEnabled ?? "双击高亮功能已启用")
        : (props.i18n?.highlightDisabled ?? "双击高亮功能已禁用"),
      2000,
      "info",
    )
  } catch (e) {
    console.error("保存高亮设置失败:", e)
  }
}

const handleStyleChange = () => {
  try {
    const generalSettings = (props.plugin as any).__generalSettings
    if (generalSettings) {
      generalSettings.updateHighlightOptions({
        backgroundColor: backgroundColor.value,
        fontSize: Number(fontSize.value),
        bold: bold.value,
        minTextLength: minTextLength.value,
        minLetterLength: minLetterLength.value,
        maxTextLength: maxTextLength.value,
        maxLetterLength: maxLetterLength.value,
      })
    }
  } catch (e) {
    console.error("更新高亮样式失败:", e)
  }
}

onMounted(() => {
  if (props.plugin) {
    storage.value = new GeneralSettingsStorage(props.plugin)
  }
  loadSettings()
})

defineExpose({
  loadSettings,
  enableHighlight,
})
</script>

<style scoped lang="scss">
@use "../styles/HighlightSettings.scss";
</style>
