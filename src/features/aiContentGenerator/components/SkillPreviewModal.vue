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
          <!-- 纯图标按钮：关闭弹窗（ariaLabel："关闭"） -->
          <Button
            variant="ghost"
            text
            size="xsmall"
            icon="close"
            :aria-label="i18n.skillPreviewClose"
            @click="$emit('close')"
          />
        </div>
        <div class="skill-preview-body">
          <div
            class="skill-preview-content markdown-preview"
            v-html="renderedContent"
          ></div>
        </div>
        <div class="skill-preview-footer">
          <!-- 元信息："来源: " + 工具名 -->
          <span class="skill-preview-tool">{{ i18n.skillSourceLabel }} {{ currentSkill.tool }}</span>
          <!-- 按钮："关闭" -->
          <Button
            variant="ghost"
            size="xsmall"
            @click="$emit('close')"
          >
            {{ i18n.skillPreviewClose }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { SkillItem } from "@/types/ai"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import { renderMarkdown } from "../utils"

const props = defineProps<{
  /** 国际化文案 */
  i18n: Record<string, string>
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
