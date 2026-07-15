<template>
  <div class="ai-content-panel">
    <!-- 顶部工具栏 -->
    <PanelHeader />

    <!-- 内容显示区域 -->
    <div class="content-display-section">
      <MainContentArea
        :is-generating="isGenerating"
        :is-applying="isApplying"
        :is-undoing="isUndoing"
        :is-inserting-sub-doc="isInsertingSubDoc"
        :error-message="errorMessage"
        :displayed-content="displayedContent"
        :generated-content="generatedContent"
        :rendered-markdown="renderedDisplayedMarkdown"
        :original-content="originalContent"
        :search-results="searchResults"
        :show-search-results="showSearchResults"
        :search-status="searchStatus"
        :reasoning-content="reasoningContent"
        :show-reasoning="showReasoning"
        :generation-elapsed="generationElapsed"
        :is-reviewing="isReviewing"
        :review-result="reviewResult"
        :is-auto-fixing="isAutoFixing"
        :can-apply="canApplyEdit"
        :can-insert-sub-doc="canInsertSubDoc"
        :can-undo="canUndoEdit"
        @stop="handleStop"
        @apply-edit="applyEdit"
        @insert-subdoc="insertSubDocument"
        @undo-edit="undoEdit"
        @copy="copyContent"
        @clear="clearContent"
        @toggle-reasoning="showReasoning = !showReasoning"
        @auto-fix="handleAutoFix"
        :conversation-count="conversationHistory.length"
        :has-content="hasContent"
        :generation-tip="generationTip"
        @re-review="handleReReview"
        @fix-issue="handleFixIssue"
        @clear-conversation="clearConversation"
      />
    </div>

    <!-- 底部输入区域 -->
    <BottomInputArea
      :is-generating="isGenerating"
      :edit-target-doc="editTargetDoc"
      :edit-custom-input="editCustomInput"
      :skills="skills"
      :current-skill="currentSkill"
      :current-skill-index="currentSkillIndex"
      :filtered-skills="filteredSkills"
      :skill-search-query="skillSearchQuery"
      :web-search="webSearch"
      :selected-model="selectedModel"
      :custom-model="customModel"
      :available-models="availableModels"
      :supports-thinking="supportsThinking"
      :enable-thinking="enableThinking"
      :enable-review="enableReview"
      @ai-edit="aiEditAction"
      @stop="handleStop"
      @select-target-doc="selectTargetDocument"
      @select-target-block="selectTargetBlock"
      @clear-target-doc="clearTargetDocument"
      @custom-edit="handleCustomEdit"
      @update:edit-custom-input="editCustomInput = $event"
      @update:current-skill-index="currentSkillIndex = $event"
      @update:skill-search-query="skillSearchQuery = $event"
      @update:web-search="webSearch = $event"
      @update:selected-model="selectedModel = $event"
      @update:custom-model="customModel = $event"
      @update:enable-thinking="enableThinking = $event"
      @update:enable-review="enableReview = $event"
    />
  </div>
</template>

<script setup lang="ts">
// 核心导入
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue"
import type { Plugin } from "siyuan"
import { showMessage } from "siyuan"
import hljs from "highlight.js"
import "highlight.js/styles/github.css"

// 类型
import type { GenerateOptions, ReviewResult, TargetDoc } from "@/types/ai"

// 模块内部导入
import { AIGeneratorStorage } from "./types/storage"
import { useSkillsLoader } from "./composables/useSkillsLoader"
import { useGeneration, buildSkillSystemPrompt } from "./composables/useGeneration"
import { useReview } from "./composables/useReview"
import { useEditOperations } from "./composables/useEditOperations"
import { useDocumentTarget } from "./composables/useDocumentTarget"
import { renderMarkdown } from "./utils"

// 组件
import PanelHeader from "./components/PanelHeader.vue"
import MainContentArea from "./components/MainContentArea.vue"
import BottomInputArea from "./components/BottomInputArea.vue"

// ============ Props ============

interface Props {
  i18n: Record<string, string>
  plugin: Plugin
  onGenerate: (options: GenerateOptions) => Promise<string>
  onReview?: (
    userRequest: string,
    generatedContent: string,
    skill?: {
      name: string; description: string; content: string
      tool: string; sources: Array<{ id: string; tool: string; content: string }>; id: string
    },
  ) => Promise<ReviewResult>
}

const props = withDefaults(defineProps<Props>(), {})
const storage = ref<AIGeneratorStorage | null>(null)

// ============ 顶层独立状态（供多个 composable 共享）============

const selectedModel = ref("")
const customModel = ref("")
const enableThinking = ref(false)
const webSearch = ref(false)

const resolvedModel = computed(() =>
  selectedModel.value === "custom" ? customModel.value : selectedModel.value,
)

// 编辑模式共享状态
const editTargetDoc = ref<TargetDoc | null>(null)
const originalContent = ref("")
const editCustomInput = ref("")

// ============ 1. 技能加载 ============

const {
  skills, currentSkillIndex, currentSkill, loadSkills,
  skillSearchQuery, filteredSkills,
} = useSkillsLoader(props.plugin)

// ============ 1. 生成管道 ============

// 审核后回调（需要在 useGeneration 创建后传递给 useReview，此处预声明）
let onAfterGenerateCallback: (() => void) | null = null

const gen = useGeneration({
  enableThinking, webSearch, selectedModel, customModel, resolvedModel,
  currentSkill, editTargetDoc, editCustomInput,
  plugin: props.plugin,
  onGenerate: props.onGenerate,
  onAfterGenerate: () => onAfterGenerateCallback?.(),
})

const {
  generatedContent, displayedContent, isGenerating, errorMessage,
  generationElapsed, generationTip, reasoningContent, showReasoning,
  searchStatus, searchResults, showSearchResults, conversationHistory,
  availableModels, supportsThinking,
  handleStop, buildGenerateOptions, executeGeneration, clearConversation, cleanupRaf,
} = gen

const hasContent = computed(() => !!generatedContent.value)

// ============ 4. 编辑操作 ============

const editOps = useEditOperations({
  editTargetDoc, originalContent, generatedContent,
  displayedContent, errorMessage, generationElapsed,
})

const {
  isApplying, isUndoing, isInsertingSubDoc,
  canUndoEdit,
  clearContent, clearTargetDocument,
  copyContent, applyEdit, undoEdit, insertSubDocument,
} = editOps

// ============ 5. 文档/块目标选择 ============

const docTarget = useDocumentTarget({
  editTargetDoc, originalContent, generatedContent, displayedContent,
  onClearCustomInput: () => { editCustomInput.value = "" },
})

const { selectTargetDocument, selectTargetBlock, loadTargetDocument } = docTarget

// ============ 6. 审核系统 ============

const reviewDeps = {
  generatedContent,
  currentSkill,
  editTargetDoc,
  editCustomInput,
  executeGeneration,
  buildGenerateOptions,
  onReview: props.onReview || (async () => ({ rating: "良好" as const, summary: "", issues: [], suggestions: [], reviewModel: "", reviewedAt: Date.now() })),
}

const review = useReview(reviewDeps)

const {
  enableReview, isReviewing, reviewResult, isAutoFixing,
  performReview, handleAutoFix, handleReReview, handleFixIssue,
} = review

// 连接审核后回调
onAfterGenerateCallback = () => performReview()

// 编辑可用性计算（依赖审核状态，须在 useReview 之后定义）
const canApplyEdit = computed(() =>
  !!editTargetDoc.value && !isApplying.value && !isGenerating.value && !isReviewing.value && !isAutoFixing.value,
)
const canInsertSubDoc = computed(() =>
  !!editTargetDoc.value && !isInsertingSubDoc.value && !isGenerating.value,
)

// ============ 2. 视图层逻辑 ============

// Markdown 渲染
const renderedDisplayedMarkdown = computed(() => renderMarkdown(displayedContent.value))

// 代码高亮
const applyCodeHighlighting = async (selector: string) => {
  await nextTick()
  const preBlocks = document.querySelectorAll(selector)
  preBlocks.forEach((block) => {
    if (!(block as HTMLElement).dataset.highlighted) {
      hljs.highlightElement(block as HTMLElement)
    }
  })
}

watch(renderedDisplayedMarkdown, () =>
  applyCodeHighlighting(".markdown-preview pre code"),
)

// ============ AI 编辑动作（薄壳包装，调用 composable 核心）============

const actionPrompts: Record<string, string> = {
  polish: "请对以下文档进行润色优化，保持原有结构，提升语言质量和可读性，使表达更加专业、流畅。保持Markdown格式，直接输出优化后的完整文档内容：",
  expand: "请对以下文档进行扩写，增加更详细的说明、例子和补充信息，使内容更加丰富和全面。保持Markdown格式，直接输出扩写后的完整文档内容：",
  condense: "请对以下文档进行精简，去除冗余内容，保留核心要点，使表达更加简洁有力。保持Markdown格式，直接输出精简后的完整文档内容：",
  fix: "请对以下文档进行错误检查和修正，包括拼写错误、语法错误、逻辑错误等。保持Markdown格式，直接输出修正后的完整文档内容：",
  rewrite: "请用不同的表达方式重写以下文档，保持核心意思不变，但使用全新的语言风格和句式结构。保持Markdown格式，直接输出改写后的完整文档内容：",
  summary: "请为以下文档生成一个简洁的总结，包括主要内容和关键要点。总结应该清晰明了，突出文档的核心信息。保持Markdown格式，直接输出总结内容：",
}

const aiEditAction = async (
  action: "polish" | "expand" | "condense" | "fix" | "rewrite" | "summary",
) => {
  if (!editTargetDoc.value) {
    showMessage("请先选择要编辑的文档", 2000, "info")
    return
  }

  const systemPromptText = buildSkillSystemPrompt(
    currentSkill.value,
    "你是一个专业的文档编辑助手，擅长优化Markdown文档。请直接输出优化后的完整文档，不要添加任何解释性文字。",
  )

  await executeGeneration("AI编辑", () =>
    buildGenerateOptions(
      `${actionPrompts[action]}\n\n${editTargetDoc.value!.content}`,
      systemPromptText,
    ),
  )
}

const handleCustomEdit = async () => {
  if (!editTargetDoc.value && !currentSkill.value) {
    showMessage("请先选择要编辑的文档或选择技能", 2000, "info")
    return
  }

  if (!editCustomInput.value.trim()) {
    if (!(editTargetDoc.value && currentSkill.value)) {
      showMessage("请输入提问内容", 2000, "info")
      return
    }
  }

  await executeGeneration("自定义编辑", () => {
    let finalSystemPrompt: string
    let userInput: string

    if (!editTargetDoc.value) {
      finalSystemPrompt = currentSkill.value!.content
      userInput = editCustomInput.value
    } else {
      let baseSystemPrompt: string
      if (currentSkill.value) {
        baseSystemPrompt = currentSkill.value.content
      } else {
        baseSystemPrompt = "你是一个专业的文档编辑助手，擅长根据用户指令优化Markdown文档。请直接输出编辑后的完整文档，不要添加任何解释性文字。"
      }

      if (editCustomInput.value.trim()) {
        userInput = `请根据以下指令对文档进行编辑。保持Markdown格式，直接输出编辑后的完整文档内容：

编辑指令：${editCustomInput.value}

原文档：
${editTargetDoc.value.content}`
      } else {
        userInput = `${editTargetDoc.value.content}`
      }
      finalSystemPrompt = baseSystemPrompt
    }

    return buildGenerateOptions(userInput, finalSystemPrompt, editCustomInput.value.trim() || undefined)
  }, () => {
    editCustomInput.value = ""
  })
}

// ============ 设置持久化 ============

let isSettingsLoaded = false
let settingsSaveTimer: number | null = null
const SETTINGS_SAVE_DEBOUNCE_MS = 300

const saveSettings = async () => {
  if (!storage.value || !isSettingsLoaded) return
  const settings = {
    model: selectedModel.value,
    customModel: customModel.value,
    enableThinking: enableThinking.value,
    webSearch: webSearch.value,
  }
  try {
    await storage.value.settings.save(settings)
  } catch (error) {
    console.error("保存设置失败:", error)
  }
}

const loadSettings = async () => {
  if (!storage.value) return
  try {
    const settings = await storage.value.settings.load()
    if (settings) {
      selectedModel.value = settings.model || ""
      customModel.value = settings.customModel || ""
      enableThinking.value = settings.enableThinking ?? false
      webSearch.value = settings.webSearch ?? false
    }
    isSettingsLoaded = true
  } catch (error) {
    console.error("从插件存储加载设置失败:", error)
  }
}

watch(
  [selectedModel, customModel, enableThinking, webSearch],
  () => {
    if (settingsSaveTimer) clearTimeout(settingsSaveTimer)
    settingsSaveTimer = window.setTimeout(() => saveSettings(), SETTINGS_SAVE_DEBOUNCE_MS)
  },
)

// ============ 生命周期 ============

onMounted(async () => {
  if (props.plugin) {
    storage.value = new AIGeneratorStorage(props.plugin)
    await storage.value.init()
    await loadSettings()
  }
  loadSkills()
})

onUnmounted(() => {
  cleanupRaf()
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
