<!-- 底部输入区域组件：文档选择器、技能选择、快捷操作、模型选项、自定义输入 -->
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
          <!-- 按钮：文档选择（title："选择文档"） -->
          <Button
            variant="ghost"
            size="xsmall"
            icon="file"
            :title="editTargetDoc && !editTargetDoc.isBlock ? editTargetDoc.title : i18n.docSelectTitle"
            @click="$emit('selectTargetDoc')"
          >
            <span class="doc-name">{{ editTargetDoc && !editTargetDoc.isBlock ? truncateTitle(editTargetDoc.title) : i18n.docSelectTitle }}</span>
          </Button>
          <!-- 按钮：块选择（title："选择块"） -->
          <Button
            variant="ghost"
            size="xsmall"
            icon="edit"
            :title="editTargetDoc?.isBlock ? editTargetDoc.title : i18n.blockSelectTitle"
            @click="$emit('selectTargetBlock')"
          >
            <span class="doc-name">{{ editTargetDoc?.isBlock ? truncateTitle(editTargetDoc.title) : i18n.blockSelectTitle }}</span>
          </Button>
          <!-- 标签："块" -->
          <Tag
            v-if="editTargetDoc?.isBlock"
            size="xsmall"
            variant="primary"
          >{{ i18n.blockTag }}</Tag>
          <!-- 纯图标按钮：清除选择（ariaLabel："清除"） -->
          <Button
            v-if="editTargetDoc"
            variant="ghost"
            size="xsmall"
            icon="close"
            :aria-label="i18n.clearTitle"
            @click="$emit('clearTargetDoc')"
          />
        </div>
      </div>

      <!-- 技能选择 -->
      <div class="top-bar-center">
        <SkillSection
          :i18n="i18n"
          :current-skill-index="currentSkillIndex"
          :current-skill="currentSkill"
          :skills="skills"
          @selectSkill="onSkillSelect"
          @showPreview="showSkillPreview = true"
        />
      </div>

      <!-- RAG 联网搜索 -->
      <div class="top-bar-right">
        <!-- 开关："联网"（title："RAG联网搜索：先搜后答，获取最新信息"） -->
        <Switch
          size="xsmall"
          :model-value="webSearch"
          :title="i18n.webSearchTitle"
          @update:model-value="$emit('update:webSearch', $event)"
        >
          <IconWrapper
            name="search"
            :size="12"
          />
          <span>{{ i18n.webSearchLabel }}</span>
        </Switch>
      </div>
    </div>

    <!-- 第二行：AI 快捷操作 -->
    <div
      v-if="editTargetDoc"
      class="quick-actions-bar"
    >
      <Button
        v-for="action in quickActions"
        :key="action.key"
        variant="ghost"
        size="xsmall"
        :icon="action.icon"
        :disabled="isGenerating"
        :title="action.label"
        @click="$emit('aiEdit', action.key)"
      >
        {{ action.label }}
      </Button>
    </div>

    <!-- 选项行：模型选择 + 思考 + 审核 -->
    <div class="options-bar">
      <!-- 自定义模型名输入（模型选择为"自定义..."时显示） -->
      <Input
        v-if="selectedModel === 'custom'"
        class="model-custom-input"
        size="xsmall"
        :model-value="customModel"
        :placeholder="i18n.modelCustomPlaceholder"
        @update:model-value="$emit('update:customModel', String($event ?? ''))"
      />
      <!-- 模型下拉（默认模型 / 常用分组 / 全部 / 自定义...） -->
      <Select
        v-else
        class="model-select"
        size="xsmall"
        placement="top"
        :model-value="selectedModel"
        :options="modelOptions"
        :placeholder="i18n.modelDefault"
        @update:model-value="$emit('update:selectedModel', String($event ?? ''))"
      />
      <!-- 开关："思考"（title："思考模式"） -->
      <Switch
        v-if="supportsThinking"
        size="xsmall"
        :model-value="enableThinking"
        :title="i18n.thinkingTitle"
        @update:model-value="$emit('update:enableThinking', $event)"
      >
        {{ i18n.thinkingLabel }}
      </Switch>
      <!-- 思考强度选择：仅思考模式开启时显示，取值为 DeepSeek 官方 low/high/max -->
      <Select
        v-if="supportsThinking && enableThinking"
        class="reasoning-effort-select"
        size="xsmall"
        placement="top"
        :model-value="reasoningEffort"
        :options="reasoningEffortOptions"
        :title="i18n.reasoningEffortTitle"
        @update:model-value="onReasoningEffortChange"
      />
      <!-- 开关："审核"（title："生成后使用 V4 Pro 交叉审核"） -->
      <Switch
        size="xsmall"
        :model-value="enableReview"
        :title="i18n.reviewToggleTitle"
        @update:model-value="$emit('update:enableReview', $event)"
      >
        {{ i18n.reviewToggleLabel }}
      </Switch>
    </div>

    <!-- 第三行：输入框 + 执行按钮 -->
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
        @keydown.ctrl.enter="$emit('customEdit')"
      />
      <!-- 按钮：执行（title 随场景为"执行"或"发送提问"） -->
      <Button
        v-if="!isGenerating"
        variant="primary"
        size="xsmall"
        icon="sparkles"
        :disabled="!canExecute"
        :title="executeButtonTitle"
        class="execute-btn"
        @click="$emit('customEdit')"
      />
      <!-- 纯图标按钮：停止生成（ariaLabel："停止生成"） -->
      <Button
        v-else
        variant="danger"
        size="xsmall"
        icon="close"
        :aria-label="i18n.stopGenerating"
        class="execute-btn"
        @click="$emit('stop')"
      />
    </div>

    <!-- 技能细则预览弹窗 -->
    <SkillPreviewModal
      v-if="showSkillPreview"
      :i18n="i18n"
      :current-skill="currentSkill"
      @close="showSkillPreview = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { SelectGroupOption, SelectOption } from "@/components/Select.vue"
import type { ProviderModels } from "@/config/aiModels"
import type { DeepSeekReasoningEffort, SkillItem, TargetDoc } from "@/types/ai"
import { computed, ref } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import Switch from "@/components/Switch.vue"
import Tag from "@/components/Tag.vue"
import SkillSection from "./SkillSection.vue"
import SkillPreviewModal from "./SkillPreviewModal.vue"
import { truncateTitle } from "../utils"
import { ACTION_META } from "../types"
import type { EditActionKey } from "../types"

interface Props {
  /** 国际化文案 */
  i18n: Record<string, string>
  isGenerating: boolean
  editTargetDoc: TargetDoc | null
  editCustomInput: string
  skills: SkillItem[]
  currentSkill: SkillItem | null
  currentSkillIndex: number
  webSearch: boolean
  selectedModel: string
  customModel: string
  availableModels: ProviderModels
  supportsThinking: boolean
  enableThinking: boolean
  /** 思考强度（DeepSeek 思考模式：low/high/max） */
  reasoningEffort: DeepSeekReasoningEffort
  enableReview: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'aiEdit': [action: EditActionKey]
  'stop': []
  'selectTargetDoc': []
  'selectTargetBlock': []
  'clearTargetDoc': []
  'customEdit': []
  'update:editCustomInput': [value: string]
  'update:currentSkillIndex': [value: number]
  'update:webSearch': [value: boolean]
  'update:selectedModel': [value: string]
  'update:customModel': [value: string]
  'update:enableThinking': [value: boolean]
  'update:reasoningEffort': [value: DeepSeekReasoningEffort]
  'update:enableReview': [value: boolean]
}>()

/** 快捷动作按钮：文案与图标均来自 ACTION_META 单一数据源 */
const quickActions = computed(() =>
  (Object.keys(ACTION_META) as EditActionKey[]).map((key) => ({
    key,
    label: props.i18n[ACTION_META[key].labelKey],
    icon: ACTION_META[key].icon,
  })),
)

/** 模型下拉选项：默认模型 + 常用分组 + 全部分组 + 自定义（空分组不渲染） */
const modelOptions = computed<Array<SelectOption | SelectGroupOption>>(() => {
  const options: Array<SelectOption | SelectGroupOption> = [
    { value: "", label: props.i18n.modelDefault },
  ]
  if (props.availableModels.common.length > 0) {
    options.push({
      isGroup: true,
      label: props.i18n.modelGroupCommon,
      options: props.availableModels.common.map((m) => ({ value: m.value, label: m.label })),
    })
  }
  if (props.availableModels.all.length > 0) {
    options.push({
      isGroup: true,
      label: props.i18n.modelGroupAll,
      options: props.availableModels.all.map((m) => ({ value: m.value, label: m.label })),
    })
  }
  options.push({ value: "custom", label: props.i18n.modelCustom })
  return options
})

/** 思考强度选项（DeepSeek 官方 low/high/max） */
const reasoningEffortOptions = computed<SelectOption[]>(() => [
  { value: "low", label: props.i18n.reasoningEffortLow },
  { value: "high", label: props.i18n.reasoningEffortHigh },
  { value: "max", label: props.i18n.reasoningEffortMax },
])

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

/** 思考强度变更（Select 值为 string | number | boolean | null，收敛为 DeepSeek 官方枚举） */
const onReasoningEffortChange = (value: string | number | boolean | null) => {
  emit("update:reasoningEffort", String(value ?? "high") as DeepSeekReasoningEffort)
}

// ===== Computed =====

// 与 index.vue handleCustomEdit 校验保持一致：有文档时（技能在 或 输入非空）可执行；无文档时必须有技能且输入非空
const canExecute = computed(() => {
  const hasSkill = props.currentSkillIndex >= 0
  const hasInput = !!props.editCustomInput.trim()
  if (props.editTargetDoc) {
    return hasSkill || hasInput
  }
  return hasSkill && hasInput
})

const executeButtonTitle = computed(() => {
  if (!props.editTargetDoc && props.currentSkillIndex >= 0) return props.i18n.executeSendQuestion
  return props.i18n.executeRun
})

const inputPlaceholder = computed(() => {
  if (!props.editTargetDoc && props.currentSkillIndex >= 0) return props.i18n.inputPlaceholderQuestion
  return props.i18n.inputPlaceholderEdit
})
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;
@use "./styles/BottomInputArea.scss" as *;
</style>
