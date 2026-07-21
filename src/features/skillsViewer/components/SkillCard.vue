<!-- Skills 查看器 — 单个 Skill 卡片（展示/编辑/展开） -->
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
        <button
          v-if="!editing"
          class="sv-skill-action-btn sv-skill-action-btn--edit"
          :title="i18n.editSkill || '编辑'"
          @click="$emit('edit')"
        >
          <IconWrapper
            name="edit"
            :size="14"
          />
        </button>
        <button
          v-if="!editing"
          class="sv-skill-action-btn sv-skill-action-btn--copy"
          :title="i18n.copySkill || '复制到其他工具'"
          @click="$emit('copy')"
        >
          <IconWrapper
            name="list"
            :size="14"
          />
        </button>
        <template v-if="editing">
          <button
            class="sv-skill-action-btn sv-skill-action-btn--save"
            :title="i18n.saveSkill || '保存'"
            :disabled="savingSkill"
            @click="$emit('save', editContent)"
          >
            <IconWrapper
              v-if="!savingSkill"
              name="save"
              :size="14"
            />
            <span v-else>...</span>
          </button>
          <button
            class="sv-skill-action-btn sv-skill-action-btn--cancel"
            :title="i18n.cancelEdit || '取消'"
            @click="$emit('cancelEdit')"
          >
            <IconWrapper name="close" :size="12" />
          </button>
        </template>
        <button
          v-if="!editing"
          class="sv-skill-action-btn sv-skill-action-btn--delete"
          :title="i18n.deleteSkill || '删除'"
          @click="$emit('delete')"
        >
          <IconWrapper
            name="delete"
            :size="14"
          />
        </button>
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
        <textarea
          :value="editContent"
          class="sv-skill-editor-textarea"
          :placeholder="i18n.editSkillPlaceholder || '编辑 Skill 内容...'"
          spellcheck="false"
          @input="$emit('update:editContent', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <div class="sv-skill-editor-footer">
          <span class="sv-skill-editor-hint">{{ i18n.editSkillHint || '修改完成后点击保存按钮写入文件' }}</span>
        </div>
      </div>
    </template>

    <template v-else>
      <button
        class="sv-skill-expand-btn"
        @click="$emit('toggleExpand')"
      >
        {{ i18n.expand || '展开' }}
        <span class="sv-expand-arrow">{{ expanded ? '▾' : '▸' }}</span>
      </button>
      <div
        v-if="expanded"
        class="sv-skill-content"
        v-html="renderedContent"
      ></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SkillInfo } from "../types/SkillsViewerManager"
import { computed } from "vue"
import { parseMarkdown } from "@/utils/mdRenderer"
import IconWrapper from "@/components/IconWrapper.vue"

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
  edit: []
  save: [content: string]
  cancelEdit: []
  toggleExpand: []
  delete: []
  copy: []
  'update:editContent': [value: string]
}>()

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / k ** i
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function renderMarkdown(content: string): string {
  try {
    return parseMarkdown(content)
  } catch {
    return content
  }
}

const renderedContent = computed(() => renderMarkdown(props.skill.content))
</script>

<style scoped lang="scss">
@use "../styles/SkillCard.scss";
@use "../styles/index.scss";
</style>
