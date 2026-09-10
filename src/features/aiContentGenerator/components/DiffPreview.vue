<!-- Diff 对比预览组件：原文/新文差异视图（vue-diff），支持合并/分栏切换、增删行数统计与暗色主题适配 -->
<template>
  <div class="diff-preview">
    <div class="diff-toolbar">
      <div class="diff-toolbar-left">
        <!-- 工具栏标题："Diff 对比" -->
        <span class="diff-toolbar-title">{{ i18n.diffTitle }}</span>
        <span class="diff-stats">
          <span class="stat-added">+{{ diffStats.addCount }}</span>
          <span class="stat-removed">-{{ diffStats.removeCount }}</span>
        </span>
      </div>
      <div class="diff-toolbar-right">
        <!-- 分段切换：合并 / 分栏（选中态走主色 text 外观） -->
        <div class="diff-mode-toggle">
          <!-- 按钮："合并"（title："合并视图"） -->
          <Button
            :variant="diffMode === 'unified' ? 'primary' : 'ghost'"
            text
            size="xsmall"
            :title="i18n.diffModeUnifiedTitle"
            @click="diffMode = 'unified'"
          >
            {{ i18n.diffModeUnified }}
          </Button>
          <!-- 按钮："分栏"（title："分栏视图"） -->
          <Button
            :variant="diffMode === 'split' ? 'primary' : 'ghost'"
            text
            size="xsmall"
            :title="i18n.diffModeSplitTitle"
            @click="diffMode = 'split'"
          >
            {{ i18n.diffModeSplit }}
          </Button>
        </div>
      </div>
    </div>
    <div
      class="diff-viewer-wrapper"
      :class="{ 'is-dark': isDarkTheme }"
    >
      <Diff
        class="diff-viewer"
        :mode="diffMode"
        :theme="isDarkTheme ? 'dark' : 'light'"
        language="plaintext"
        :prev="originalContent"
        :current="newContent"
        :folding="false"
        :virtual-scroll="false"
        :render-added="true"
        :render-removed="true"
        :hide-line-numbers="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import DiffMatchPatch from "diff-match-patch"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { Diff } from "vue-diff"
import "vue-diff/dist/index.css"
import Button from "@/components/Button.vue"

interface Props {
  /** 国际化文案 */
  i18n: Record<string, string>
  originalContent: string
  newContent: string
}

const props = defineProps<Props>()

const diffMode = ref<"split" | "unified">("unified")
const isDarkTheme = ref(false)

// 检测思源笔记当前是否为暗色主题（思源在 html 上维护 data-theme-mode 属性）
const checkTheme = () => {
  const html = document.documentElement
  isDarkTheme.value = html.getAttribute("data-theme-mode") === "dark"
}

// 监听思源主题切换（RAF 节流，避免高频属性变化时重复执行）
let observer: MutationObserver | null = null
let themeCheckRaf: number | null = null

onMounted(() => {
  checkTheme()
  observer = new MutationObserver(() => {
    if (themeCheckRaf !== null) return
    themeCheckRaf = requestAnimationFrame(() => {
      themeCheckRaf = null
      checkTheme()
    })
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme-mode"],
  })
})

onUnmounted(() => {
  observer?.disconnect()
  if (themeCheckRaf !== null) {
    cancelAnimationFrame(themeCheckRaf)
    themeCheckRaf = null
  }
})

const dmp = new DiffMatchPatch()

const diffStats = computed(() => {
  const diffs = dmp.diff_main(props.originalContent, props.newContent)
  let addCount = 0
  let removeCount = 0
  for (const [op, text] of diffs) {
    if (op === 1) addCount += text.length
    if (op === -1) removeCount += text.length
  }
  return {
    addCount,
    removeCount,
  }
})
</script>

<style scoped lang="scss">
@use "../styles/DiffPreview.scss" as *;
@use "../styles/index.scss";
</style>
