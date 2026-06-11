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
        <div
          class="skill-selector-wrapper"
          :class="{ open: showSkillDropdown }"
        >
          <div
            class="skill-select-trigger"
            title="选择预设技能作为系统指令"
            @click="toggleSkillDropdown"
          >
            <span class="skill-select-value">
              <template v-if="currentSkillIndex >= 0 && currentSkill">
                {{ currentSkill.name }}
                <span class="skill-source-dots">
                  <span
                    v-for="(color, i) in getSourceDotColors(currentSkill)"
                    :key="i"
                    class="source-dot"
                    :style="{ background: color }"
                  ></span>
                </span>
              </template>
              <template v-else>🧠 无技能</template>
            </span>
            <svg
              class="skill-select-arrow"
              width="10"
              height="10"
            ><use xlink:href="#iconDown"></use></svg>
          </div>
          <!-- 下拉面板 -->
          <div
            v-if="showSkillDropdown"
            class="skill-dropdown"
          >
            <div class="skill-dropdown-search">
              <svg
                width="12"
                height="12"
              ><use xlink:href="#iconSearch"></use></svg>
              <input
                ref="skillSearchInputRef"
                :value="skillSearchQuery"
                type="text"
                placeholder="搜索技能..."
                class="skill-search-input"
                @input="onSkillSearchInput($event)"
                @keydown.escape.stop="showSkillDropdown = false"
              />
            </div>
            <div class="skill-dropdown-list">
              <div
                class="skill-dropdown-item"
                :class="{ active: currentSkillIndex === -1 }"
                @click="selectSkill(-1)"
              >
                🧠 无技能
              </div>
              <div
                v-for="skill in filteredSkills"
                :key="skill.id"
                class="skill-dropdown-item"
                :class="{ active: currentSkill && currentSkill.id === skill.id }"
                @click="selectSkillByItem(skill)"
              >
                <div class="skill-item-main">
                  <span class="skill-item-name">{{ skill.name }}</span>
                  <span class="skill-source-dots">
                    <span
                      v-for="(color, i) in getSourceDotColors(skill)"
                      :key="i"
                      class="source-dot"
                      :style="{ background: color }"
                    ></span>
                  </span>
                </div>
              </div>
              <div
                v-if="filteredSkills.length === 0"
                class="skill-dropdown-empty"
              >
                无匹配技能
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 提示词选择 -->
      <div class="top-bar-right">
        <!-- RAG 联网搜索开关 -->
        <label
          class="rag-toggle"
          :class="{ active: webSearch }"
          title="RAG联网搜索：先搜后答，获取最新信息"
        >
          <svg
            width="12"
            height="12"
          ><use xlink:href="#iconSearch"></use></svg>
          <input
            type="checkbox"
            :checked="webSearch"
            @change="$emit('update:webSearch', ($event.target as HTMLInputElement).checked)"
          />
          <span>联网</span>
        </label>

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

    <!-- 选项行：模型选择 + 思考 + 审核 -->
    <div class="options-bar">
      <!-- 自定义模型输入 -->
      <input
        v-if="selectedModel === 'custom'"
        class="model-custom-input"
        :value="customModel"
        placeholder="输入模型名..."
        @input="$emit('update:custom-model', ($event.target as HTMLInputElement).value)"
      />
      <!-- 模型选择下拉 -->
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
      <!-- 思考模式开关 -->
      <label v-if="supportsThinking" class="thinking-toggle" title="思考模式">
        <input type="checkbox" :checked="enableThinking" @change="$emit('update:enable-thinking', ($event.target as HTMLInputElement).checked)" />
        <span class="thinking-label">思考</span>
      </label>
      <!-- 审核开关 -->
      <label class="review-toggle" title="生成后使用 V4 Pro 交叉审核">
        <input type="checkbox" :checked="enableReview" @change="$emit('update:enable-review', ($event.target as HTMLInputElement).checked)" />
        <span class="review-label">
          <svg width="11" height="11"><use xlink:href="#iconCheck" /></svg>审核
        </span>
      </label>
    </div>

    <!-- 第三行：输入框 + 执行按钮（已选择文档或技能时显示） -->
    <div
      v-if="editTargetDoc || currentSkillIndex >= 0"
      class="input-row"
    >
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
  SkillItem,
  TargetDoc,
} from "@/types/ai"
import type { ProviderModels } from "../config/models"
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Tag from "@/components/Tag.vue"
import {
  getPromptPreview,
  getSourceDotColors,
  truncateTitle,
} from "../utils"

interface QuickAction {
  key: "polish" | "expand" | "condense" | "fix" | "rewrite" | "summary"
  label: string
  icon: string
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
  currentSkill: SkillItem | null
  currentSkillIndex: number
  filteredSkills: SkillItem[]
  skillSearchQuery: string
  webSearch: boolean
  // 模型与选项
  selectedModel: string
  customModel: string
  availableModels: ProviderModels
  supportsThinking: boolean
  enableThinking: boolean
  enableReview: boolean
}

// 技能下拉面板状态
const showSkillDropdown = ref(false)
const skillSearchInputRef = ref<HTMLInputElement | null>(null)

const toggleSkillDropdown = () => {
  showSkillDropdown.value = !showSkillDropdown.value
  if (showSkillDropdown.value) {
    nextTick(() => {
      skillSearchInputRef.value?.focus()
    })
  }
}

const selectSkill = (index: number) => {
  emit("update:currentSkillIndex", index)
  showSkillDropdown.value = false
}

/** 通过技能对象选择（在 filteredSkills 中找到 skills 中的索引） */
const selectSkillByItem = (skill: SkillItem) => {
  const index = props.skills.findIndex((s) => s.id === skill.id)
  emit("update:currentSkillIndex", index)
  showSkillDropdown.value = false
}

/** 技能搜索输入 */
const onSkillSearchInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value
  emit("update:skillSearchQuery", value)
}

/** 自定义编辑输入变更 */
const onEditCustomInputChange = (value: string | null) => {
  emit("update:editCustomInput", value ?? "")
}

// 点击外部关闭技能下拉
const handleClickOutside = (e: MouseEvent) => {
  const wrapper = document.querySelector(".skill-selector-wrapper")
  if (wrapper && !wrapper.contains(e.target as Node)) {
    showSkillDropdown.value = false
  }
}
onMounted(() => document.addEventListener("click", handleClickOutside))
onUnmounted(() => document.removeEventListener("click", handleClickOutside))

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


// 获取原始索引
const getOriginalIndex = (prompt: SavedPrompt) => {
  return props.savedPrompts.findIndex((p) => p.id === prompt.id)
}

</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;

// ============ RAG 联网搜索开关 ============
.rag-toggle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;

  svg {
    opacity: 0.5;
  }

  input[type="checkbox"] {
    display: none;
  }

  span {
    opacity: 0.7;
  }

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &.active {
    color: var(--b3-theme-primary);
    background: rgba(var(--b3-theme-primary-rgb, 53, 125, 221), 0.08);
    border-color: var(--b3-theme-primary);

    svg {
      opacity: 1;
      color: var(--b3-theme-primary);
    }

    span {
      opacity: 1;
      font-weight: 500;
    }
  }
}

// ============ 技能选择器 ============
.skill-selector-wrapper {
  display: flex;
  align-items: center;
  position: relative;
}

.skill-select-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--b3-theme-on-background);
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 5px;
  cursor: pointer;
  max-width: 180px;
  overflow: hidden;
  white-space: nowrap;

  &:hover {
    border-color: var(--b3-theme-primary);
  }
}

.skill-selector-wrapper.open .skill-select-trigger {
  border-color: var(--b3-theme-primary);
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.skill-select-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-source-dots {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
}

.source-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skill-select-arrow {
  flex-shrink: 0;
  transition: transform 0.2s;
}

.skill-selector-wrapper.open .skill-select-arrow {
  transform: rotate(180deg);
}

// ============ 选项行（模型选择 + 思考 + 审核） ============
.options-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
}

.model-select {
  padding: 2px 6px;
  font-size: 10px;
  color: var(--b3-theme-on-background);
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  cursor: pointer;
  max-width: 120px;
  outline: none;

  &:hover { border-color: var(--b3-theme-primary); }
  &:focus { border-color: var(--b3-theme-primary); box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest); }
}

.model-custom-input {
  padding: 2px 6px;
  font-size: 10px;
  color: var(--b3-theme-on-background);
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  outline: none;
  max-width: 100px;

  &:hover { border-color: var(--b3-theme-primary); }
  &:focus { border-color: var(--b3-theme-primary); box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest); }
  &::placeholder { color: var(--b3-theme-on-surface); opacity: 0.4; }
}

.thinking-toggle, .review-toggle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;

  input[type="checkbox"] { width: 12px; height: 12px; cursor: pointer; }
  &:hover { background: var(--b3-theme-surface); }
}

.thinking-toggle input[type="checkbox"] { accent-color: var(--b3-theme-primary); }
.review-toggle input[type="checkbox"] { accent-color: var(--b3-theme-success); }

.thinking-label {
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}
.thinking-toggle input:checked + .thinking-label {
  color: var(--b3-theme-primary); opacity: 1; font-weight: 500;
}

.review-label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  svg { color: var(--b3-theme-success); }
}
.review-toggle input:checked + .review-label {
  color: var(--b3-theme-success); opacity: 1; font-weight: 500;
}
</style>
