<!-- 代码图片灵感模式候选条：迷你预览 + 点选应用 + 再随机 -->
<template>
  <div
    v-if="candidates.length"
    class="code-candidate-strip"
  >
    <div class="code-candidate-header">
      <!-- 候选条标题："随机组合候选" -->
      <span class="code-candidate-title">{{ t.randomComboTitle }}</span>
      <Button
        variant="ghost"
        size="xsmall"
        icon="refresh"
        :title="t.reroll"
        @click="service.generateCandidates()"
      />
    </div>
    <div class="code-candidate-list">
      <button
        v-for="(c, i) in candidates"
        :key="i"
        class="code-candidate-item"
        :title="c.label"
        @click="service.applyCandidate(i)"
      >
        <!-- 候选标签（随机组合 N） -->
        <span class="code-candidate-label">{{ c.label }}</span>
        <span class="code-candidate-frame">
          <span
            class="code-mini"
            :class="[`style-${c.params.selectedStyle}`, `theme-${c.params.selectedTheme}`, `hljs-theme-${c.params.hljsTheme}`]"
            :style="miniPreviewStyle(c.params)"
          >
            <span
              class="bg-layer"
              :class="[`style-${c.params.selectedStyle}`, `theme-${c.params.selectedTheme}`]"
              :style="miniBgStyle(c.params)"
            ></span>
            <span
              class="code-mini-body"
              :style="miniContentStyle(c.params)"
            >
              <code v-html="highlightedHtml"></code>
            </span>
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 代码图片灵感模式候选条：迷你预览 + 点选应用 + 再随机
 */
import type {
  CodeImageState,
  ImageCreationI18n,
} from "../types"
import type { useCodeImageGenerator } from "../composables/useCodeImageGenerator"
import Button from "@/components/Button.vue"
import { usePlugin } from "@/main"
import { resolveCodeFontStack } from "../types"
import {
  buildCodeBgLayerStyle,
  buildCodePreviewInlineStyle,
} from "../utils/codeImageUtils"

interface Props {
  service: ReturnType<typeof useCodeImageGenerator>
}

const props = defineProps<Props>()
const service = props.service
const candidates = service.candidates
const highlightedHtml = service.highlightedCode
const bgImageDataUrl = service.bgImageDataUrl

const plugin = usePlugin()
const t = (plugin.i18n as Record<string, any>).imageCreation as ImageCreationI18n

const miniPreviewStyle = (p: CodeImageState) => buildCodePreviewInlineStyle(p)
const miniBgStyle = (p: CodeImageState) => buildCodeBgLayerStyle(p, bgImageDataUrl.value)
const miniContentStyle = (p: CodeImageState) => ({
  fontSize: `${Math.max(6, Math.round(p.fontSize * 0.5))}px`,
  fontFamily: resolveCodeFontStack(p.fontFamily),
})
</script>

<style scoped lang="scss">
@use "../styles/CodeImageStyles.scss";
@use "../styles/CodeImageCandidateStrip.scss";
</style>
