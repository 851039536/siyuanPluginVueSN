<!--
  文本对比功能主面板 — 并排输入 + diff 查看器，支持拖拽导入与主题/模式/字号切换
-->
<template>
  <!-- 字号变量仅作用于面板容器：不写 :root，避免弹窗级设置泄漏全局 -->
  <div
    class="text-diff-container"
    :style="{ '--diff-font-size': `${fontSize}px` }"
  >
    <!-- 工具栏：显示模式 / 字号 / 主题 + 清空 / 交换 -->
    <div class="diff-toolbar">
      <div class="toolbar-left">
        <!-- 显示模式切换（"显示模式"） -->
        <div class="option-group">
          <span class="option-label">{{ $t("displayMode") }}</span>
          <button
            v-for="mode in modeOptions"
            :key="mode.value"
            class="toggle-btn"
            :class="{ active: diffMode === mode.value }"
            @click="updateMode(mode.value)"
          >
            {{ mode.label }}
          </button>
        </div>

        <!-- 字号选择（"字体大小"） -->
        <div class="option-group">
          <span class="option-label">{{ $t("fontSize") }}</span>
          <select
            class="font-select"
            :value="fontSize"
            @change="updateFontSize(Number(($event.target as HTMLSelectElement).value))"
          >
            <option
              v-for="opt in FONT_SIZE_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- 主题切换（"主题"） -->
        <div class="option-group">
          <span class="option-label">{{ $t("theme") }}</span>
          <button
            v-for="t in themeOptions"
            :key="t.value"
            class="toggle-btn"
            :class="{ active: diffTheme === t.value }"
            @click="updateTheme(t.value)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="toolbar-right">
        <!-- 清空按钮（"清空"） -->
        <button
          class="action-btn"
          :title="$t('clear')"
          @click="clearAll"
        >
          <Icon icon="mdi:close" :width="16" :height="16" />
          <span>{{ $t("clear") }}</span>
        </button>
        <!-- 交换按钮（"交换"） -->
        <button
          class="action-btn"
          :title="$t('swap')"
          @click="swapTexts"
        >
          <Icon icon="mdi:swap-horizontal" :width="16" :height="16" />
          <span>{{ $t("swap") }}</span>
        </button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="diff-main">
      <!-- 输入区域：原文本 / 修改后文本 双面板 -->
      <div class="input-section">
        <!-- 原文本面板（"原文本"） -->
        <InputPanel
          v-model="originalText"
          v-model:fileName="originalFileName"
          title-key="original"
          placeholder-key="originalPlaceholder"
          :i18n="props.i18n"
        />
        <!-- 修改后文本面板（"修改后文本"） -->
        <InputPanel
          v-model="modifiedText"
          v-model:fileName="modifiedFileName"
          title-key="modified"
          placeholder-key="modifiedPlaceholder"
          :i18n="props.i18n"
        />
      </div>

      <!-- 差异结果（与输入区留白分隔，不再叠加装饰性分隔条与内部标题条） -->
      <div class="result-section">
        <!-- 空状态：双文本均为空时提示（"请输入文本以查看差异"） -->
        <div v-if="!originalText && !modifiedText" class="empty-state">
          <Icon icon="mdi:file-compare-outline" :width="48" :height="48" />
          <p>{{ $t("emptyState") }}</p>
        </div>
        <Diff
          v-else
          class="diff-viewer"
          :mode="diffMode"
          :theme="diffTheme"
          language="plaintext"
          :prev="originalText"
          :current="modifiedText"
          :folding="false"
          :virtual-scroll="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 文本对比主面板：持有双文本状态，v-model 下发输入面板，实时驱动 vue-diff 差异计算
 */
import type { Plugin } from "siyuan"
import type { TextDiffSettings } from "./types/storage"
import { computed, onMounted, ref } from "vue"
import { Icon } from "@iconify/vue"
import { Diff } from "vue-diff"
import { TextDiffStorage } from "./types/storage"
import { textDiffI18n } from "./utils"
import InputPanel from "./components/InputPanel.vue"
import "vue-diff/dist/index.css"

const props = defineProps<{
  i18n?: Record<string, any>
  plugin?: Plugin
}>()

// 存储管理
const storage = props.plugin ? new TextDiffStorage(props.plugin) : null

// 响应式数据
const originalText = ref("")
const modifiedText = ref("")
const originalFileName = ref("")
const modifiedFileName = ref("")
const diffMode = ref<"split" | "unified">("split")
const diffTheme = ref<"light" | "dark">("light")
const fontSize = ref<number>(14)

// 字号选项（用户可调，12-24px）
const FONT_SIZE_OPTIONS = [
  { value: 12, label: "12px" },
  { value: 14, label: "14px" },
  { value: 16, label: "16px" },
  { value: 18, label: "18px" },
  { value: 20, label: "20px" },
  { value: 24, label: "24px" },
]

// 显示模式选项（"分栏" / "统一"）
const modeOptions = computed(() => [
  { value: "split" as const, label: $t("splitMode") },
  { value: "unified" as const, label: $t("unifiedMode") },
])

// 主题选项（"浅色" / "深色"）
const themeOptions = computed(() => [
  { value: "light" as const, label: $t("lightTheme") },
  { value: "dark" as const, label: $t("darkTheme") },
])

// 国际化
const $t = (key: string): string => textDiffI18n(props.i18n, key)

// 加载设置
const loadSettings = async () => {
  if (!storage) return
  try {
    const settings = await storage.settings.loadOrDefault()
    diffMode.value = settings.diffMode
    diffTheme.value = settings.theme
    fontSize.value = settings.fontSize
  } catch (error) {
    console.error("加载设置失败:", error)
  }
}

// 保存设置
const saveSettings = async () => {
  if (!storage) return
  try {
    const settings: TextDiffSettings = {
      fontSize: fontSize.value,
      diffMode: diffMode.value,
      theme: diffTheme.value,
    }
    await storage.settings.save(settings)
  } catch (error) {
    console.error("保存设置失败:", error)
  }
}

const updateMode = (mode: "split" | "unified") => {
  diffMode.value = mode
  saveSettings()
}

const updateTheme = (theme: "light" | "dark") => {
  diffTheme.value = theme
  saveSettings()
}

const updateFontSize = (size: number) => {
  fontSize.value = size
  saveSettings()
}

const clearAll = () => {
  originalText.value = ""
  modifiedText.value = ""
  originalFileName.value = ""
  modifiedFileName.value = ""
}

const swapTexts = () => {
  const tempText = originalText.value
  const tempName = originalFileName.value
  originalText.value = modifiedText.value
  originalFileName.value = modifiedFileName.value
  modifiedText.value = tempText
  modifiedFileName.value = tempName
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped lang="scss">
@use './styles/index.scss';
</style>
