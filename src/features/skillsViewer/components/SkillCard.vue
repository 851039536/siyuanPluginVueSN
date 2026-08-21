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
        <!-- 操作按钮：编辑 -->
        <button
          v-if="!editing"
          class="sv-skill-action-btn sv-skill-action-btn--edit"
          :title="i18n.editSkill"
          @click="$emit('edit')"
        >
          <IconWrapper
            name="edit"
            :size="14"
          />
        </button>
        <!-- 操作按钮：复制到其他工具 -->
        <button
          v-if="!editing"
          class="sv-skill-action-btn sv-skill-action-btn--copy"
          :title="i18n.copySkill"
          @click="$emit('copy')"
        >
          <IconWrapper
            name="list"
            :size="14"
          />
        </button>
        <template v-if="editing">
          <!-- 操作按钮：保存 -->
          <button
            class="sv-skill-action-btn sv-skill-action-btn--save"
            :title="i18n.saveSkill"
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
          <!-- 操作按钮：取消编辑 -->
          <button
            class="sv-skill-action-btn sv-skill-action-btn--cancel"
            :title="i18n.cancelEdit"
            @click="$emit('cancelEdit')"
          >
            <IconWrapper name="close" :size="12" />
          </button>
        </template>
        <!-- 操作按钮：删除 -->
        <button
          v-if="!editing"
          class="sv-skill-action-btn sv-skill-action-btn--delete"
          :title="i18n.deleteSkill"
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
          :placeholder="i18n.editSkillPlaceholder"
          spellcheck="false"
          @input="$emit('update:editContent', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <div class="sv-skill-editor-footer">
          <!-- 编辑提示文案 -->
          <span class="sv-skill-editor-hint">{{ i18n.editSkillHint }}</span>
        </div>
      </div>
    </template>

    <template v-else>
      <!-- 展开/收起按钮 -->
      <button
        class="sv-skill-expand-btn"
        @click="$emit('toggleExpand')"
      >
        {{ i18n.expand }}
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
import { formatFileSize } from "../utils"
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
</style>
