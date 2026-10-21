<!-- Skills 管理 — 单个 Skill 卡片（展示/编辑/展开；操作按钮与编辑器用共享组件） -->
<template>
  <div
    class="sv-skill-card"
    :class="{ 'sv-skill-card--editing': editing }"
    :style="{ '--tool-color': toolColor }"
  >
    <div class="sv-skill-header">
      <div class="sv-skill-header-left">
        <span class="sv-skill-name">{{ skill.name }}</span>
        <span
          class="sv-skill-tool-badge"
          :style="{
            background: `${toolColor}15`,
            color: toolColor,
          }"
        >
          {{ toolName }}
        </span>
        <span class="sv-skill-size">{{ formatFileSize(skill.fileSize) }}</span>
      </div>
      <div class="sv-skill-header-actions">
        <!-- 操作按钮：编辑 -->
        <Button
          v-if="!editing"
          variant="ghost"
          size="xsmall"
          icon="edit"
          :aria-label="i18n.editSkill"
          :title="i18n.editSkill"
          @click="$emit('edit')"
        />
        <!-- 操作按钮：复制到其他工具 -->
        <Button
          v-if="!editing"
          variant="ghost"
          size="xsmall"
          icon="list"
          :aria-label="i18n.copySkill"
          :title="i18n.copySkill"
          @click="$emit('copy')"
        />
        <!-- 操作按钮：保存 -->
        <Button
          v-if="editing"
          variant="ghost"
          size="xsmall"
          icon="save"
          :loading="savingSkill"
          :disabled="savingSkill"
          :aria-label="i18n.saveSkill"
          :title="i18n.saveSkill"
          @click="$emit('save', editContent)"
        />
        <!-- 操作按钮：取消编辑 -->
        <Button
          v-if="editing"
          variant="ghost"
          size="xsmall"
          icon="close"
          :aria-label="i18n.cancelEdit"
          :title="i18n.cancelEdit"
          @click="$emit('cancelEdit')"
        />
        <!-- 操作按钮：删除 -->
        <Button
          v-if="!editing"
          variant="ghost"
          size="xsmall"
          icon="delete"
          :aria-label="i18n.deleteSkill"
          :title="i18n.deleteSkill"
          @click="$emit('delete')"
        />
      </div>
    </div>
    <div
      v-if="skill.description"
      class="sv-skill-desc"
    >
      {{ skill.description }}
    </div>
    <div
      class="sv-skill-path"
      :title="skill.filePath"
    >
      {{ skill.filePath }}
    </div>

    <template v-if="editing">
      <div class="sv-skill-editor">
        <!-- 内容编辑器：共享 Input（textarea），语义与原生 textarea 一致 -->
        <Input
          type="textarea"
          class="sv-skill-editor-textarea"
          :model-value="editContent"
          :placeholder="i18n.editSkillPlaceholder"
          :rows="8"
          :spellcheck="false"
          @update:model-value="(v) => $emit('update:editContent', String(v ?? ''))"
        />
        <div class="sv-skill-editor-footer">
          <!-- 编辑提示文案 -->
          <span class="sv-skill-editor-hint">{{ i18n.editSkillHint }}</span>
        </div>
      </div>
    </template>

    <template v-else>
      <!-- 展开/收起按钮（aria-expanded 表达状态，文案随状态切换） -->
      <Button
        class="sv-skill-expand-btn"
        variant="ghost"
        text
        size="xsmall"
        :icon="expanded ? 'chevronDown' : 'chevronRight'"
        :aria-expanded="expanded"
        @click="$emit('toggleExpand')"
      >
        {{ expanded ? i18n.collapse : i18n.expand }}
      </Button>
      <div
        v-if="expanded"
        class="sv-skill-content"
        v-html="renderedContent"
      ></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SkillInfo } from "../SkillsManager"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import { formatFileSize } from "@/utils/format"
import { renderMarkdown } from "../../utils"

interface Props {
  skill: SkillInfo
  editing: boolean
  expanded: boolean
  savingSkill: boolean
  toolColor: string
  toolName: string
  i18n: Record<string, string>
  editContent: string
}

const props = defineProps<Props>()

defineEmits<{
  "edit": []
  "save": [content: string]
  "cancelEdit": []
  "toggleExpand": []
  "delete": []
  "copy": []
  'update:editContent': [value: string]
}>()

// 统一走模块的 XSS 安全渲染（转义 skill.md 中的原始 HTML），与 SkillPreviewModal 同源
const renderedContent = computed(() => renderMarkdown(props.skill.content, false))
</script>

<style scoped lang="scss">
@use "../styles/SkillCard.scss";
</style>
