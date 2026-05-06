<template>
  <div class="bottom-input-section">
    <!-- 第一行：文档选择 + 提示词 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <!-- 文档/块选择器 -->
        <div
          class="doc-selector"
          :class="{ 'has-doc': editTargetDoc }"
        >
          <Button
            variant="ghost"
            size="small"
            :title="editTargetDoc && !editTargetDoc.isBlock ? editTargetDoc.title : '选择文档'"
            @click="$emit('select-target-doc')"
          >
            <svg
              width="14"
              height="14"
            ><use xlink:href="#iconFile"></use></svg>
            <span class="doc-name">{{ editTargetDoc && !editTargetDoc.isBlock ? truncateTitle(editTargetDoc.title) : '选择文档' }}</span>
          </Button>
          <Button
            variant="ghost"
            size="small"
            :title="editTargetDoc?.isBlock ? editTargetDoc.title : '选择块'"
            @click="$emit('select-target-block')"
          >
            <svg
              width="14"
              height="14"
            ><use xlink:href="#iconEdit"></use></svg>
            <span class="doc-name">{{ editTargetDoc?.isBlock ? truncateTitle(editTargetDoc.title) : '选择块' }}</span>
          </Button>
          <Tag
            v-if="editTargetDoc?.isBlock"
            size="small"
            variant="primary"
          >
            块
          </Tag>
          <Button
            v-if="editTargetDoc"
            variant="ghost"
            size="small"
            class="clear-btn"
            title="清除"
            @click="$emit('clear-target-doc')"
          >
            <svg
              width="12"
              height="12"
            ><use xlink:href="#iconClose"></use></svg>
          </Button>
        </div>
      </div>

      <!-- 技能选择 -->
      <div class="top-bar-center">
        <div class="skill-selector-wrapper">
          <select
            :value="currentSkillIndex"
            class="skill-select"
            title="选择预设技能作为系统指令"
            @change="onSkillChange(($event.target as HTMLSelectElement).value)"
          >
            <option value="-1">🧠 {{ $t('noSkill') }}</option>
            <option
              v-for="(skill, index) in skills"
              :key="skill.id"
              :value="index"
            >
              {{ skill.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- 提示词选择 -->
      <div class="top-bar-right">
        <div class="prompt-selector-wrapper">
          <Button
            variant="ghost"
            size="small"
            :class="{ active: currentPromptName }"
            @click="$emit('toggle-prompt-selector')"
          >
            <svg
              width="14"
              height="14"
            ><use xlink:href="#iconList"></use></svg>
            <span>{{ currentPromptName || '提示词' }}</span>
            <span
              v-if="savedPrompts.length > 0 && !currentPromptName"
              class="badge"
            >{{ savedPrompts.length }}</span>
          </Button>
          <Button
            v-if="currentPromptName"
            variant="ghost"
            size="small"
            class="clear-btn"
            title="清除提示词"
            @click="$emit('clear-current-prompt')"
          >
            <svg
              width="12"
              height="12"
            ><use xlink:href="#iconClose"></use></svg>
          </Button>

          <!-- 提示词选择面板 -->
          <div
            v-if="showPromptSelector"
            class="prompt-selector-panel"
          >
            <div class="prompt-selector-header">
              <span>选择提示词</span>
              <Button
                variant="ghost"
                size="small"
                @click="$emit('toggle-prompt-selector')"
              >
                <svg
                  width="12"
                  height="12"
                ><use xlink:href="#iconClose"></use></svg>
              </Button>
            </div>
            <div class="prompt-list">
              <div
                v-for="(prompt, index) in paginatedPrompts"
                :key="prompt.id || index"
                class="prompt-item"
                @click="$emit('load-prompt', getOriginalIndex(prompt))"
              >
                <div class="prompt-item-header">
                  <span class="prompt-name">{{ prompt.name }}</span>
                  <div class="prompt-item-actions">
                    <Button
                      variant="ghost"
                      size="small"
                      title="编辑"
                      @click.stop="$emit('edit-prompt', getOriginalIndex(prompt))"
                    >
                      <svg
                        width="12"
                        height="12"
                      ><use xlink:href="#iconEdit"></use></svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="small"
                      title="删除"
                      @click.stop="$emit('delete-prompt', getOriginalIndex(prompt))"
                    >
                      <svg
                        width="12"
                        height="12"
                      ><use xlink:href="#iconTrashcan"></use></svg>
                    </Button>
                  </div>
                </div>
                <div class="prompt-item-preview">
                  {{ getPromptPreview(prompt.systemPrompt) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 第二行：AI 快捷操作（已选择文档时平铺显示） -->
    <div
      v-if="editTargetDoc"
      class="quick-actions-bar"
    >
      <button
        v-for="action in quickActions"
        :key="action.key"
        class="quick-action-btn"
        :class="{ active: isGenerating }"
        :disabled="isGenerating"
        :title="action.label"
        @click="$emit('ai-edit', action.key)"
      >
        <svg
          width="12"
          height="12"
        ><use :xlink:href="action.icon"></use></svg>
        <span>{{ action.label }}</span>
      </button>
    </div>

    <!-- 第三行：输入框 + 执行按钮（已选择文档或技能时显示） -->
    <div
      v-if="editTargetDoc || currentSkillIndex >= 0"
      class="input-row"
    >
      <Textarea
        :model-value="editCustomInput"
        :placeholder="inputPlaceholder"
        :rows="1"
        :autosize="true"
        :disabled="isGenerating"
        class="input-field"
        @update:model-value="$emit('update:editCustomInput', $event)"
        @keydown.ctrl.enter="$emit('custom-edit')"
      />
      <!-- 执行/停止按钮 -->
      <Button
        v-if="!isGenerating"
        :disabled="!canExecute"
        :title="executeButtonTitle"
        variant="primary"
        size="small"
        class="execute-btn"
        @click="$emit('custom-edit')"
      >
        <svg
          width="16"
          height="16"
        ><use xlink:href="#iconSparkles"></use></svg>
      </Button>
      <Button
        v-else
        title="停止生成"
        variant="danger"
        size="small"
        class="execute-btn"
        @click="$emit('stop')"
      >
        <svg
          width="16"
          height="16"
        ><use xlink:href="#iconClose"></use></svg>
      </Button>
    </div>

    <!-- 点击遮罩关闭提示词面板 -->
    <div
      v-if="showPromptSelector"
      class="dropdown-overlay"
      @click="$emit('toggle-prompt-selector')"
    ></div>
  </div>
</template>

<script setup lang="ts">
import type {
  SavedPrompt,
  TargetDoc,
  SkillItem,
} from "@/types/ai"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Tag from "@/components/Tag.vue"
import Textarea from "@/components/Textarea.vue"
import { getPromptPreview } from "../utils"

interface QuickAction {
  key: "polish" | "expand" | "condense" | "fix" | "rewrite" | "summary"
  label: string
  icon: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (
    e: "ai-edit",
    action:
      | "polish"
      | "expand"
      | "condense"
      | "fix"
      | "rewrite"
      | "summary",
  ): void
  (e: "stop"): void
  (e: "toggle-prompt-selector"): void
  (e: "clear-current-prompt"): void
  (e: "load-prompt", index: number): void
  (e: "edit-prompt", index: number): void
  (e: "delete-prompt", index: number): void
  (e: "select-target-doc"): void
  (e: "select-target-block"): void
  (e: "clear-target-doc"): void
  (e: "custom-edit"): void
  (e: "update:editCustomInput", value: string): void
  (e: "update:currentSkillIndex", value: number): void
}>()

const quickActions: QuickAction[] = [
  {
    key: "polish",
    label: "润色",
    icon: "#iconEdit",
  },
  {
    key: "expand",
    label: "扩写",
    icon: "#iconAdd",
  },
  {
    key: "condense",
    label: "精简",
    icon: "#iconMin",
  },
  {
    key: "fix",
    label: "纠错",
    icon: "#iconCheck",
  },
  {
    key: "rewrite",
    label: "改写",
    icon: "#iconRefresh",
  },
  {
    key: "summary",
    label: "总结",
    icon: "#iconList",
  },
]

interface Props {
  isGenerating: boolean
  editTargetDoc: TargetDoc | null
  showPromptSelector: boolean
  currentPromptName: string
  savedPrompts: SavedPrompt[]
  paginatedPrompts: SavedPrompt[]
  editCustomInput: string
  skills: SkillItem[]
  currentSkillIndex: number
}

// 计算属性
const canExecute = computed(() => {
  // 选了技能即允许发送（技能作为系统指令，内容可来自输入或文档）
  if (props.currentSkillIndex >= 0) {
    return true
  }
  if (props.editTargetDoc) {
    return props.editCustomInput.trim() || props.currentPromptName
  }
  return false
})

const executeButtonTitle = computed(() => {
  if (!props.editTargetDoc && props.currentSkillIndex >= 0) {
    return "发送提问"
  }
  return !props.editCustomInput.trim() && props.currentPromptName
    ? "使用当前提示词生成"
    : "执行"
})

const inputPlaceholder = computed(() => {
  if (!props.editTargetDoc && props.currentSkillIndex >= 0) {
    return "输入你的问题..."
  }
  return "输入编辑指令，或选择AI快捷操作..."
})

// 技能选择变化
const onSkillChange = (value: string) => {
  const index = parseInt(value, 10)
  emit("update:currentSkillIndex", isNaN(index) ? -1 : index)
}

// 国际化
function $t(key: string): string {
  const translations: Record<string, string> = {
    noSkill: "无技能",
  }
  return translations[key] || key
}

// 截断标题
const truncateTitle = (title: string, maxLen = 12) => {
  if (title.length <= maxLen) return title
  return `${title.substring(0, maxLen)}...`
}

// 获取原始索引
const getOriginalIndex = (prompt: SavedPrompt) => {
  return props.savedPrompts.findIndex((p) => p.id === prompt.id)
}

</script>

<style scoped lang="scss">
@use "../styles/index.scss";

// ============ 技能选择器 ============
.skill-selector-wrapper {
  display: flex;
  align-items: center;
  min-width: 0;
  flex-shrink: 1;
}
</style>
