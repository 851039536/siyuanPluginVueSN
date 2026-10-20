<!-- 排版预览窗格 - 渲染 Markdown 为 HTML 实时预览 -->
<template>
  <div class="preview-pane">
    <div v-if="!html" class="preview-empty">
      <Icon icon="mdi:file-document-outline" class="preview-empty-icon" />
      <p class="preview-empty-title">实时预览</p>
      <p class="preview-empty-desc">在左侧编辑器中输入 Markdown，即可在此预览排版效果</p>
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

interface Props {
  html: string
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
@use "../../styles/PreviewPane.scss";
</style>
