<!-- 技能细则预览弹窗（外壳复用共享 Dialog；Markdown 渲染走模块 XSS 安全路径） -->
<template>
  <!-- Teleport 到 body：逃逸 Dock / .plugin-app-main 的层叠上下文，避免被思源原生界面压住 -->
  <Teleport to="body">
    <Dialog
      :visible="!!currentSkill"
      size="medium"
      :close-label="i18n.skillPreviewClose"
      dismissable-mask
      @update:visible="$emit('close')"
    >
      <!-- 标题栏：技能名 + 描述两行（沿用 Dialog 的标题类名与 id 保持无障碍关联） -->
      <template
        #header="{
          class: titleClass, headerId,
        }"
      >
        <div class="skill-preview-heading">
          <span
            :id="headerId"
            class="skill-preview-title"
            :class="titleClass"
          >{{ currentSkill?.name }}</span>
          <span
            v-if="currentSkill?.description"
            class="skill-preview-desc"
          >{{ currentSkill.description }}</span>
        </div>
      </template>

      <div
        class="skill-preview-content markdown-preview"
        v-html="renderedContent"
      ></div>

      <template #footer>
        <div class="skill-preview-footer">
          <!-- 元信息："来源: " + 工具名 -->
          <span class="skill-preview-tool">{{ i18n.skillSourceLabel }} {{ currentSkill?.tool }}</span>
          <!-- 按钮："关闭" -->
          <Button
            variant="ghost"
            size="xsmall"
            @click="$emit('close')"
          >
            {{ i18n.skillPreviewClose }}
          </Button>
        </div>
      </template>
    </Dialog>
  </Teleport>
</template>

<script setup lang="ts">
import type { SkillItem } from "@/types/ai"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
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
@use "../styles/index.scss" as *;

// 共享 Markdown 预览骨架按需 @include
.markdown-preview {
  @include markdown-preview;
}
</style>
