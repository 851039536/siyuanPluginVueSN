<template>
  <div class="diff-preview">
    <div class="diff-toolbar">
      <div class="diff-toolbar-left">
        <span class="diff-toolbar-title">Diff 对比</span>
        <span class="diff-stats">
          <span class="stat-added">+{{ diffStats.addCount }}</span>
          <span class="stat-removed">-{{ diffStats.removeCount }}</span>
        </span>
      </div>
      <div class="diff-toolbar-right">
        <div class="diff-mode-toggle">
          <button
            class="mode-btn"
            :class="[{ active: diffMode === 'unified' }]"
            title="合并视图"
            @click="diffMode = 'unified'"
          >
            合并
          </button>
          <button
            class="mode-btn"
            :class="[{ active: diffMode === 'split' }]"
            title="分栏视图"
            @click="diffMode = 'split'"
          >
            分栏
          </button>
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

interface Props {
  originalContent: string
  newContent: string
}

const props = defineProps<Props>()

const diffMode = ref<"split" | "unified">("unified")
const isDarkTheme = ref(false)

// 检测思源笔记当前是否为暗色主题
const checkTheme = () => {
  const html = document.documentElement
  isDarkTheme.value = html.getAttribute("data-theme") === "dark"
}

// 监听思源主题切换
let observer: MutationObserver | null = null

onMounted(() => {
  checkTheme()
  observer = new MutationObserver(() => {
    checkTheme()
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  })
})

onUnmounted(() => {
  observer?.disconnect()
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
@use "../styles/index.scss";
</style>

<style lang="scss">
.diff-viewer-wrapper .diff-viewer,
.diff-viewer-wrapper .diff-viewer *,
.diff-viewer-wrapper .d2h-wrapper,
.diff-viewer-wrapper .d2h-diff-table,
.diff-viewer-wrapper .d2h-diff-row,
.diff-viewer-wrapper .d2h-del,
.diff-viewer-wrapper .d2h-ins,
.diff-viewer-wrapper .d2h-line-num {
  font-size: 12px !important;
}
</style>
