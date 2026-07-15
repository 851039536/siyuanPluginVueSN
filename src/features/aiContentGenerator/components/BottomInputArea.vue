<!-- 底部输入区域组件：文档选择器、技能选择、提示词、快捷操作、模型选项、自定义输入 -->
<template>
  <div class="bottom-input-section">
    <!-- 第一行：文档选择 + 技能 + 提示词 -->
    <div class="top-bar">
      <div class="top-bar-left">
        <!-- 文档/块选择器 -->
        <div
          class="doc-selector"
          :class="{ 'has-doc': editTargetDoc }"
        >
          <Button
            variant="ghost"
            size="xsmall"
            :title="editTargetDoc && !editTargetDoc.isBlock ? editTargetDoc.title : '选择文档'"
            @click="$emit('select-target-doc')"
          >
            <svg width="14" height="14"><use xlink:href="#iconFile"></use></svg>
            <span class="doc-name">{{ editTargetDoc && !editTargetDoc.isBlock ? truncateTitle(editTargetDoc.title) : '选择文档' }}</span>
          </Button>
          <Button
            variant="ghost"
            size="xsmall"
            :title="editTargetDoc?.isBlock ? editTargetDoc.title : '选择块'"
            @click="$emit('select-target-block')"
          >
            <svg width="14" height="14"><use xlink:href="#iconEdit"></use></svg>
            <span class="doc-name">{{ editTargetDoc?.isBlock ? truncateTitle(editTargetDoc.title) : '选择块' }}</span>
          </Button>
          <Tag
            v-if="editTargetDoc?.isBlock"
            size="xsmall"
            variant="primary"
          >块</Tag>
          <Button
            v-if="editTargetDoc"
            variant="ghost"
            size="xsmall"
            class="clear-btn"
            title="清除"
            @click="$emit('clear-target-doc')"
          >
            <svg width="12" height="12"><use xlink:href="#iconClose"></use></svg>
          </Button>
        </div>
      </div>

      <!-- 技能选择 -->
      <div class="top-bar-center">
        <SkillSection
          :current-skill-index="currentSkillIndex"
          :current-skill="currentSkill"
          :skills="skills"
          :filtered-skills="filteredSkills"
          :skill-search-query="skillSearchQuery"
          @select-skill="onSkillSelect"
          @update:skill-search-query="(v: string) => $emit('update:skillSearchQuery', v)"
          @show-preview="showSkillPreview = true"
        />
      </div>

      <!-- 提示词选择 -->
      <div class="top-bar-right">
        <label class="rag-toggle" :class="{ active: webSearch }" title="RAG联网搜索：先搜后答，获取最新信息">
          <svg width="12" height="12"><use xlink:href="#iconSearch"></use></svg>
          <input type="checkbox" :checked="webSearch" @change="$emit('update:webSearch', ($event.target as HTMLInputElement).checked)" />
          <span>联网</span>
        </label>

        <div class="prompt-selector-wrapper">
          <Button
            variant="ghost"
            size="xsmall"
            :class="{ active: currentPromptName }"
            @click="$emit('toggle-prompt-selector')"
          >
            <svg width="14" height="14"><use xlink:href="#iconList"></use></svg>
            <span>{{ currentPromptName || '提示词' }}</span>
            <span v-if="savedPrompts.length > 0 && !currentPromptName" class="badge">{{ savedPrompts.length }}</span>
          </Button>
          <Button
            v-if="currentPromptName"
            variant="ghost"
            size="xsmall"
            class="clear-btn"
            title="清除提示词"
            @click="$emit('clear-current-prompt')"
          >
            <svg width="12" height="12"><use xlink:href="#iconClose"></use></svg>
          </Button>

          <!-- 提示词选择面板 -->
          <div v-if="showPromptSelector" class="prompt-selector-panel">
            <div class="prompt-selector-header">
              <span>选择提示词</span>
              <Button variant="ghost" size="xsmall" @click="$emit('toggle-prompt-selector')">
                <svg width="12" height="12"><use xlink:href="#iconClose"></use></svg>
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
                    <Button variant="ghost" size="xsmall" title="编辑" @click.stop="$emit('edit-prompt', getOriginalIndex(prompt))">
                      <svg width="12" height="12"><use xlink:href="#iconEdit"></use></svg>
                    </Button>
                    <Button variant="ghost" size="xsmall" title="删除" @click.stop="$emit('delete-prompt', getOriginalIndex(prompt))">
                      <svg width="12" height="12"><use xlink:href="#iconTrashcan"></use></svg>
                    </Button>
                  </div>
                </div>
                <div class="prompt-item-preview">{{ getPromptPreview(prompt.systemPrompt) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 第二行：AI 快捷操作 -->
    <div v-if="editTargetDoc" class="quick-actions-bar">
      <button
        v-for="action in quickActions"
        :key="action.key"
        class="quick-action-btn"
        :class="{ active: isGenerating }"
        :disabled="isGenerating"
        :title="action.label"
        @click="$emit('ai-edit', action.key)"
      >
        <svg width="12" height="12"><use :xlink:href="action.icon"></use></svg>
        <span>{{ action.label }}</span>
      </button>
    </div>

    <!-- 选项行：模型选择 + 思考 + 审核 -->
    <div class="options-bar">
      <input
        v-if="selectedModel === 'custom'"
        class="model-custom-input"
        :value="customModel"
        placeholder="输入模型名..."
        @input="$emit('update:custom-model', ($event.target as HTMLInputElement).value)"
      />
      <select
        v-else
        class="model-select"
        :value="selectedModel"
        @change="$emit('update:selected-model', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">默认模型</option>
        <optgroup v-if="availableModels.common.length > 0" label="常用">
          <option v-for="m in availableModels.common" :key="m.value" :value="m.value">{{ m.label }}</option>
        </optgroup>
        <optgroup v-if="availableModels.all.length > 0" label="全部">
          <option v-for="m in availableModels.all" :key="m.value" :value="m.value">{{ m.label }}</option>
        </optgroup>
        <option value="custom">自定义...</option>
      </select>
      <label v-if="supportsThinking" class="thinking-toggle" title="思考模式">
        <input type="checkbox" :checked="enableThinking" @change="$emit('update:enable-thinking', ($event.target as HTMLInputElement).checked)" />
        <span class="thinking-label">思考</span>
      </label>
      <label class="review-toggle" title="生成后使用 V4 Pro 交叉审核">
        <input type="checkbox" :checked="enableReview" @change="$emit('update:enable-review', ($event.target as HTMLInputElement).checked)" />
        <span class="review-label"><svg width="11" height="11"><use xlink:href="#iconCheck" /></svg>审核</span>
      </label>
    </div>

    <!-- 第三行：输入框 + 执行按钮 -->
    <div v-if="editTargetDoc || currentSkillIndex >= 0" class="input-row">
      <Input
        type="textarea"
        :model-value="editCustomInput"
        :placeholder="inputPlaceholder"
        :rows="1"
        :autosize="true"
        :disabled="isGenerating"
        class="input-field"
        @update:model-value="onEditCustomInputChange"
        @keydown.ctrl.enter="$emit('custom-edit')"
      />
      <Button
        v-if="!isGenerating"
        :disabled="!canExecute"
        :title="executeButtonTitle"
        variant="primary"
        size="xsmall"
        class="execute-btn"
        @click="$emit('custom-edit')"
      >
        <svg width="16" height="16"><use xlink:href="#iconSparkles"></use></svg>
      </Button>
      <Button
        v-else
        title="停止生成"
        variant="danger"
        size="xsmall"
        class="execute-btn"
        @click="$emit('stop')"
      >
        <svg width="16" height="16"><use xlink:href="#iconClose"></use></svg>
      </Button>
    </div>

    <!-- 点击遮罩关闭提示词面板 -->
    <div v-if="showPromptSelector" class="dropdown-overlay" @click="$emit('toggle-prompt-selector')"></div>

    <!-- 技能细则预览弹窗 -->
    <SkillPreviewModal
      v-if="showSkillPreview"
      :current-skill="currentSkill"
      @close="showSkillPreview = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { ProviderModels } from "../config/models"
import type { SavedPrompt, SkillItem, TargetDoc } from "@/types/ai"
import { computed, ref } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Tag from "@/components/Tag.vue"
import SkillSection from "./SkillSection.vue"
import SkillPreviewModal from "./SkillPreviewModal.vue"
import { getPromptPreview, truncateTitle } from "../utils"

interface QuickAction {
  key: "polish" | "expand" | "condense" | "fix" | "rewrite" | "summary"
  label: string
  icon: string
}

interface Props {
  isGenerating: boolean
  editTargetDoc: TargetDoc | null
  showPromptSelector: boolean
  currentPromptName: string
  savedPrompts: SavedPrompt[]
  paginatedPrompts: SavedPrompt[]
  editCustomInput: string
  skills: SkillItem[]
  currentSkill: SkillItem | null
  currentSkillIndex: number
  filteredSkills: SkillItem[]
  skillSearchQuery: string
  webSearch: boolean
  selectedModel: string
  customModel: string
  availableModels: ProviderModels
  supportsThinking: boolean
  enableThinking: boolean
  enableReview: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'ai-edit': [action: "polish" | "expand" | "condense" | "fix" | "rewrite" | "summary"]
  'stop': []
  'toggle-prompt-selector': []
  'clear-current-prompt': []
  'load-prompt': [index: number]
  'edit-prompt': [index: number]
  'delete-prompt': [index: number]
  'select-target-doc': []
  'select-target-block': []
  'clear-target-doc': []
  'custom-edit': []
  'update:editCustomInput': [value: string]
  'update:currentSkillIndex': [value: number]
  'update:skillSearchQuery': [value: string]
  'update:webSearch': [value: boolean]
  'update:selected-model': [value: string]
  'update:custom-model': [value: string]
  'update:enable-thinking': [value: boolean]
  'update:enable-review': [value: boolean]
}>()

const quickActions: QuickAction[] = [
  { key: "polish", label: "润色", icon: "#iconEdit" },
  { key: "expand", label: "扩写", icon: "#iconAdd" },
  { key: "condense", label: "精简", icon: "#iconMin" },
  { key: "fix", label: "纠错", icon: "#iconCheck" },
  { key: "rewrite", label: "改写", icon: "#iconRefresh" },
  { key: "summary", label: "总结", icon: "#iconList" },
]

// 技能预览弹窗状态
const showSkillPreview = ref(false)

/** 技能选择回调（桥接 SkillSection emit → 父组件 v-model） */
const onSkillSelect = (index: number) => {
  emit("update:currentSkillIndex", index)
}

/** 自定义编辑输入变更 */
const onEditCustomInputChange = (value: string | null) => {
  emit("update:editCustomInput", value ?? "")
}

// ===== Computed =====

const canExecute = computed(() => {
  if (props.currentSkillIndex >= 0) return true
  if (props.editTargetDoc) {
    return !!(props.editCustomInput.trim() || props.currentPromptName)
  }
  return false
})

const executeButtonTitle = computed(() => {
  if (!props.editTargetDoc && props.currentSkillIndex >= 0) return "发送提问"
  return !props.editCustomInput.trim() && props.currentPromptName
    ? "使用当前提示词生成"
    : "执行"
})

const inputPlaceholder = computed(() => {
  if (!props.editTargetDoc && props.currentSkillIndex >= 0) return "输入你的问题..."
  return "输入编辑指令，或选择AI快捷操作..."
})

const getOriginalIndex = (prompt: SavedPrompt) => {
  return props.savedPrompts.findIndex((p) => p.id === prompt.id)
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;
@use "./styles/BottomInputArea.scss" as *;
</style>
