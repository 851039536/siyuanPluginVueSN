<template>
  <div class="heading-settings">
    <div class="settings-container">
      <!-- 风格选择 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="format"
              :size="13"
              class="label-icon"
            />
            {{ i18n.headingStyle || '标题风格' }}
          </label>
          <select
            v-model="selectedStyle"
            class="style-select"
            @change="applyStyle"
          >
            <option value="default">
              {{ i18n.defaultHeadingStyle || '默认风格' }}
            </option>
            <option value="github">
              {{ i18n.githubStyle || 'GitHub 风格' }}
            </option>
            <option value="mac">
              {{ i18n.macStyle || 'Mac 风格' }}
            </option>
            <option value="cartoon">
              {{ i18n.cartoonStyle || '卡通风格' }}
            </option>
            <option value="rainbow">
              {{ i18n.rainbowStyle || '彩虹风格' }}
            </option>
            <option value="monochrome">
              {{ i18n.monochromeStyle || '单色风格' }}
            </option>
            <option value="warm">
              {{ i18n.warmStyle || '暖色风格' }}
            </option>
            <option value="cool">
              {{ i18n.coolStyle || '冷色风格' }}
            </option>
            <option value="gradient">
              {{ i18n.gradientStyle || '渐变风格' }}
            </option>
            <option value="custom">
              {{ i18n.customStyle || '自定义' }}
            </option>
          </select>
        </div>
      </div>

      <!-- 标题层级显示设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="listOrdered"
              :size="13"
              class="label-icon"
            />
            {{ i18n.headingLevelDisplay || '标题层级显示' }}
          </label>
          <select
            v-model="levelDisplayStyle"
            class="style-select"
            @change="applyLevelDisplay"
          >
            <option value="none">
              {{ i18n.levelDisplayNone || '不显示' }}
            </option>
            <option value="number">
              {{ i18n.levelDisplayNumber || '数字标记 (1-6)' }}
            </option>
            <option value="roman">
              {{ i18n.levelDisplayRoman || '罗马数字 (I-VI)' }}
            </option>
            <option value="chinese">
              {{ i18n.levelDisplayChinese || '中文数字 (一-六)' }}
            </option>
            <option value="chineseUpper">
              {{ i18n.levelDisplayChineseUpper || '中文大写 (壹-陆)' }}
            </option>
            <option value="dots">
              {{ i18n.levelDisplayDots || '圆点标记 (•)' }}
            </option>
            <option value="emoji">
              {{ i18n.levelDisplayEmoji || '表情符号' }}
            </option>
            <option value="star">
              {{ i18n.levelDisplayStar || '星级标记' }}
            </option>
            <option value="arrow">
              {{ i18n.levelDisplayArrow || '箭头标记' }}
            </option>
            <option value="tag">
              {{ i18n.levelDisplayTag || '标签样式 (H1-H6)' }}
            </option>
            <option value="bracket">
              {{ i18n.levelDisplayBracket || '括号标记 [1-6]' }}
            </option>
            <option value="custom">
              {{ i18n.levelDisplayCustom || '自定义...' }}
            </option>
          </select>
          <div
            v-if="levelDisplayStyle !== 'none'"
            class="level-display-hint"
          >
            <IconWrapper
              name="info"
              :size="14"
              class="hint-icon"
            />
            <span class="hint-text">{{ i18n.levelDisplayHint || '注意:第三方主题可能会影响显示效果' }}</span>
          </div>
        </div>
      </div>

      <!-- 标题居中设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="chevronRight"
              :size="13"
              class="label-icon"
            />
            {{ i18n.titleCenterAlign || '标题居中显示' }}
          </label>
          <div class="toggle-container">
            <input
              v-model="titleCenterAlign"
              type="checkbox"
              class="toggle-checkbox"
              @change="applyTitleCenterAlign"
            />
            <span class="toggle-label">{{ titleCenterAlign ? (i18n.enabled || '已启用') : (i18n.disabled || '已禁用') }}</span>
          </div>
        </div>
      </div>

      <!-- 文档标题颜色设置 -->
      <div
        v-if="titleCenterAlign"
        class="setting-row"
      >
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="format"
              :size="13"
              class="label-icon"
            />
            {{ i18n.titleColor || '文档标题颜色' }}
          </label>
          <div class="title-color-input-group">
            <input
              v-model="titleColor"
              type="color"
              class="title-color-picker"
              @change="onTitleColorChange"
            />
            <input
              v-model="titleColor"
              type="text"
              class="title-color-text"
              @change="onTitleColorChange"
            />
            <button
              v-if="titleColor !== defaultTitleColor"
              class="reset-color-btn"
              @click="resetTitleColor"
            >
              {{ i18n.resetColor || '重置' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 文档标题字体大小设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="formatSize"
              :size="13"
              class="label-icon"
            />
            {{ i18n.titleFontSize || '文档标题字体大小' }}
          </label>
          <div class="input-group">
            <input
              v-model.number="titleFontSize"
              type="number"
              min="10"
              max="64"
              step="1"
              class="number-input"
              @change="onTitleFontSizeChange"
              @input="onTitleFontSizeChange"
            />
            <span class="unit-label">px</span>
            <div class="input-range-hint">
              <span class="hint-text">推荐范围: 10-64px</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 自定义层级标记设置 -->
      <div
        v-if="levelDisplayStyle === 'custom'"
        class="setting-row"
      >
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="edit"
              :size="13"
              class="label-icon"
            />
            {{ i18n.customLevelMarkers || '自定义标记' }}
          </label>
          <div class="custom-level-inputs">
            <div
              v-for="level in 6"
              :key="level"
              class="custom-level-item"
            >
              <label class="custom-level-label">H{{ level }}</label>
              <input
                v-model="customLevelMarkers[level - 1]"
                type="text"
                class="custom-level-input"
                :placeholder="`H${level}标记`"
                maxlength="10"
                @input="applyLevelDisplay"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- H1-H6字体大小设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="formatSize"
              :size="13"
              class="label-icon"
            />
            {{ i18n.headingFontSize || '标题字体大小' }}
          </label>

          <!-- 2列布局：一级和二级在同一行，三级和四级在同一行，五级和六级在同一行 -->
          <div class="font-size-grid-2col">
            <!-- H1 & H2 -->
            <div class="font-size-row">
              <div class="font-size-item-horizontal">
                <label class="font-size-label-horizontal">
                  <span class="heading-icon-h1 heading-icon-mini">H1</span>
                  <span class="font-size-text">{{ i18n.heading1Size || '一级标题' }}</span>
                </label>
                <div class="input-group-horizontal">
                  <input
                    v-model.number="headingSizes.h1"
                    type="number"
                    min="10"
                    max="64"
                    step="1"
                    class="number-input-mini"
                    @change="onFontSizeChange"
                    @input="onFontSizeChange"
                  />
                  <span class="unit-label-mini">px</span>
                </div>
              </div>
              <div class="font-size-item-horizontal">
                <label class="font-size-label-horizontal">
                  <span class="heading-icon-h2 heading-icon-mini">H2</span>
                  <span class="font-size-text">{{ i18n.heading2Size || '二级标题' }}</span>
                </label>
                <div class="input-group-horizontal">
                  <input
                    v-model.number="headingSizes.h2"
                    type="number"
                    min="10"
                    max="64"
                    step="1"
                    class="number-input-mini"
                    @change="onFontSizeChange"
                    @input="onFontSizeChange"
                  />
                  <span class="unit-label-mini">px</span>
                </div>
              </div>
            </div>

            <!-- H3 & H4 -->
            <div class="font-size-row">
              <div class="font-size-item-horizontal">
                <label class="font-size-label-horizontal">
                  <span class="heading-icon-h3 heading-icon-mini">H3</span>
                  <span class="font-size-text">{{ i18n.heading3Size || '三级标题' }}</span>
                </label>
                <div class="input-group-horizontal">
                  <input
                    v-model.number="headingSizes.h3"
                    type="number"
                    min="10"
                    max="64"
                    step="1"
                    class="number-input-mini"
                    @change="onFontSizeChange"
                    @input="onFontSizeChange"
                  />
                  <span class="unit-label-mini">px</span>
                </div>
              </div>
              <div class="font-size-item-horizontal">
                <label class="font-size-label-horizontal">
                  <span class="heading-icon-h4 heading-icon-mini">H4</span>
                  <span class="font-size-text">{{ i18n.heading4Size || '四级标题' }}</span>
                </label>
                <div class="input-group-horizontal">
                  <input
                    v-model.number="headingSizes.h4"
                    type="number"
                    min="10"
                    max="64"
                    step="1"
                    class="number-input-mini"
                    @change="onFontSizeChange"
                    @input="onFontSizeChange"
                  />
                  <span class="unit-label-mini">px</span>
                </div>
              </div>
            </div>

            <!-- H5 & H6 -->
            <div class="font-size-row">
              <div class="font-size-item-horizontal">
                <label class="font-size-label-horizontal">
                  <span class="heading-icon-h5 heading-icon-mini">H5</span>
                  <span class="font-size-text">{{ i18n.heading5Size || '五级标题' }}</span>
                </label>
                <div class="input-group-horizontal">
                  <input
                    v-model.number="headingSizes.h5"
                    type="number"
                    min="10"
                    max="64"
                    step="1"
                    class="number-input-mini"
                    @change="onFontSizeChange"
                    @input="onFontSizeChange"
                  />
                  <span class="unit-label-mini">px</span>
                </div>
              </div>
              <div class="font-size-item-horizontal">
                <label class="font-size-label-horizontal">
                  <span class="heading-icon-h6 heading-icon-mini">H6</span>
                  <span class="font-size-text">{{ i18n.heading6Size || '六级标题' }}</span>
                </label>
                <div class="input-group-horizontal">
                  <input
                    v-model.number="headingSizes.h6"
                    type="number"
                    min="10"
                    max="64"
                    step="1"
                    class="number-input-mini"
                    @change="onFontSizeChange"
                    @input="onFontSizeChange"
                  />
                  <span class="unit-label-mini">px</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 标题颜色设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="format"
              :size="13"
              class="label-icon"
            />
            {{ i18n.headingColors || '标题颜色' }}
          </label>
          <div class="heading-colors">
            <div
              v-for="level in 6"
              :key="level"
              class="color-item-compact"
            >
              <span
                class="heading-badge"
                :class="`heading-badge-h${level}`"
              >H{{ level }}</span>
              <input
                v-model="headingColors[headingColorKey(level)]"
                type="color"
                class="color-picker-mini"
                @change="onColorChange"
              />
              <input
                v-model="headingColors[headingColorKey(level)]"
                type="text"
                class="color-text-mini"
                @change="onColorChange"
              />
            </div>
          </div>
        </div>
      </div>


    </div>
  </div>
</template>

<script setup lang="ts">
import {
  onMounted,
  ref,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { GeneralSettingsStorage } from "@/features/generalSettings/types/storage"
import { generateLevelDisplayCss } from "../utils/styles"

interface HeadingColors {
  h1: string
  h2: string
  h3: string
  h4: string
  h5: string
  h6: string
}

interface HeadingSizes {
  h1: number
  h2: number
  h3: number
  h4: number
  h5: number
  h6: number
}

interface Props {
  i18n?: any
  plugin?: any
  initialSettings?: HeadingColors
  initialFontSizes?: HeadingSizes
}

interface Emits {
  (e: "change", settings: HeadingColors): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
  initialSettings: () => ({
    h1: "#F39A94",
    h2: "#F8D694",
    h3: "#B1DCB9",
    h4: "#AAD2FC",
    h5: "#AC9DC0",
    h6: "#D7D7D7",
  }),
  initialFontSizes: () => ({
    h1: 28,
    h2: 24,
    h3: 20,
    h4: 18,
    h5: 16,
    h6: 14,
  }),
})

const emit = defineEmits<Emits>()

const selectedStyle = ref("default")
const headingColors = ref<HeadingColors>({ ...props.initialSettings })
const levelDisplayStyle = ref("none")
const customLevelMarkers = ref<string[]>(["1", "2", "3", "4", "5", "6"])
const titleCenterAlign = ref(false)
const titleColor = ref("#2C3E50")
const defaultTitleColor = "#2C3E50"
const headingSizes = ref<HeadingSizes>({ ...props.initialFontSizes })
const titleFontSize = ref(24)
const storage = ref<GeneralSettingsStorage | null>(null)

const headingColorKey = (level: number): keyof HeadingColors => {
  return `h${level}` as keyof HeadingColors
}

// 预设风格
const styles: Record<string, HeadingColors> = {
  default: {
    h1: "#F39A94",
    h2: "#F8D694",
    h3: "#B1DCB9",
    h4: "#AAD2FC",
    h5: "#AC9DC0",
    h6: "#D7D7D7",
  },
  github: {
    h1: "#0969DA",
    h2: "#1F883D",
    h3: "#9A6700",
    h4: "#8250DF",
    h5: "#CF222E",
    h6: "#57606A",
  },
  mac: {
    h1: "#007AFF",
    h2: "#34C759",
    h3: "#FF9500",
    h4: "#FF3B30",
    h5: "#AF52DE",
    h6: "#8E8E93",
  },
  cartoon: {
    h1: "#FF6B9D",
    h2: "#FFA07A",
    h3: "#FFD700",
    h4: "#98D8C8",
    h5: "#87CEFA",
    h6: "#DDA0DD",
  },
  rainbow: {
    h1: "#FF6B6B",
    h2: "#FFA500",
    h3: "#FFD700",
    h4: "#90EE90",
    h5: "#87CEEB",
    h6: "#DA70D6",
  },
  monochrome: {
    h1: "#2C3E50",
    h2: "#34495E",
    h3: "#546E7A",
    h4: "#607D8B",
    h5: "#90A4AE",
    h6: "#B0BEC5",
  },
  warm: {
    h1: "#FF6B6B",
    h2: "#FF8E53",
    h3: "#FFAB73",
    h4: "#FFC299",
    h5: "#FFD4B3",
    h6: "#FFE4CC",
  },
  cool: {
    h1: "#667EEA",
    h2: "#64B5F6",
    h3: "#4FC3F7",
    h4: "#4DD0E1",
    h5: "#4DB6AC",
    h6: "#81C784",
  },
  gradient: {
    h1: "#667EEA",
    h2: "#7E57C2",
    h3: "#AB47BC",
    h4: "#EC407A",
    h5: "#EF5350",
    h6: "#FF7043",
  },
}

// 应用风格
function applyStyle() {
  if (selectedStyle.value !== "custom" && styles[selectedStyle.value]) {
    headingColors.value = { ...styles[selectedStyle.value] }
    onColorChange()
  }
}

// 统一的设置变更处理函数
function handleSettingsChange() {
  applyToDocument()
  autoSave()
}

// 颜色变化时检测是否为自定义
function onColorChange() {
  let isCustom = true
  for (const [styleName, styleColors] of Object.entries(styles)) {
    const matches = Object.entries(styleColors).every(
      ([key, value]) =>
        headingColors.value[key as keyof HeadingColors].toUpperCase()
        === value.toUpperCase(),
    )
    if (matches) {
      selectedStyle.value = styleName
      isCustom = false
      break
    }
  }
  if (isCustom) {
    selectedStyle.value = "custom"
  }
  emit("change", headingColors.value)
  handleSettingsChange()
}

// 应用到文档
function applyToDocument() {
  let style = document.getElementById(
    "heading-colors-style",
  ) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement("style")
    style.id = "heading-colors-style"
    document.head.appendChild(style)
  }

  // 颜色和字体大小样式合并生成
  const headingStyles = Object.entries(headingColors.value)
    .map(([level, color]) => {
      const size = headingSizes.value[level as keyof HeadingSizes]
      return `
        .protyle-wysiwyg [data-node-id].${level},
        .protyle-wysiwyg .${level},
        .b3-typography .${level} {
          color: ${color} !important;
          font-size: ${size}px !important;
        }
      `
    })
    .join("\n")

  // 层级显示样式
  const levelCss =
    levelDisplayStyle.value !== "none"
      ? generateLevelDisplayCss(levelDisplayStyle.value, customLevelMarkers.value)
      : ""

  // 文档标题样式（合并居中、颜色、字体大小）
  const titleStyles = `
    .protyle-title__input {
      ${titleCenterAlign.value ? "text-align: center !important;" : ""}
      ${titleColor.value ? `color: ${titleColor.value} !important;` : ""}
      font-size: ${titleFontSize.value}px !important;
    }
  `

  style.textContent = `${headingStyles}\n${levelCss}\n${titleStyles}`
}

// 应用层级显示
function applyLevelDisplay() {
  handleSettingsChange()
}

// 应用标题居中
function applyTitleCenterAlign() {
  handleSettingsChange()
}

// 标题颜色变化处理
function onTitleColorChange() {
  handleSettingsChange()
}

// 标题字体大小变化处理
function onTitleFontSizeChange() {
  handleSettingsChange()
}

// H1-H6 标题字体大小变化处理
function onFontSizeChange() {
  handleSettingsChange()
}

// 重置标题颜色
function resetTitleColor() {
  titleColor.value = defaultTitleColor
  handleSettingsChange()
}

// 自动保存设置
async function autoSave() {
  if (!props.plugin) return

  try {
    const settingsToSave = {
      style: selectedStyle.value,
      colors: headingColors.value,
      fontSizes: headingSizes.value,
      levelDisplay: levelDisplayStyle.value,
      customMarkers: customLevelMarkers.value,
      titleCenterAlign: titleCenterAlign.value,
      titleColor: titleColor.value,
      titleFontSize: titleFontSize.value,
    }

    await storage.value!.heading.save(settingsToSave)
  } catch (error) {
    console.error("保存失败:", error)
  }
}

// 加载保存的设置
async function loadSettings() {
  if (!props.plugin) {
    console.warn("插件实例不可用，使用默认设置")
    return
  }

  try {
    const settings = await storage.value!.loadHeadingOrDefault()

    selectedStyle.value = (settings as any).style || "default"
    headingColors.value = {
      ...styles.default,
      ...settings.colors,
    }
    headingSizes.value = {
      ...props.initialFontSizes,
      ...settings.fontSizes,
    }
    levelDisplayStyle.value = settings.levelDisplay || "none"
    customLevelMarkers.value = settings.customMarkers || [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]
    titleCenterAlign.value = settings.titleCenterAlign ?? false
    titleColor.value = settings.titleColor || defaultTitleColor
    titleFontSize.value = settings.titleFontSize || 24
  } catch (error) {
    console.error("加载设置失败:", error)
  }
}

// 初始化 - 仅加载设置填充表单（样式由 GeneralSettings.init() 在插件启动时应用）
onMounted(async () => {
  if (props.plugin) {
    storage.value = new GeneralSettingsStorage(props.plugin)
  }
  await loadSettings()
})

// 监听颜色变化，自动保存
watch(
  headingColors,
  (newColors) => {
    emit("change", newColors)
    autoSave()
  },
  { deep: true },
)

// 监听风格变化,自动保存
watch(selectedStyle, autoSave)

// 监听层级显示变化
watch(levelDisplayStyle, handleSettingsChange)

// 监听标题居中变化
watch(titleCenterAlign, handleSettingsChange)

// 监听标题颜色变化
watch(titleColor, () => {
  if (titleCenterAlign.value) {
    handleSettingsChange()
  } else {
    autoSave()
  }
})

// 监听字体大小变化
watch(headingSizes, handleSettingsChange, { deep: true })

// 监听标题字体大小变化
watch(titleFontSize, handleSettingsChange)

// 暴露方法
defineExpose({
  loadSettings,
  headingColors,
  selectedStyle,
})
</script>

<style scoped lang="scss">
@use "../styles/HeadingSettings.scss";
</style>
