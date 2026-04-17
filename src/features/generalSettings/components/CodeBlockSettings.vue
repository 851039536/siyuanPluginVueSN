<template>
  <div class="codeblock-settings">
    <div class="settings-container">
      <!-- 启用代码块样式增强 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">✨</span>
            {{ i18n.enableCodeBlockStyle || '启用代码块样式增强' }}
          </label>
          <div class="toggle-container">
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="settings.enabled"
                class="toggle-input"
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-description">
              {{ settings.enabled ? (i18n.enabled || '已启用') : (i18n.disabled || '已禁用') }}
            </span>
          </div>
        </div>
      </div>

      <!-- 代码块风格选择 -->
      <div v-if="settings.enabled" class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🎨</span>
            {{ i18n.codeBlockStyle || '代码块风格' }}
          </label>
          <!-- 风格卡片选择器 -->
          <div class="style-cards">
            <div
              v-for="style in (['default', 'github', 'mac', 'cartoon'] as const)"
              :key="style"
              :class="['style-card', { active: settings.style === style }]"
              @click="settings.style = style as 'default' | 'github' | 'mac' | 'cartoon'"
            >
              <div class="style-card-icon">
                <span v-if="style === 'default'">📄</span>
                <span v-if="style === 'github'">🐙</span>
                <span v-if="style === 'mac'">🍎</span>
                <span v-if="style === 'cartoon'">🎨</span>
              </div>
              <div class="style-card-name">{{ getStyleName(style) }}</div>
              <div v-if="settings.style === style" class="style-card-check">✓</div>
            </div>
          </div>
        </div>
      </div>
      <!-- 高级设置 -->
      <div v-if="settings.enabled" class="advanced-settings">
        <div class="setting-header">
          <span class="label-icon">⚙️</span>
          <span>{{ i18n.advancedSettings || '高级设置' }}</span>
        </div>

        <!-- 背景色 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🖼️</span>
            {{ i18n.codeBlockBackground || '背景色' }}
          </label>
          <div class="color-picker-container">
            <input
              v-model="settings.backgroundColor"
              type="color"
              class="color-picker"
            />
            <input
              v-model="settings.backgroundColor"
              type="text"
              class="color-input"
              :placeholder="i18n.colorPlaceholder || '输入颜色值'"
            />
          </div>
        </div>

        <!-- 边框设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🔲</span>
            {{ i18n.codeBlockBorder || '边框设置' }}
          </label>
          <div class="border-settings">
            <div class="border-row">
              <label>{{ i18n.borderColor || '边框颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.borderColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.borderColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="border-row">
              <label>{{ i18n.borderWidth || '边框宽度' }}</label>
              <div class="slider-container small">
                <button class="slider-btn" @click="adjustValue('borderWidth', -0.5, 0, 5)">−</button>
                <input
                  v-model.number="settings.borderWidth"
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  class="range-slider"
                />
                <button class="slider-btn" @click="adjustValue('borderWidth', 0.5, 0, 5)">+</button>
                <span class="slider-value">{{ settings.borderWidth }}px</span>
              </div>
            </div>
            <div class="border-row">
              <label>{{ i18n.borderRadius || '圆角' }}</label>
              <div class="slider-container small">
                <button class="slider-btn" @click="adjustValue('borderRadius', -1, 0, 20)">−</button>
                <input
                  v-model.number="settings.borderRadius"
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  class="range-slider"
                />
                <button class="slider-btn" @click="adjustValue('borderRadius', 1, 0, 20)">+</button>
                <span class="slider-value">{{ settings.borderRadius }}px</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 阴影 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🌓</span>
            {{ i18n.codeBlockShadow || '阴影' }}
          </label>
          <div class="shadow-options">
            <button
              v-for="shadow in shadowOptions"
              :key="shadow.value"
              :class="['shadow-btn', { active: settings.boxShadow === shadow.value }]"
              @click="settings.boxShadow = shadow.value"
            >
              {{ shadow.label }}
            </button>
          </div>
        </div>

        <!-- 代码字体设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🔤</span>
            {{ i18n.codeFontSettings || '代码字体' }}
          </label>
          <div class="font-settings">
            <div class="font-row">
              <label>{{ i18n.fontFamily || '字体族' }}</label>
              <div class="input-group">
                <input
                  v-model="settings.codeFontFamily"
                  type="text"
                  class="text-input font-input"
                  :placeholder="i18n.fontFamilyPlaceholder || '输入字体名称'"
                />
                <select v-model="presetCodeFont" class="font-select" @change="applyPresetCodeFont">
                  <option value="">{{ i18n.selectFont || '选择字体' }}</option>
                  <option value="Consolas">Consolas</option>
                  <option value="Monaco">Monaco</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Fira Code">Fira Code</option>
                  <option value="Source Code Pro">Source Code Pro</option>
                  <option value="JetBrains Mono">JetBrains Mono</option>
                </select>
              </div>
            </div>
            <div class="font-row">
              <label>{{ i18n.fontSize || '字体大小' }}</label>
              <div class="slider-container small">
                <button class="slider-btn" @click="adjustValue('codeFontSize', -1, 10, 20)">−</button>
                <input
                  v-model.number="settings.codeFontSize"
                  type="range"
                  min="10"
                  max="20"
                  step="1"
                  class="range-slider"
                />
                <button class="slider-btn" @click="adjustValue('codeFontSize', 1, 10, 20)">+</button>
                <span class="slider-value">{{ settings.codeFontSize }}px</span>
              </div>
            </div>
            <div class="font-row">
              <label>{{ i18n.lineHeight || '行高' }}</label>
              <div class="slider-container small">
                <button class="slider-btn" @click="adjustValue('codeLineHeight', -0.1, 1.2, 2.0)">−</button>
                <input
                  v-model.number="settings.codeLineHeight"
                  type="range"
                  min="1.2"
                  max="2.0"
                  step="0.1"
                  class="range-slider"
                />
                <button class="slider-btn" @click="adjustValue('codeLineHeight', 0.1, 1.2, 2.0)">+</button>
                <span class="slider-value">{{ settings.codeLineHeight }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 代码颜色设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🎨</span>
            {{ i18n.codeColorSettings || '代码颜色' }}
          </label>
          <div class="color-settings">
            <div class="color-row">
              <label>{{ i18n.textColor || '文本颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.textColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.textColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="color-row">
              <label>{{ i18n.keywordColor || '关键字颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.keywordColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.keywordColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="color-row">
              <label>{{ i18n.stringColor || '字符串颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.stringColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.stringColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="color-row">
              <label>{{ i18n.commentColor || '注释颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.commentColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.commentColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="color-row">
              <label>{{ i18n.functionColor || '函数颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.functionColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.functionColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="color-row">
              <label>{{ i18n.numberColor || '数字颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.numberColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.numberColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 代码块折叠设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">📦</span>
            {{ i18n.codeBlockCollapse || '代码块折叠' }}
          </label>
          <div class="toggle-container">
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="settings.enableCollapse"
                class="toggle-input"
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-description">
              {{ settings.enableCollapse ? (i18n.collapseEnabled || '已启用') : (i18n.collapseDisabled || '已禁用') }}
            </span>
          </div>
        </div>
        <!-- 折叠高度设置 -->
        <div v-if="settings.enableCollapse" class="setting-item">
          <label class="setting-label">
            <span class="label-icon">📏</span>
            {{ i18n.collapseHeight || '折叠高度' }}
            <span class="setting-value">{{ settings.collapseHeight }}px</span>
          </label>
          <div class="slider-container">
            <div class="slider-row">
              <button class="slider-btn" @click="adjustValue('collapseHeight', -50, 200, 800)">−</button>
              <input
                v-model.number="settings.collapseHeight"
                type="range"
                min="200"
                max="800"
                step="50"
                class="range-slider"
              />
              <button class="slider-btn" @click="adjustValue('collapseHeight', 50, 200, 800)">+</button>
            </div>
            <div class="slider-labels">
              <span>200px</span>
              <span>800px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import {
	saveCodeBlockSettings,
	loadCodeBlockSettings,
} from "@/config/settings";
import { applyCodeBlockStyle, applyCodeBlockCollapse } from "../types";

interface CodeBlockSettings {
	style: "default" | "github" | "mac" | "cartoon";
	enableCollapse: boolean;
	collapseHeight: number;
	// 样式增强
	enabled: boolean;
	backgroundColor: string;
	borderColor: string;
	borderWidth: number;
	borderRadius: number;
	boxShadow: string;
	// 代码字体
	codeFontFamily: string;
	codeFontSize: number;
	codeLineHeight: number;
	// 代码颜色
	textColor: string;
	keywordColor: string;
	stringColor: string;
	commentColor: string;
	functionColor: string;
	numberColor: string;
}

interface Props {
	i18n?: any;
	plugin?: any;
	initialSettings?: CodeBlockSettings;
}

interface Emits {
	(e: "change", settings: CodeBlockSettings): void;
}

const props = withDefaults(defineProps<Props>(), {
	i18n: () => ({}),
	plugin: null,
	initialSettings: () => ({
		style: "default",
		enableCollapse: true,
		collapseHeight: 400,
		enabled: false,
		backgroundColor: "#282c34",
		borderColor: "#3e4451",
		borderWidth: 1,
		borderRadius: 6,
		boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
		codeFontFamily: "Consolas",
		codeFontSize: 14,
		codeLineHeight: 1.6,
		textColor: "#abb2bf",
		keywordColor: "#c678dd",
		stringColor: "#98c379",
		commentColor: "#5c6370",
		functionColor: "#61afef",
		numberColor: "#d19a66",
	}),
});

const DEFAULT_SETTINGS: CodeBlockSettings = {
	style: "default",
	enableCollapse: true,
	collapseHeight: 400,
	enabled: false,
	backgroundColor: "#282c34",
	borderColor: "#3e4451",
	borderWidth: 1,
	borderRadius: 6,
	boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
	codeFontFamily: "Consolas",
	codeFontSize: 14,
	codeLineHeight: 1.6,
	textColor: "#abb2bf",
	keywordColor: "#c678dd",
	stringColor: "#98c379",
	commentColor: "#5c6370",
	functionColor: "#61afef",
	numberColor: "#d19a66",
};

const emit = defineEmits<Emits>();

const settings = ref<CodeBlockSettings>({ ...props.initialSettings });
const presetCodeFont = ref("");

const shadowOptions = [
	{ label: props.i18n.noneShadow || "无阴影", value: "none" },
	{
		label: props.i18n.lightShadow || "轻阴影",
		value: "0 2px 8px rgba(0, 0, 0, 0.1)",
	},
	{
		label: props.i18n.mediumShadow || "中阴影",
		value: "0 4px 12px rgba(0, 0, 0, 0.15)",
	},
	{
		label: props.i18n.heavyShadow || "重阴影",
		value: "0 8px 24px rgba(0, 0, 0, 0.2)",
	},
];

watch(
	settings,
	async (newSettings) => {
		emit("change", newSettings);
		applyCodeBlockStyle(newSettings.style);
		applyCodeBlockCollapse(
			newSettings.enableCollapse,
			newSettings.collapseHeight,
		);
		if (newSettings.enabled) {
			applyCodeBlockEnhancedStyles(newSettings);
		} else {
			// 移除增强样式
			const existingStyle = document.getElementById("codeblock-enhanced-style");
			if (existingStyle) {
				existingStyle.remove();
			}
		}
		if (props.plugin) {
			try {
				await saveCodeBlockSettings(props.plugin, newSettings);
			} catch (error) {
				console.error("自动保存失败:", error);
			}
		}
	},
	{ deep: true, immediate: false },
);

function applyPresetCodeFont() {
	if (presetCodeFont.value) {
		settings.value.codeFontFamily = presetCodeFont.value;
	}
}

function adjustValue(
	key: keyof CodeBlockSettings,
	delta: number,
	min: number,
	max: number,
) {
	const currentValue = settings.value[key] as number;
	const newValue = Math.max(min, Math.min(max, currentValue + delta));
	(settings.value as Record<string, unknown>)[key] = newValue;
}

function applyCodeBlockEnhancedStyles(codeSettings: CodeBlockSettings) {
	try {
		// 移除现有样式
		const existingStyle = document.getElementById("codeblock-enhanced-style");
		if (existingStyle) {
			existingStyle.remove();
		}

		// 创建新的样式元素
		const style = document.createElement("style");
		style.id = "codeblock-enhanced-style";

		style.textContent = `
      /* 代码块基础样式 */
      .protyle-wysiwyg .code-block {
        background-color: ${codeSettings.backgroundColor} !important;
        border: ${codeSettings.borderWidth}px solid ${codeSettings.borderColor} !important;
        border-radius: ${codeSettings.borderRadius}px !important;
        box-shadow: ${codeSettings.boxShadow} !important;
      }

      /* 代码块内容 */
      .protyle-wysiwyg .code-block .hljs {
        font-family: '${codeSettings.codeFontFamily}', monospace !important;
        font-size: ${codeSettings.codeFontSize}px !important;
        line-height: ${codeSettings.codeLineHeight} !important;
        color: ${codeSettings.textColor} !important;
      }

      /* 代码高亮颜色 */
      .protyle-wysiwyg .code-block .hljs-keyword,
      .protyle-wysiwyg .code-block .hljs-selector-tag,
      .protyle-wysiwyg .code-block .hljs-built_in,
      .protyle-wysiwyg .code-block .hljs-name,
      .protyle-wysiwyg .code-block .hljs-tag {
        color: ${codeSettings.keywordColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-string,
      .protyle-wysiwyg .code-block .hljs-title,
      .protyle-wysiwyg .code-block .hljs-section,
      .protyle-wysiwyg .code-block .hljs-attribute,
      .protyle-wysiwyg .code-block .hljs-literal,
      .protyle-wysiwyg .code-block .hljs-template-tag,
      .protyle-wysiwyg .code-block .hljs-template-variable,
      .protyle-wysiwyg .code-block .hljs-type {
        color: ${codeSettings.stringColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-comment,
      .protyle-wysiwyg .code-block .hljs-quote {
        color: ${codeSettings.commentColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-function {
        color: ${codeSettings.functionColor} !important;
      }

      .protyle-wysiwyg .code-block .hljs-number {
        color: ${codeSettings.numberColor} !important;
      }

      /* 预览区域代码块 */
      .b3-typography pre,
      .b3-typography pre code {
        font-family: '${codeSettings.codeFontFamily}', monospace !important;
        font-size: ${codeSettings.codeFontSize}px !important;
        line-height: ${codeSettings.codeLineHeight} !important;
        background-color: ${codeSettings.backgroundColor} !important;
        border: ${codeSettings.borderWidth}px solid ${codeSettings.borderColor} !important;
        border-radius: ${codeSettings.borderRadius}px !important;
        color: ${codeSettings.textColor} !important;
      }

      /* 暗色主题适配 */
      :root[data-theme-mode="dark"] .protyle-wysiwyg .code-block {
        box-shadow: ${codeSettings.boxShadow !== "none" ? "0 2px 8px rgba(0, 0, 0, 0.3)" : "none"} !important;
      }
    `;

		document.head.appendChild(style);
	} catch (error) {
		console.error("应用代码块增强样式失败:", error);
	}
}

function getStyleName(style: string): string {
	const names: Record<string, string> = {
		default: props.i18n.defaultStyle || "默认风格",
		github: props.i18n.githubStyle || "GitHub 风格",
		mac: props.i18n.macStyle || "Mac 风格",
		cartoon: props.i18n.cartoonStyle || "卡通风格",
	};
	return names[style] || style;
}

// 加载保存的设置
async function loadSettings() {
	if (!props.plugin) {
		console.warn("插件实例不可用，使用默认设置");
		settings.value = { ...DEFAULT_SETTINGS };
		return;
	}

	try {
		const loadedSettings = await loadCodeBlockSettings(props.plugin);
		settings.value = { ...DEFAULT_SETTINGS, ...loadedSettings };
		applyCodeBlockStyle(settings.value.style);
		applyCodeBlockCollapse(
			settings.value.enableCollapse,
			settings.value.collapseHeight,
		);
		if (settings.value.enabled) {
			applyCodeBlockEnhancedStyles(settings.value);
		}
	} catch (error) {
		console.error("加载设置失败:", error);
		settings.value = { ...DEFAULT_SETTINGS };
	}
}

// 初始化时加载设置并应用样式
onMounted(async () => {
	await loadSettings();
});

// 暴露方法
defineExpose({
	loadSettings,
	settings,
});
</script>

<style scoped lang="scss">
@use "./styles/CodeBlockSettings.scss";

</style>
