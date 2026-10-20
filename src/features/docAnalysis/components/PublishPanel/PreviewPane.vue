<!-- 排版预览窗格 - 渲染 Markdown 为 HTML 实时预览 -->
<template>
  <div class="preview-pane">
    <div v-if="!html" class="preview-empty">
      <Icon icon="mdi:file-document-outline" class="preview-empty-icon" />
      <p class="preview-empty-title">{{ i18n.previewTitle }}</p>
      <p class="preview-empty-desc">{{ i18n.previewDesc }}</p>
    </div>
    <div
      v-else
      class="preview-card-wrapper"
    >
      <div class="preview-card">
        <div
          class="preview-card-content"
          v-html="html"
        />
        <div class="preview-card-footer">
          <span>预览效果</span>
          <span>微信公众号</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import type { DocI18n } from "../../types/index"

interface Props {
  html: string
  /** docAnalysis 分片 i18n（空态文案） */
  i18n: DocI18n
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
@use "../../styles/PreviewPane.scss";
</style>
