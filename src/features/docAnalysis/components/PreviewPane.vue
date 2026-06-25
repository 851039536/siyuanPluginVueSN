<template>
  <div
    ref="previewRef"
    class="preview-pane"
    @scroll="handleScroll"
  >
    <div v-if="!html" class="preview-empty">
      <span class="preview-empty-icon">📄</span>
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
import { ref } from "vue"

interface Props {
  html: string
}

interface Emits {
  (e: "scroll", scrollTop: number): void
}

defineProps<Props>()

const emit = defineEmits<Emits>()

const previewRef = ref<HTMLElement | null>(null)

function handleScroll() {
  const el = previewRef.value
  if (el) {
    emit("scroll", el.scrollTop)
  }
}
</script>

<style lang="scss" scoped>
@use "../styles/PreviewPane.scss";
</style>
