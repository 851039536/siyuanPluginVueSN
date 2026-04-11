<template>
  <div class="heading-settings">
    <div class="settings-container">
      <!-- 风格选择 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🎨</span>
            {{ i18n.headingStyle || '标题风格' }}
          </label>
          <select v-model="selectedStyle" class="style-select" @change="applyStyle">
            <option value="default">{{ i18n.defaultHeadingStyle || '默认风格' }}</option>
            <option value="github">{{ i18n.githubStyle || 'GitHub 风格' }}</option>
            <option value="mac">{{ i18n.macStyle || 'Mac 风格' }}</option>
            <option value="cartoon">{{ i18n.cartoonStyle || '卡通风格' }}</option>
            <option value="rainbow">{{ i18n.rainbowStyle || '彩虹风格' }}</option>
            <option value="monochrome">{{ i18n.monochromeStyle || '单色风格' }}</option>
            <option value="warm">{{ i18n.warmStyle || '暖色风格' }}</option>
            <option value="cool">{{ i18n.coolStyle || '冷色风格' }}</option>
            <option value="gradient">{{ i18n.gradientStyle || '渐变风格' }}</option>
            <option value="custom">{{ i18n.customStyle || '自定义' }}</option>
          </select>
        </div>
      </div>

      <!-- 标题层级显示设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🔢</span>
            {{ i18n.headingLevelDisplay || '标题层级显示' }}
          </label>
          <select v-model="levelDisplayStyle" class="style-select" @change="applyLevelDisplay">
            <option value="none">{{ i18n.levelDisplayNone || '不显示' }}</option>
            <option value="number">{{ i18n.levelDisplayNumber || '数字标记 (1-6)' }}</option>
            <option value="roman">{{ i18n.levelDisplayRoman || '罗马数字 (I-VI)' }}</option>
            <option value="chinese">{{ i18n.levelDisplayChinese || '中文数字 (一-六)' }}</option>
            <option value="chineseUpper">{{ i18n.levelDisplayChineseUpper || '中文大写 (壹-陆)' }}</option>
            <option value="dots">{{ i18n.levelDisplayDots || '圆点标记 (•)' }}</option>
            <option value="emoji">{{ i18n.levelDisplayEmoji || '表情符号 (😀-😎)' }}</option>
            <option value="star">{{ i18n.levelDisplayStar || '星级标记 (⭐)' }}</option>
            <option value="arrow">{{ i18n.levelDisplayArrow || '箭头标记 (→)' }}</option>
            <option value="tag">{{ i18n.levelDisplayTag || '标签样式 (H1-H6)' }}</option>
            <option value="bracket">{{ i18n.levelDisplayBracket || '括号标记 [1-6]' }}</option>
            <option value="custom">{{ i18n.levelDisplayCustom || '自定义...' }}</option>
          </select>
          <div v-if="levelDisplayStyle !== 'none'" class="level-display-hint">
            <span class="hint-icon">ℹ️</span>
            <span class="hint-text">{{ i18n.levelDisplayHint || '注意:第三方主题可能会影响显示效果' }}</span>
          </div>
        </div>
      </div>

      <!-- 标题居中设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">↔️</span>
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
      <div v-if="titleCenterAlign" class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🎨</span>
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
            <span class="label-icon">📏</span>
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
      <div v-if="levelDisplayStyle === 'custom'" class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">✏️</span>
            {{ i18n.customLevelMarkers || '自定义标记' }}
          </label>
          <div class="custom-level-inputs">
            <div v-for="level in 6" :key="level" class="custom-level-item">
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
            <span class="label-icon">📏</span>
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
            <span class="label-icon">🎨</span>
            {{ i18n.headingColors || '标题颜色' }}
          </label>
          <div class="heading-colors">
            <div v-for="level in 6" :key="level" class="color-item-compact">
              <span class="heading-badge" :class="`heading-badge-h${level}`">H{{ level }}</span>
              <input
                v-model="headingColors[`h${level}`]"
                type="color"
                class="color-picker-mini"
                @change="onColorChange"
              />
              <input
                v-model="headingColors[`h${level}`]"
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
import { ref, watch, onMounted } from "vue";
import { saveHeadingSettings, loadHeadingSettings } from "@/config/settings";

interface HeadingColors {
	h1: string;
	h2: string;
	h3: string;
	h4: string;
	h5: string;
	h6: string;
}

interface HeadingSizes {
	h1: number;
	h2: number;
	h3: number;
	h4: number;
	h5: number;
	h6: number;
}

interface Props {
	i18n?: any;
	plugin?: any;
	initialSettings?: HeadingColors;
	initialFontSizes?: HeadingSizes;
}

interface Emits {
	(e: "change", settings: HeadingColors): void;
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
});

const emit = defineEmits<Emits>();

const selectedStyle = ref("default");
const headingColors = ref<HeadingColors>({ ...props.initialSettings });
const levelDisplayStyle = ref("none");
const customLevelMarkers = ref<string[]>(["1", "2", "3", "4", "5", "6"]);
const titleCenterAlign = ref(false);
const titleColor = ref("#2C3E50");
const defaultTitleColor = "#2C3E50";
const headingSizes = ref<HeadingSizes>({ ...props.initialFontSizes });
const titleFontSize = ref(24);

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
};

// 应用风格
function applyStyle() {
	if (selectedStyle.value !== "custom" && styles[selectedStyle.value]) {
		headingColors.value = { ...styles[selectedStyle.value] };
		onColorChange();
	}
}

// 统一的设置变更处理函数
function handleSettingsChange() {
	applyToDocument();
	autoSave();
}

// 颜色变化时检测是否为自定义
function onColorChange() {
	let isCustom = true;
	for (const [styleName, styleColors] of Object.entries(styles)) {
		const matches = Object.entries(styleColors).every(
			([key, value]) =>
				headingColors.value[key as keyof HeadingColors].toUpperCase() ===
				value.toUpperCase(),
		);
		if (matches) {
			selectedStyle.value = styleName;
			isCustom = false;
			break;
		}
	}
	if (isCustom) {
		selectedStyle.value = "custom";
	}
	emit("change", headingColors.value);
	handleSettingsChange();
}

// 应用到文档
function applyToDocument() {
	let style = document.getElementById(
		"heading-colors-style",
	) as HTMLStyleElement | null;
	if (!style) {
		style = document.createElement("style");
		style.id = "heading-colors-style";
		document.head.appendChild(style);
	}

	// 颜色和字体大小样式合并生成
	const headingStyles = Object.entries(headingColors.value)
		.map(([level, color]) => {
			const size = headingSizes.value[level as keyof HeadingSizes];
			return `
        .protyle-wysiwyg [data-node-id].${level},
        .protyle-wysiwyg .${level},
        .b3-typography .${level} {
          color: ${color} !important;
          font-size: ${size}px !important;
        }
      `;
		})
		.join("\n");

	// 层级显示样式
	const levelCss =
		levelDisplayStyle.value !== "none"
			? generateLevelDisplayCss(levelDisplayStyle.value)
			: "";

	// 文档标题样式（合并居中、颜色、字体大小）
	const titleStyles = `
    .protyle-title__input {
      ${titleCenterAlign.value ? "text-align: center !important;" : ""}
      ${titleColor.value ? `color: ${titleColor.value} !important;` : ""}
      font-size: ${titleFontSize.value}px !important;
    }
  `;

	style.textContent = headingStyles + "\n" + levelCss + "\n" + titleStyles;
}

// 生成层级显示 CSS
function generateLevelDisplayCss(style: string): string {
	const levelMappings: Record<string, string[]> = {
		number: ["1", "2", "3", "4", "5", "6"],
		roman: ["I", "II", "III", "IV", "V", "VI"],
		chinese: ["一", "二", "三", "四", "五", "六"],
		chineseUpper: ["壹", "贰", "叁", "肆", "伍", "陆"],
		dots: ["•", "••", "•••", "••••", "•••••", "••••••"],
		emoji: ["😀", "😁", "😂", "🤣", "😊", "😎"],
		star: ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐", "⭐⭐⭐⭐⭐⭐"],
		arrow: ["→", "→→", "→→→", "→→→→", "→→→→→", "→→→→→→"],
		tag: ["H1", "H2", "H3", "H4", "H5", "H6"],
		bracket: ["[1]", "[2]", "[3]", "[4]", "[5]", "[6]"],
		custom: customLevelMarkers.value,
	};

	const levels = levelMappings[style] || levelMappings.number;

	return levels
		.map((label, index) => {
			const level = index + 1;
			const tagStyles =
				style === "tag"
					? "background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; opacity: 0.7;"
					: "";

			return `
      .protyle-wysiwyg div[data-subtype="h${level}"][data-node-id]:not([type]) > div[contenteditable]:first-child::after,
      .protyle-wysiwyg div[data-subtype="h${level}"][data-node-id] > div.h${level}[contenteditable]::after {
        content: "  ${label}";
        font-size: 0.7em;
        opacity: 0.4;
        margin-left: 6px;
        vertical-align: middle;
        ${tagStyles}
      }
    `;
		})
		.join("\n");
}

// 应用层级显示
function applyLevelDisplay() {
	handleSettingsChange();
}

// 应用标题居中
function applyTitleCenterAlign() {
	handleSettingsChange();
}

// 标题颜色变化处理
function onTitleColorChange() {
	handleSettingsChange();
}

// 标题字体大小变化处理
function onTitleFontSizeChange() {
	handleSettingsChange();
}

// H1-H6 标题字体大小变化处理
function onFontSizeChange() {
	handleSettingsChange();
}

// 重置标题颜色
function resetTitleColor() {
	titleColor.value = defaultTitleColor;
	handleSettingsChange();
}

// 自动保存设置
async function autoSave() {
	if (!props.plugin) return;

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
		};

		await saveHeadingSettings(props.plugin, settingsToSave);
	} catch (error) {
		console.error("保存失败:", error);
	}
}

// 加载保存的设置
async function loadSettings() {
	if (!props.plugin) {
		console.warn("插件实例不可用，使用默认设置");
		return;
	}

	try {
		// 使用插件的数据存储 API
		const settings = await loadHeadingSettings(props.plugin);

		selectedStyle.value = settings.style || "default";
		headingColors.value = { ...styles.default, ...settings.colors };
		headingSizes.value = { ...props.initialFontSizes, ...settings.fontSizes };
		levelDisplayStyle.value = settings.levelDisplay || "none";
		customLevelMarkers.value = settings.customMarkers || [
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
		];
		titleCenterAlign.value = settings.titleCenterAlign ?? false;
		titleColor.value = settings.titleColor || defaultTitleColor;
		titleFontSize.value = settings.titleFontSize || 24;
	} catch (error) {
		console.error("加载设置失败:", error);
	}
}

// 初始化 - 在组件挂载后执行
onMounted(async () => {
	await loadSettings();
	applyToDocument();
});

// 监听颜色变化，自动保存
watch(
	headingColors,
	(newColors) => {
		emit("change", newColors);
		autoSave();
	},
	{ deep: true },
);

// 监听风格变化,自动保存
watch(selectedStyle, autoSave);

// 监听层级显示变化
watch(levelDisplayStyle, handleSettingsChange);

// 监听标题居中变化
watch(titleCenterAlign, handleSettingsChange);

// 监听标题颜色变化
watch(titleColor, (newValue) => {
	if (titleCenterAlign.value) {
		handleSettingsChange();
	} else {
		autoSave();
	}
});

// 监听字体大小变化
watch(headingSizes, handleSettingsChange, { deep: true });

// 监听标题字体大小变化
watch(titleFontSize, handleSettingsChange);

// 暴露方法
defineExpose({
	loadSettings,
	headingColors,
	selectedStyle,
});
</script>

<style scoped>
.heading-settings {
  padding: 12px;
  box-sizing: border-box;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 100%;
}

/* 设置行样式 */
.setting-row {
  display: flex;
  width: 100%;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin: 0;
}

.label-icon {
  font-size: 14px;
  opacity: 0.8;
}

.setting-value {
  margin-left: auto;
  padding: 2px 8px;
  background: var(--b3-theme-surface-variant);
  color: var(--b3-theme-on-surface-variant);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  min-width: 45px;
  text-align: center;
}

.style-select {
  padding: 8px 12px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.style-select:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb), 0.1);
}

/* 标题颜色设置 - 3列紧凑布局 */
.heading-colors {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 4px;
}

.color-item-compact {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: var(--b3-theme-surface-variant);
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(var(--b3-theme-primary-rgb), 0.08);
  }
}

.heading-badge {
  min-width: 32px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--b3-theme-on-primary);
  flex-shrink: 0;
}

/* H1-H6徽章颜色 */
.heading-badge-h1 { background: linear-gradient(135deg, #F39A94, #E57373); }
.heading-badge-h2 { background: linear-gradient(135deg, #F8D694, #FFB74D); }
.heading-badge-h3 { background: linear-gradient(135deg, #B1DCB9, #81C784); }
.heading-badge-h4 { background: linear-gradient(135deg, #AAD2FC, #64B5F6); }
.heading-badge-h5 { background: linear-gradient(135deg, #AC9DC0, #9575CD); }
.heading-badge-h6 { background: linear-gradient(135deg, #D7D7D7, #9E9E9E); }

.color-picker-mini {
  width: 36px;
  height: 28px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  flex-shrink: 0;

  &:hover {
    border-color: var(--b3-theme-primary);
  }
}

.color-text-mini {
  flex: 1;
  min-width: 60px;
  padding: 4px 8px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
  }
}

/* 颜色输入组 - 统一样式 */
.color-input-group,
.title-color-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.title-color-input-group {
  flex-wrap: wrap;
  gap: 10px;
}

/* 颜色选择器 - 统一样式 */
.color-picker,
.title-color-picker {
  width: 48px;
  height: 36px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
}

.color-picker:hover,
.title-color-picker:hover {
  border-color: var(--b3-theme-primary);
}

/* 颜色文本输入 - 统一样式 */
.color-text,
.title-color-text {
  flex: 1;
  min-width: 100px;
  padding: 6px 10px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  text-transform: uppercase;
  transition: all 0.2s ease;
}

.color-text:focus,
.title-color-text:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb), 0.1);
}

/* 层级显示提示 */
.level-display-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 6px 10px;
  background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08);
  border-left: 3px solid var(--b3-theme-primary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
}

.hint-icon {
  font-size: 14px;
  opacity: 0.8;
}

.hint-text {
  flex: 1;
  line-height: 1.4;
}

/* 自定义层级标记输入 */
.custom-level-inputs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.custom-level-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-level-label {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 28px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
}

.custom-level-input {
  flex: 1;
  padding: 6px 10px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  transition: all 0.2s ease;
}

.custom-level-input:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.custom-level-input::placeholder {
  color: var(--b3-theme-on-surface-variant);
  opacity: 0.5;
}



/* 响应式设计 */
@media (max-width: 400px) {
  .heading-settings {
    padding: 12px;
  }

  .heading-colors {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 320px) {
  .heading-colors {
    grid-template-columns: 1fr;
  }
}

/* 标题居中设置样式 */
.toggle-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toggle-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.toggle-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  user-select: none;
}

/* 文档标题颜色设置样式 - 已合并到上方的统一样式 */

.reset-color-btn {
  padding: 6px 12px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.reset-color-btn:hover {
  border-color: var(--b3-theme-primary);
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

/* 字体大小文本标签 */
.font-size-text {
  flex: 1;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

/* 标题图标(H1-H6) - 用于2列紧凑布局 */
.heading-icon-h1,
.heading-icon-h2,
.heading-icon-h3,
.heading-icon-h4,
.heading-icon-h5,
.heading-icon-h6 {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 24px;
  color: var(--b3-theme-on-primary);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

/* H1-H6特定的微调（保持视觉区分） */
.heading-icon-h1 { background: linear-gradient(135deg, #F39A94, #E57373); }
.heading-icon-h2 { background: linear-gradient(135deg, #F8D694, #FFB74D); }
.heading-icon-h3 { background: linear-gradient(135deg, #B1DCB9, #81C784); }
.heading-icon-h4 { background: linear-gradient(135deg, #AAD2FC, #64B5F6); }
.heading-icon-h5 { background: linear-gradient(135deg, #AC9DC0, #9575CD); }
.heading-icon-h6 { background: linear-gradient(135deg, #D7D7D7, #9E9E9E); }

/* 2列布局样式 - 更紧凑的显示 */
.font-size-grid-2col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
  padding-left: 8px;
  border-left: 2px solid var(--b3-theme-surface-variant);
}

.font-size-row {
  display: flex;
  gap: 12px;
  padding: 8px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-outline);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.font-size-row:hover {
  border-color: var(--b3-theme-primary);
  background: rgba(var(--b3-theme-primary-rgb), 0.03);
}

.font-size-item-horizontal {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: var(--b3-theme-surface-variant);
  border-radius: 4px;
  min-width: 0;
}

.font-size-label-horizontal {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  margin: 0;
}

/* 微型标题图标 - 用于紧凑布局 */
.heading-icon-mini {
  width: 24px;
  height: 20px;
  font-size: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* 直接输入框样式 - 通用样式定义 */
.input-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.input-group-horizontal {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

/* 数字输入框 - 基础样式，支持两种尺寸 */
.number-input,
.number-input-mini {
  padding: 8px 12px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-weight: 600;
  text-align: center;
  transition: all 0.2s ease;
}

.number-input {
  width: 80px;
  font-size: 13px;
}

.number-input-mini {
  flex: 1;
  min-width: 48px;
  width: 100%;
  padding: 4px 6px;
  border-width: 1px;
  border-radius: 4px;
  font-size: 12px;
}

/* 统一的输入框焦点和悬停状态 */
.number-input:focus,
.number-input-mini:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.number-input:hover,
.number-input-mini:hover {
  border-color: var(--b3-theme-primary);
}

.number-input::-webkit-inner-spin-button,
.number-input::-webkit-outer-spin-button,
.number-input-mini::-webkit-inner-spin-button,
.number-input-mini::-webkit-outer-spin-button {
  opacity: 1;
}

/* 单位标签 - 支持两种尺寸 */
.unit-label,
.unit-label-mini {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-radius: 4px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.unit-label {
  padding: 4px 8px;
  font-size: 11px;
  min-width: 24px;
}

.unit-label-mini {
  padding: 2px 6px;
  font-size: 10px;
  min-width: 20px;
  border-radius: 3px;
}

/* 提示信息 */
.input-range-hint {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08);
  border-left: 3px solid var(--b3-theme-primary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  margin-top: 4px;
}

/* 响应式调整 - 移动端适配 */
@media (max-width: 768px) {
  /* 增大移动端触控区域 (符合iOS/Android规范: 最小44px) */
  .number-input,
  .number-input-mini {
    min-height: 44px;
  }

  /* 确保单位标签有足够大小 */
  .unit-label-mini {
    min-width: 24px;
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  /* 文档标题输入框 - 适应小屏幕 */
  .number-input {
    width: 70px;
    padding: 6px 8px;
    min-height: 40px;
  }

  /* 2列布局响应式 - 在小屏幕上变为垂直堆叠 */
  .font-size-row {
    flex-direction: column;
    gap: 8px;
  }

  .font-size-item-horizontal {
    width: 100%;
  }

  .font-size-grid-2col {
    padding-left: 4px;
    gap: 6px;
  }

  /* 紧凑输入框在小屏幕调整 */
  .number-input-mini {
    min-height: 38px;
    padding: 4px 6px;
    flex: 1;
  }

  /* 调整内部元素间距 */
  .font-size-item-horizontal {
    padding: 4px;
  }

  .font-size-label-horizontal {
    gap: 4px;
    font-size: 11px;
  }

  .heading-icon-mini {
    width: 20px;
    height: 18px;
    font-size: 9px;
  }

  .input-group-horizontal {
    gap: 2px;
  }
}

@media (max-width: 360px) {
  /* 超小屏幕优化 */
  .font-size-row {
    gap: 6px;
  }

  .font-size-item-horizontal {
    gap: 2px;
  }

  .number-input-mini {
    min-width: 42px;
    font-size: 11px;
  }

  .unit-label-mini {
    min-width: 18px;
    font-size: 9px;
    padding: 2px 4px;
  }
}

</style>
