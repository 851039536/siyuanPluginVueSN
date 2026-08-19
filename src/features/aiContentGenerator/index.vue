<template>
  <div ref="panelRoot" class="ai-content-panel">
    <!-- 内容显示区域 -->
    <div class="content-display-section">
      <MainContentArea
        :i18n="i18n"
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
        :conversation-count="Math.floor(conversationHistory.length / 2)"
        :generation-tip="generationTip"
        @stop="handleStop"
        @applyEdit="handleApplyEdit"
        @insertSubdoc="insertSubDocument"
        @undoEdit="handleUndoEdit"
        @copy="copyContent"
        @clear="handleClearAll"
        @toggleReasoning="showReasoning = !showReasoning"
        @autoFix="handleAutoFix"
        @reReview="handleReReview"
        @directReview="handleDirectReview"
        @fixIssue="handleFixIssue"
        @clearConversation="clearConversation"
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
      :web-search="webSearch"
      :selected-model="selectedModel"
      :custom-model="customModel"
      :available-models="availableModels"
      :supports-thinking="supportsThinking"
      :enable-thinking="enableThinking"
      :reasoning-effort="reasoningEffort"
      :enable-review="enableReview"
      @aiEdit="aiEditAction"
      @stop="handleStop"
      @selectTargetDoc="selectTargetDocument"
      @selectTargetBlock="selectTargetBlock"
      @clearTargetDoc="clearTargetDocument"
      @customEdit="handleCustomEdit"
      @update:editCustomInput="editCustomInput = $event"
      @update:currentSkillIndex="currentSkillIndex = $event"
      @update:webSearch="webSearch = $event"
      @update:selectedModel="selectedModel = $event"
      @update:customModel="customModel = $event"
      @update:enableThinking="enableThinking = $event"
      @update:reasoningEffort="reasoningEffort = $event"
      @update:enableReview="enableReview = $event"
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
import type { DeepSeekReasoningEffort, GenerateOptions, ReviewResult, SkillItem, TargetDoc } from "@/types/ai"
import { DEFAULT_SYSTEM_PROMPTS } from "./types"
import type { EditActionKey, ScanSkillsFn } from "./types"

// 模块内部导入
import { AIGeneratorStorage } from "./types/storage"
import { useSkillsLoader } from "./composables/useSkillsLoader"
import { useGeneration } from "./composables/useGeneration"
import { useReview } from "./composables/useReview"
import { useEditOperations } from "./composables/useEditOperations"
import { useDocumentTarget } from "./composables/useDocumentTarget"
import { buildSkillSystemPrompt, renderMarkdown } from "./utils"
import MainContentArea from "./components/MainContentArea.vue"
import BottomInputArea from "./components/BottomInputArea.vue"

// ============ Props ============

interface Props {
  i18n: Record<string, string>
  plugin: Plugin
  onGenerate: (options: GenerateOptions) => Promise<string>
  /** 交叉审核回调（modules 侧 addDock 始终注入） */
  onReview: (userRequest: string, generatedContent: string, skill?: SkillItem) => Promise<ReviewResult>
  /** 技能扫描回调（modules 侧仅在注入时透传，故为可选） */
  scanSkills?: ScanSkillsFn
}

const props = defineProps<Props>()
const storage = ref<AIGeneratorStorage | null>(null)
/** 面板根容器引用（代码高亮等 DOM 查询限定在面板内，避免误伤 Teleport 到 body 的弹窗） */
const panelRoot = ref<HTMLElement | null>(null)

// ============ 顶层独立状态（供多个 composable 共享）============

const selectedModel = ref("")
const customModel = ref("")
const enableThinking = ref(false)
/** 思考强度（DeepSeek 思考模式：low/high/max，默认 high） */
const reasoningEffort = ref<DeepSeekReasoningEffort>("high")
const webSearch = ref(false)

const resolvedModel = computed(() =>
  selectedModel.value === "custom" ? customModel.value : selectedModel.value,
)

// 编辑模式共享状态
const editTargetDoc = ref<TargetDoc | null>(null)
const originalContent = ref("")
const editCustomInput = ref("")

// ============ 技能加载 ============

const {
  skills, currentSkillIndex, currentSkill, loadSkills, restoreSkillById,
} = useSkillsLoader(props.plugin, props.scanSkills)

// ============ 生成管道 ============

// 审核后回调（需要在 useGeneration 创建后传递给 useReview，此处预声明）
let onAfterGenerateCallback: ((reviewUserRequest?: string) => void) | null = null

const gen = useGeneration({
  enableThinking, reasoningEffort, webSearch, selectedModel, customModel, resolvedModel,
  currentSkill, editTargetDoc, editCustomInput,
  plugin: props.plugin,
  onGenerate: props.onGenerate,
  onAfterGenerate: (reviewUserRequest?: string) => onAfterGenerateCallback?.(reviewUserRequest),
})

const {
  generatedContent, displayedContent, isGenerating, errorMessage,
  generationElapsed, generationTip, reasoningContent, showReasoning,
  searchStatus, searchResults, conversationHistory,
  availableModels, supportsThinking,
  handleStop, buildGenerateOptions, executeGeneration, clearConversation, cleanupRaf,
  refreshProvider, clearDisplayState,
} = gen

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

const { selectTargetDocument, selectTargetBlock } = docTarget

// ============ 审核系统 ============

const reviewDeps = {
  generatedContent,
  currentSkill,
  editTargetDoc,
  editCustomInput,
  executeGeneration,
  buildGenerateOptions,
  onReview: props.onReview,
}

const { enableReview, isReviewing, reviewResult, isAutoFixing,
  performReview, handleAutoFix, handleReReview, handleFixIssue,
  clearReviewState } = useReview(reviewDeps)

onAfterGenerateCallback = performReview

/** 「直接审查」按钮：跳过 enableReview 开关强制对当前内容发起审核 */
const handleDirectReview = () => {
  performReview(undefined, true)
}

// 应用/撤回编辑后旧审核结果必然失效：清空审核态，避免拿旧 review 评价新内容
const handleApplyEdit = async () => {
  await applyEdit()
  clearReviewState()
}

const handleUndoEdit = async () => {
  await undoEdit()
  clearReviewState()
}

// 编辑可用性计算（依赖审核状态，须在 useReview 之后定义）
const canApplyEdit = computed(() =>
  !!editTargetDoc.value && !isApplying.value && !isGenerating.value && !isReviewing.value && !isAutoFixing.value,
)
const canInsertSubDoc = computed(() =>
  !!editTargetDoc.value && !isInsertingSubDoc.value && !isGenerating.value,
)

// ============ 视图层逻辑 ============

// Markdown 渲染
const renderedDisplayedMarkdown = computed(() => renderMarkdown(displayedContent.value))

// 代码高亮（查询限定在面板根内，避免误伤 Teleport 到 body 的 SkillPreviewModal 等其他组件）
const applyCodeHighlighting = async (selector: string) => {
  await nextTick()
  if (!panelRoot.value) return
  const preBlocks = panelRoot.value.querySelectorAll(selector)
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

const actionPrompts: Record<EditActionKey, string> = {
  polish: "请对以下文档进行润色优化，保持原有结构，提升语言质量和可读性，使表达更加专业、流畅。保持Markdown格式，直接输出优化后的完整文档内容：",
  expand: "请对以下文档进行扩写，增加更详细的说明、例子和补充信息，使内容更加丰富和全面。保持Markdown格式，直接输出扩写后的完整文档内容：",
  condense: "请对以下文档进行精简，去除冗余内容，保留核心要点，使表达更加简洁有力。保持Markdown格式，直接输出精简后的完整文档内容：",
  fix: "请对以下文档进行错误检查和修正，包括拼写错误、语法错误、逻辑错误等。保持Markdown格式，直接输出修正后的完整文档内容：",
  rewrite: "请用不同的表达方式重写以下文档，保持核心意思不变，但使用全新的语言风格和句式结构。保持Markdown格式，直接输出改写后的完整文档内容：",
  summary: "请为以下文档生成一个简洁的总结，包括主要内容和关键要点。总结应该清晰明了，突出文档的核心信息。保持Markdown格式，直接输出总结内容：",
}

/** 快捷动作对应的审核指令描述（供审核阶段理解"用户需求"） */
const ACTION_REVIEW_LABELS: Record<EditActionKey, string> = {
  polish: "对文档进行润色优化",
  expand: "对文档进行扩写",
  condense: "对文档进行精简",
  fix: "对文档进行错误修正",
  rewrite: "对文档进行改写",
  summary: "为文档生成总结",
}

const aiEditAction = async (action: EditActionKey) => {
  if (!editTargetDoc.value) {
    showMessage("请先选择要编辑的文档", 2000, "info")
    return
  }

  // 6 个快捷动作统一复用 polish 系统提示词是有意为之：具体编辑指令由 userInput 承载，此处仅提供"直接输出完整文档"的通用约束
  const systemPromptText = buildSkillSystemPrompt(
    currentSkill.value,
    DEFAULT_SYSTEM_PROMPTS.polish,
  )

  await executeGeneration(
    "AI编辑",
    () => buildGenerateOptions(
      `${actionPrompts[action]}\n\n${editTargetDoc.value!.content}`,
      systemPromptText,
    ),
    undefined,
    { reviewUserRequest: ACTION_REVIEW_LABELS[action] },
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

  // 执行前快照输入指令：onSuccess 会清空 editCustomInput，审核阶段需要真实指令
  const reviewRequest = editCustomInput.value.trim()

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
        baseSystemPrompt = DEFAULT_SYSTEM_PROMPTS.editByInstruction
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
  }, { reviewUserRequest: reviewRequest })
}

// ============ 设置持久化 ============

let isSettingsLoaded = false
let settingsSaveTimer: number | null = null
const SETTINGS_SAVE_DEBOUNCE_MS = 300
/** 持久化的技能 id（null = 设置未加载/首次无记录，"" = 明确选择"无技能"） */
let savedSkillId: string | null = null

const saveSettings = async () => {
  if (!storage.value || !isSettingsLoaded) return
  const settings = {
    model: selectedModel.value,
    customModel: customModel.value,
    enableThinking: enableThinking.value,
    reasoningEffort: reasoningEffort.value,
    webSearch: webSearch.value,
    enableReview: enableReview.value,
    skillId: skills.value[currentSkillIndex.value]?.id ?? "",
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
      reasoningEffort.value = settings.reasoningEffort ?? "high"
      webSearch.value = settings.webSearch ?? false
      enableReview.value = settings.enableReview ?? false
      savedSkillId = settings.skillId ?? null
    }
    isSettingsLoaded = true
  } catch (error) {
    console.error("从插件存储加载设置失败:", error)
  }
}

/** 防抖调度设置保存（多个 watcher 共用同一定时器） */
const scheduleSaveSettings = () => {
  if (settingsSaveTimer) clearTimeout(settingsSaveTimer)
  settingsSaveTimer = window.setTimeout(() => saveSettings(), SETTINGS_SAVE_DEBOUNCE_MS)
}

watch(
  [selectedModel, customModel, enableThinking, reasoningEffort, webSearch, enableReview],
  scheduleSaveSettings,
)

// 技能选择变更持久化（按 id 保存，索引不稳定）
watch(currentSkillIndex, scheduleSaveSettings)

// ============ 清除所有展示态 ============

/** 「清除」按钮：组合清理内容、生成展示态与审核态，避免残留区块仍被渲染 */
const handleClearAll = () => {
  clearContent()
  clearDisplayState()
  clearReviewState()
}

// ============ 生命周期 ============

onMounted(async () => {
  if (props.plugin) {
    storage.value = new AIGeneratorStorage(props.plugin)
    await loadSettings()
  }
  await loadSkills()
  // 技能加载完成后恢复持久化的选择（须在 skills 就绪后执行）
  restoreSkillById(savedSkillId)
  // 读取当前 AI 供应商（模型列表依赖该响应式值），并在全局设置更新后同步刷新
  refreshProvider()
  window.addEventListener("settingsUpdated", refreshProvider)
})

onUnmounted(() => {
  cleanupRaf()
  handleStop() // 中止仍在进行中的生成请求，避免卸载后回调滞留
  window.removeEventListener("settingsUpdated", refreshProvider)
  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer)
    settingsSaveTimer = null
  }
  // 卸载前 flush 最后一次设置变更（防抖窗口内的修改不落盘）
  saveSettings()
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
