<template>
  <div class="format-assistant-container">
    <!-- 顶部工具栏 -->
    <div class="fa-toolbar">
      <div class="toolbar-left">
        <h3 class="toolbar-title">
          {{ $t('title') }}
        </h3>
        <div class="option-group">
          <span class="option-label">{{ $t('target') }}</span>
          <button
            v-for="t in targetOptions"
            :key="t.value"
            class="toggle-btn"
            :class="{ active: target === t.value }"
            @click="target = t.value"
          >
            {{ t.label }}
          </button>
        </div>
        <div
          v-if="target === 'wechat'"
          class="option-group"
        >
          <span class="option-label">{{ $t('theme') }}</span>
          <div class="theme-selector">
            <button
              v-for="t in wechatThemes"
              :key="t.value"
              class="theme-btn"
              :class="{ active: wechatTheme === t.value }"
              :title="t.label"
              @click="wechatTheme = t.value"
            >
              <span
                class="theme-dot"
                :style="{ background: t.color }"
              ></span>
              <span class="theme-label">{{ t.label }}</span>
            </button>
          </div>
        </div>
        <div
          v-if="target === 'bilibili'"
          class="option-group"
        >
          <span class="option-label">{{ $t('theme') }}</span>
          <div class="theme-selector">
            <button
              v-for="t in bilibiliThemes"
              :key="t.value"
              class="theme-btn"
              :class="{ active: bilibiliTheme === t.value }"
              :title="t.label"
              @click="bilibiliTheme = t.value"
            >
              <span
                class="theme-dot"
                :style="{ background: t.color }"
              ></span>
              <span class="theme-label">{{ t.label }}</span>
            </button>
          </div>
        </div>
        <div class="option-group">
          <span class="option-label">{{ $t('fontSize') }}</span>
          <select
            v-model.number="fontSize"
            class="size-select"
          >
            <option
              v-for="s in fontSizeOptions"
              :key="s"
              :value="s"
            >{{ s }}px</option>
          </select>
        </div>
        <div class="option-group">
          <span class="option-label">{{ $t('lineHeight') }}</span>
          <select
            v-model.number="lineHeight"
            class="size-select"
          >
            <option
              v-for="l in lineHeightOptions"
              :key="l"
              :value="l"
            >{{ l }}</option>
          </select>
        </div>
        <div class="option-group">
          <label class="checkbox-label">
            <input
              v-model="codeHighlight"
              type="checkbox"
            />
            <span>{{ $t('codeHighlight') }}</span>
          </label>
        </div>
        <div class="option-group">
          <span class="option-label">{{ $t('codeWrap') }}</span>
          <button
            v-for="w in codeWrapOptions"
            :key="w.value"
            class="toggle-btn"
            :class="{ active: codeWrap === w.value }"
            @click="codeWrap = w.value"
          >
            {{ w.label }}
          </button>
        </div>
      </div>
      <div class="toolbar-right">
        <button
          class="action-btn primary"
          @click="convertAndPreview"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <span>{{ $t('convert') }}</span>
        </button>
        <button
          class="action-btn"
          :disabled="!outputHtml"
          @click="copyHtml"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="currentColor"
          >
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
          </svg>
          <span>{{ copyBtnText }}</span>
        </button>
        <button
          class="action-btn close-btn"
          @click="$emit('close')"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="currentColor"
          >
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="fa-main">
      <!-- 左侧：Markdown 输入 -->
      <div class="input-panel">
        <div class="panel-header">
          <span class="panel-title">Markdown</span>
          <span class="char-count">{{ inputMd.length }} {{ $t('chars') }}</span>
        </div>
        <textarea
          v-model="inputMd"
          :placeholder="$t('inputPlaceholder')"
          class="input-textarea"
          @input="onInputChange"
        ></textarea>
      </div>

      <!-- 右侧：预览输出 -->
      <div class="preview-panel">
        <div class="panel-header">
          <span class="panel-title">{{ $t('preview') }}</span>
          <span
            v-if="outputHtml"
            class="char-count"
          >{{ outputHtml.length }} {{ $t('htmlChars') }}</span>
        </div>
        <div class="preview-content">
          <div
            v-if="outputHtml"
            class="preview-wrapper"
            v-html="outputHtml"
          ></div>
          <div
            v-else
            class="preview-empty"
          >
            <svg
              viewBox="0 0 24 24"
              width="48"
              height="48"
              fill="currentColor"
              style="opacity: 0.2;"
            >
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
            <span>{{ $t('previewPlaceholder') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  BilibiliTheme,
  CodeWrapMode,
  FormatAssistantSettings,
  WechatTheme,
} from "./types/storage"
import {
  ref,
  watch,
} from "vue"
import { FormatAssistantStorage } from "./types/storage"
import {
  convertMdToBilibili,
  getBilibiliThemes,
} from "./utils/mdToBilibili"
import {
  convertMdToWechat,
  getWechatThemes,
} from "./utils/mdToWechat"

const props = defineProps<{
  onClose?: () => void
  i18n?: any
  plugin?: Plugin
}>()

defineEmits<{
  close: []
}>()

// 存储管理
const storage = props.plugin ? new FormatAssistantStorage(props.plugin) : null

// 响应式状态
const inputMd = ref("")
const outputHtml = ref("")
const target = ref<"wechat" | "bilibili">("wechat")
const wechatTheme = ref<WechatTheme>("default")
const bilibiliTheme = ref<BilibiliTheme>("default")
const fontSize = ref(15)
const lineHeight = ref(1.75)
const codeHighlight = ref(true)
const codeWrap = ref<CodeWrapMode>("scroll")
const copyBtnText = ref("复制HTML")

// 选项数据
const targetOptions = [
  {
    value: "wechat" as const,
    label: "微信公众号",
  },
  {
    value: "bilibili" as const,
    label: "哔哩哔哩",
  },
]

const fontSizeOptions = [13, 14, 15, 16, 17, 18]
const lineHeightOptions = [1.3, 1.5, 1.6, 1.75, 1.8, 2.0]
const codeWrapOptions: { value: CodeWrapMode, label: string }[] = [
  {
    value: "scroll",
    label: "横向滚动",
  },
  {
    value: "wrap",
    label: "自动换行",
  },
]
const wechatThemes = getWechatThemes()
const bilibiliThemes = getBilibiliThemes()

// 自动转换（带防抖）
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const onInputChange = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    convertAndPreview()
  }, 500)
}

// 转换并预览
const convertAndPreview = async () => {
  if (!inputMd.value.trim()) {
    outputHtml.value = ""
    return
  }

  try {
    if (target.value === "wechat") {
      outputHtml.value = await convertMdToWechat(inputMd.value, {
        theme: wechatTheme.value,
        fontSize: fontSize.value,
        lineHeight: lineHeight.value,
        codeHighlight: codeHighlight.value,
        codeWrap: codeWrap.value,
      })
    } else if (target.value === "bilibili") {
      outputHtml.value = await convertMdToBilibili(inputMd.value, {
        theme: bilibiliTheme.value,
        fontSize: fontSize.value,
        lineHeight: lineHeight.value,
        codeHighlight: codeHighlight.value,
        codeWrap: codeWrap.value,
      })
    }
  } catch (error) {
    console.error("转换失败:", error)
  }
}

// 复制 HTML 到剪贴板
const copyHtml = async () => {
  if (!outputHtml.value) return

  try {
    // 使用 ClipboardItem 写入富文本和纯文本
    const blob = new Blob([outputHtml.value], { type: "text/html" })
    const textBlob = new Blob([outputHtml.value], { type: "text/plain" })
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": blob,
        "text/plain": textBlob,
      }),
    ])
    copyBtnText.value = "已复制!"
    setTimeout(() => {
      copyBtnText.value = "复制HTML"
    }, 2000)
  } catch {
    // 降级方案：仅复制纯文本
    try {
      await navigator.clipboard.writeText(outputHtml.value)
      copyBtnText.value = "已复制!"
      setTimeout(() => {
        copyBtnText.value = "复制HTML"
      }, 2000)
    } catch (fallbackError) {
      console.error("复制失败:", fallbackError)
    }
  }
}

// 加载设置
const loadSettings = async () => {
  if (!storage) return
  try {
    const settings = await storage.settings.loadOrDefault()
    target.value = settings.target
    wechatTheme.value = settings.wechatTheme
    bilibiliTheme.value = settings.bilibiliTheme ?? "default"
    fontSize.value = settings.fontSize
    lineHeight.value = settings.lineHeight
    codeHighlight.value = settings.codeHighlight
    codeWrap.value = settings.codeWrap ?? "scroll"
  } catch (error) {
    console.error("加载设置失败:", error)
  }
}

// 保存设置
const saveSettings = async () => {
  if (!storage) return
  try {
    const settings: FormatAssistantSettings = {
      target: target.value,
      wechatTheme: wechatTheme.value,
      bilibiliTheme: bilibiliTheme.value,
      fontSize: fontSize.value,
      lineHeight: lineHeight.value,
      codeHighlight: codeHighlight.value,
      codeWrap: codeWrap.value,
    }
    await storage.settings.save(settings)
  } catch (error) {
    console.error("保存设置失败:", error)
  }
}

// 设置变更时自动保存并重新转换
watch([target, wechatTheme, bilibiliTheme, fontSize, lineHeight, codeHighlight, codeWrap], () => {
  saveSettings()
  convertAndPreview()
})

// 国际化
const $t = (key: string): string => {
  if (props.i18n?.formatAssistant?.[key]) {
    return props.i18n.formatAssistant[key]
  }
  const translations: Record<string, string> = {
    title: "排版助手",
    target: "目标平台",
    theme: "主题",
    fontSize: "字号",
    lineHeight: "行高",
    codeHighlight: "代码高亮",
    codeWrap: "代码换行",
    convert: "转换",
    chars: "字符",
    htmlChars: "HTML字符",
    preview: "预览",
    inputPlaceholder: "在此输入 Markdown 内容...\n\n支持标题、段落、加粗、斜体、引用、代码块、列表、表格等语法",
    previewPlaceholder: "转换结果将在这里预览",
  }
  return translations[key] || key
}

// 初始化
loadSettings()

// 如果有传入的初始内容，自动填入
if (props.plugin) {
  // 尝试获取当前文档内容
  const initContent = (props.plugin as any).__formatAssistantContent
  if (initContent) {
    inputMd.value = initContent
    convertAndPreview()
  }
}
</script>

<!-- 样式已分离至 styles/index.scss（强制规则：.vue 内只允许 @use） -->
<style scoped lang="scss">
@use "./styles/index.scss";
</style>
