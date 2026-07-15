<!-- 技能细则预览弹窗组件 -->
<template>
  <Teleport to="body">
    <div
      v-if="currentSkill"
      class="skill-preview-overlay"
      @click.self="$emit('close')"
    >
      <div class="skill-preview-modal">
        <div class="skill-preview-header">
          <div>
            <span class="skill-preview-title">{{ currentSkill.name }}</span>
            <span
              v-if="currentSkill.description"
              class="skill-preview-desc"
            >{{ currentSkill.description }}</span>
          </div>
          <button
            class="skill-preview-close"
            @click="$emit('close')"
          >
            <svg
              width="16"
              height="16"
            ><use xlink:href="#iconClose" /></svg>
          </button>
        </div>
        <div class="skill-preview-body">
          <div
            class="skill-preview-content markdown-preview"
            v-html="renderedContent"
          ></div>
        </div>
        <div class="skill-preview-footer">
          <span class="skill-preview-tool">来源: {{ currentSkill.tool }}</span>
          <button
            class="skill-preview-btn-close"
            @click="$emit('close')"
          >关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { SkillItem } from "@/types/ai"
import { computed } from "vue"
import { renderMarkdown } from "../utils"

const props = defineProps<{
  currentSkill: SkillItem | null
}>()

defineEmits<{
  close: []
}>()

const renderedContent = computed(() => {
  if (!props.currentSkill) return ""
  return renderMarkdown(props.currentSkill.content, false)
})
</script>

<style scoped lang="scss">
@use "./styles/SkillPreviewModal.scss" as *;
</style>
