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
      <!-- 标题栏：技能名 + 描述两行（标题类名挂在外层，撑满标题栏让关闭按钮靠右） -->
      <template
        #header="{
          class: titleClass, headerId,
        }"
      >
        <div
          class="skill-preview-heading"
          :class="titleClass"
        >
          <span
            :id="headerId"
            class="skill-preview-title"
          >{{ currentSkill?.name }}</span>
          <span
            v-if="currentSkill?.description"
            class="skill-preview-desc"
          >{{ currentSkill.description }}</span>
        </div>
      </template>

      <div
        class="skill-preview-content"
        v-html="renderedContent"
      ></div>

      <template #footer>
        <div class="skill-preview-footer">
          <!-- 元信息："来源: " + 工具名 · 作用域（过长省略，title 补全；文件路径见 title 第二行） -->
          <span
            class="skill-preview-tool"
            :title="`${sourceText}\n${currentSkill?.id ?? ''}`"
          >{{ i18n.skillSourceLabel }} {{ sourceText }}</span>
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
import { getAITool } from "@/config/aiTools"
import { SKILL_SCOPE_LABEL_KEYS } from "../types"
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

/** 来源展示："工具名 · 作用域"（工具名本地化，作用域缺失时只显示工具名） */
const sourceText = computed(() => {
  const skill = props.currentSkill
  if (!skill) return ""

  const toolName = getAITool(skill.tool)?.name ?? skill.tool
  const scopeKey = skill.scope ? SKILL_SCOPE_LABEL_KEYS[skill.scope] : ""
  const scopeLabel = scopeKey ? (props.i18n[scopeKey] ?? "") : ""

  return [toolName, scopeLabel].filter(Boolean).join(" · ")
})
</script>

<style scoped lang="scss">
// 样式全部落在模块文件里（项目约定：.vue 不内联规则）。
// 注意：@use 进来的模块不会把 SCSS 变量转出，SFC 块内直接用变量会报 Undefined variable。
@use "./styles/SkillPreviewModal.scss" as *;
</style>
