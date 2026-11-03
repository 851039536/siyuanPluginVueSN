<!-- gitPush 提交信息修正弹窗（自包含：校验 HEAD/工作区、AI 生成、amend 保存） -->
<template>
  <Teleport to="body">
    <div
      class="gp-mask"
      @click.self="$emit('close')"
    >
      <div class="gp-dialog gp-fix-dialog">
        <div class="gp-dialog-header">
          <!-- 弹窗标题："修正提交信息" -->
          <span class="gp-dialog-title">{{ i18n.ruleFixTitle }}</span>
          <button
            class="vp-btn vp-btn--ghost vp-btn--xs"
            @click="$emit('close')"
          >
            <Icon
              icon="mdi:close"
              height="10"
            />
          </button>
        </div>

        <div class="gp-dialog-body">
          <!-- 加载中 -->
          <div
            v-if="loading"
            class="gp-loading"
          >
            <Loader />
          </div>

          <template v-else>
            <!-- 项目信息 + 提交 hash（完整 40 位，word-break 防溢出；悬停复制） -->
            <div class="gp-fix-meta">
              <span class="gp-fix-project">{{ project?.name || target.projectName }}</span>
              <span
                class="gp-fix-hash"
                role="button"
                tabindex="0"
                :title="i18n.copyHash"
                :aria-label="i18n.copyHash"
                @click="copyHash"
                @keydown.enter.prevent="copyHash"
                @keydown.space.prevent="copyHash"
              >{{ copied ? i18n.copied : target.hash }}</span>
              <span
                v-if="target.reason"
                class="gp-fix-reason"
                :title="ruleReasonDesc(target.reason, i18n)"
              >{{ ruleReasonText(target.reason, i18n) }}</span>
            </div>

            <!-- 原提交信息（完整多行原文；提交日志的 %s 会折叠多行，故 init 时用 %B 重取） -->
            <div class="gp-fix-block">
              <!-- 标签："原提交信息" -->
              <label class="gp-label">{{ i18n.ruleFixOriginal }}</label>
              <pre class="gp-fix-original">{{ fullMessage || target.message }}</pre>
            </div>

            <!-- 新提交信息 -->
            <div class="gp-fix-block">
              <!-- 标签："新提交信息" -->
              <label class="gp-label">{{ i18n.ruleFixNewLabel }}</label>
              <textarea
                v-model="newMessage"
                class="gp-fix-input"
                rows="4"
                :placeholder="i18n.ruleFixNewPlaceholder"
              />
              <!-- 不合规提示（悬停显示该规则的判定说明与改法） -->
              <span
                v-if="validationReason"
                class="gp-fix-invalid"
                :title="ruleReasonDesc(validationReason, i18n)"
              >{{ ruleReasonText(validationReason, i18n) }}</span>
            </div>

            <!-- 该提交修改的文件清单（辅助理解改动范围；行点击可查看差异） -->
            <div class="gp-fix-files">
              <CommitFilesList
                v-if="project"
                :i18n="i18n"
                :project="project"
                :hash="target.hash"
                :heading-text="i18n.commitFilesTitle"
                :list-height="170"
              />
            </div>

            <!-- 历史重写警告 -->
            <div
              v-if="isHistoryCommit && workingTreeClean"
              class="gp-fix-warning"
            >
              <Icon
                icon="mdi:alert-circle-outline"
                height="12"
              />
              <span>{{ i18n.ruleFixForcePushHint }}</span>
            </div>

            <!-- 可编辑状态提示 -->
            <div
              v-if="!canAmend"
              class="gp-fix-warning"
            >
              <Icon
                icon="mdi:alert-circle-outline"
                height="12"
              />
              <span>{{ amendBlockedReason }}</span>
            </div>

            <!-- 提交时间策略勾选（radio 单选，保存时直接按此执行并持久化） -->
            <div class="gp-fix-block">
              <!-- 标签："提交时间" -->
              <label class="gp-label">{{ i18n.ruleFixDateChoice }}</label>
              <div class="gp-fix-date-options">
                <!-- 二值 radio（binary 模式：modelValue 直接即选中值，无需 value） -->
                <RadioButton
                  class="gp-fix-date-radio"
                  binary
                  name="gp-fix-date-choice"
                  :model-value="preserveDate"
                  size="xsmall"
                  :label="i18n.ruleFixPreserveDate"
                  @update:model-value="onDateChoiceChange(true)"
                />
                <RadioButton
                  class="gp-fix-date-radio"
                  binary
                  name="gp-fix-date-choice"
                  :model-value="!preserveDate"
                  size="xsmall"
                  :label="i18n.ruleFixDefaultDate"
                  @update:model-value="onDateChoiceChange(false)"
                />
              </div>
            </div>

            <!-- 历史提交重写耗时提示（仅保存历史提交时显示，明确等待原因；有进度时显示计数 + 进度条） -->
            <div
              v-if="saving && isHistoryCommit"
              class="gp-fix-warning"
            >
              <Icon
                icon="mdi:alert-circle-outline"
                height="12"
              />
              <span>{{ rewriteProgress ? i18n.ruleFixRewritingProgress.replace("{0}", String(rewriteProgress.current)).replace("{1}", String(rewriteProgress.total)) : i18n.ruleFixRewriting }}</span>
              <!-- 重写进度条（细条，宽度随计数实时更新） -->
              <div class="gp-fix-progress">
                <div
                  class="gp-fix-progress-bar"
                  :style="{ width: `${rewriteProgress ? Math.round(rewriteProgress.current / rewriteProgress.total * 100) : 0}%` }"
                />
              </div>
            </div>

            <!-- AI 生成失败提示 -->
            <div
              v-if="aiError"
              class="gp-fix-warning gp-fix-warning--error"
            >
              <Icon
                icon="mdi:alert-circle-outline"
                height="12"
              />
              <span>{{ aiError }}</span>
            </div>

            <!-- AI 未返回有效格式、已降级启发式修正的提示（非错误，提醒核对内容） -->
            <div
              v-if="aiNote"
              class="gp-fix-warning"
            >
              <Icon
                icon="mdi:information-outline"
                height="12"
              />
              <span>{{ aiNote }}</span>
            </div>
          </template>
        </div>

        <div class="gp-dialog-footer">
          <!-- 底部提示："AI 生成结果仅供参考" -->
          <span class="gp-fix-hint">{{ i18n.aiAnalyzeFooterHint }}</span>
          <div class="gp-grow" />
          <!-- AI 生成修正 -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="loading || aiLoading || deepLoading || !project"
            @click="runAiFix"
          >
            <Icon
              :icon="aiLoading ? 'mdi:loading' : 'mdi:auto-fix'"
              height="12"
              :class="{ 'gp-spin': aiLoading }"
            />
            <span>{{ aiLoading ? i18n.ruleFixGenerating : i18n.ruleFixGenerate }}</span>
          </button>
          <!-- AI 深度分析修正（读取该提交完整 diff 理解实际改动后生成） -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="loading || deepLoading || aiLoading || !project"
            :title="i18n.ruleFixDeepAnalyzeTip"
            @click="runDeepAnalyze"
          >
            <Icon
              :icon="deepLoading ? 'mdi:loading' : 'mdi:text-search'"
              height="12"
              :class="{ 'gp-spin': deepLoading }"
            />
            <span>{{ deepLoading ? i18n.ruleFixDeepAnalyzing : i18n.ruleFixDeepAnalyze }}</span>
          </button>
          <!-- 保存修正 -->
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="!canAmend || !!validationReason || saving"
            @click="save"
          >
            <Icon
              :icon="saving ? 'mdi:loading' : 'mdi:content-save-outline'"
              height="12"
              :class="{ 'gp-spin': saving }"
            />
            <span>{{ saving ? (isHistoryCommit ? i18n.ruleFixRewriting : i18n.ruleFixSaving) : i18n.ruleFixSave }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type {
  CommitFixTarget,
  GitProject,
} from "../../types"
import { Icon } from "@iconify/vue"
import {
  computed,
  inject,
  onMounted,
  ref,
} from "vue"
import Loader from "@/components/Loader.vue"
import RadioButton from "@/components/RadioButton.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { getErrorMessage } from "@/utils/stringUtils"
import { checkCommitRule } from "../../commitRuleChecker"
import { useCommitFixCommon, computeCommitBlockedReason } from "../../composables/useCommitFixCommon"
import { useCopyFeedback } from "../../composables/useCopyFeedback"
import { CARD_SERVICES_KEY } from "../../types"

import {
  resolveValidPath,
  ruleReasonDesc,
  ruleReasonText,
} from "../../utils"
import CommitFilesList from "./CommitFilesList.vue"

const props = defineProps<{
  i18n: Record<string, any>
  target: CommitFixTarget
}>()

const emit = defineEmits<{
  close: []
  saved: [projectId: string]
}>()

const services = inject(CARD_SERVICES_KEY)!
const { manager } = services

const project = ref<GitProject | null>(null)
const loading = ref(true)
const newMessage = ref(props.target.message)
/** 完整原始提交信息（%B 多行原文；target.message 来自提交日志 %s，多行会被折叠成单行） */
const fullMessage = ref("")
const aiLoading = ref(false)
/** AI 深度分析中（读取完整 diff 理解实际改动，耗时高于普通生成） */
const deepLoading = ref(false)
const aiError = ref("")
/** AI 未返回有效格式、已降级启发式修正时的提醒（非错误，提醒用户核对） */
const aiNote = ref("")
const saving = ref(false)
/** 历史提交重写进度（{current, total}，null = 尚未开始）；仅历史提交保存时使用 */
const rewriteProgress = ref<{ current: number, total: number } | null>(null)
const headHash = ref("")
const workingTreeClean = ref(false)
/** 仓库是否处于 rebase 中断状态（上次修正失败的残留，此时任何重写都必须阻止） */
const rebaseStuck = ref(false)

/** 提交时间策略 / 规则配置 / Esc 关闭（与批量修正弹窗共用） */
const {
  preserveDate,
  ruleConfig,
  loadCommitFixCommonPrefs,
  onDateChoiceChange,
} = useCommitFixCommon(manager, () => emit("close"))

const projectPath = computed(() => project.value ? resolveValidPath(project.value) : "")

/** hash 徽章复制反馈（2s 对勾/「已复制」文案；定时器清理由 composable 承担） */
const {
  copied,
  notifyCopied,
} = useCopyFeedback()

/** 点击 hash 徽章复制完整哈希（git 定位/分享用） */
async function copyHash() {
  const ok = await copyToClipboard(props.target.hash)
  if (ok) notifyCopied()
}

/** 是否历史提交（非 HEAD） */
const isHistoryCommit = computed(() => !!projectPath.value && !!headHash.value && !headHash.value.startsWith(props.target.hash))

/** 是否可执行修正：目标非 merge、项目有效、非 rebase 残留且工作区干净（HEAD 走 amend，历史提交走 rebase） */
const canAmend = computed(() => !props.target.isMerge && !!projectPath.value && !!headHash.value && workingTreeClean.value && !rebaseStuck.value)

/** 当前新提交信息命中规则问题（合规时为 null） */
const validationReason = computed(() => checkCommitRule(newMessage.value, ruleConfig.value))

/** 不可保存时的提示文案（与批量修正弹窗共用判定优先级） */
const amendBlockedReason = computed(() => computeCommitBlockedReason({
  isMerge: !!props.target.isMerge,
  rebaseStuck: rebaseStuck.value,
  headHash: headHash.value,
  workingTreeClean: workingTreeClean.value,
}, props.i18n))

onMounted(() => {
  void init()
})

async function init() {
  try {
    // 恢复提交时间策略与规则配置（持久化偏好；旧数据缺字段时回退默认值）
    await loadCommitFixCommonPrefs()
    const p = await manager.getProjectById(props.target.projectId)
    project.value = p ?? null
    if (!p) return
    const path = resolveValidPath(p)
    const [head, wt, stuck, rawMessage] = await Promise.all([
      manager.getHeadHash(path),
      manager.getWorkingTreeStatus(path),
      manager.isInRebaseState(path),
      manager.getCommitFullMessage(path, props.target.hash).catch(() => ""),
    ])
    headHash.value = head
    workingTreeClean.value = !wt.hasChanges
    rebaseStuck.value = stuck
    // 多行提交信息以完整原文覆盖（加载阶段用户未交互，安全）；单行时与 target.message 一致无感知
    if (rawMessage) {
      fullMessage.value = rawMessage
      newMessage.value = rawMessage
    }
  } finally {
    loading.value = false
  }
}

/** AI 生成修正建议（失败时提示，可重试） */
async function runAiFix() {
  if (!projectPath.value || aiLoading.value) return
  aiLoading.value = true
  aiError.value = ""
  aiNote.value = ""
  try {
    const result = await manager.generateCommitFix(projectPath.value, props.target.hash, fullMessage.value || props.target.message)
    if (result.message) {
      newMessage.value = result.message
      // 启发式降级说明：让用户知道这条不是 AI 原样产出，需复核（避免误以为"生成没按规则来"）
      if (result.source === "heuristic") aiNote.value = props.i18n.aiHeuristic
    } else {
      aiError.value = props.i18n.ruleFixAiFailed
    }
  } catch (e: unknown) {
    console.error("[gitPush] AI 修正提交信息失败:", e)
    aiError.value = props.i18n.ruleFixAiFailed
  } finally {
    aiLoading.value = false
  }
}

/** AI 深度分析修正：读取该提交完整 diff 理解实际改动，生成贴合改动的提交信息（失败时提示，可重试） */
async function runDeepAnalyze() {
  if (!projectPath.value || deepLoading.value) return
  deepLoading.value = true
  aiError.value = ""
  aiNote.value = ""
  try {
    const result = await manager.deepAnalyzeCommitFix(projectPath.value, props.target.hash, fullMessage.value || props.target.message)
    if (result.message) {
      newMessage.value = result.message
      // 启发式降级说明：与单行生成同口径，明确告知不是 AI 原样产出
      if (result.source === "heuristic") aiNote.value = props.i18n.aiHeuristic
    } else {
      aiError.value = props.i18n.ruleFixDeepAnalyzeFailed
    }
  } catch (e: unknown) {
    console.error("[gitPush] AI 深度分析修正提交信息失败:", e)
    aiError.value = getErrorMessage(e) || props.i18n.ruleFixDeepAnalyzeFailed
  } finally {
    deepLoading.value = false
  }
}

/** 点击保存：校验通过后按已选时间策略直接执行修正（选择框已常驻，无需二次确认） */
function save() {
  if (!canAmend.value || validationReason.value) return
  void performSave(preserveDate.value)
}

/** 执行修正：preserve=true 保留原始提交时间，false 使用当前时间 */
async function performSave(preserve: boolean) {
  if (!canAmend.value || !projectPath.value || validationReason.value) return
  saving.value = true
  rewriteProgress.value = null
  try {
    await manager.rewriteCommitMessage(projectPath.value, props.target.hash, newMessage.value.trim(), preserve, (current, total) => {
      rewriteProgress.value = {
        current,
        total,
      }
    })
    emit("saved", props.target.projectId)
    emit("close")
  } catch (e: unknown) {
    console.error("[gitPush] 修正提交信息失败:", e)
    aiError.value = getErrorMessage(e) || props.i18n.ruleFixSaveFailed
  } finally {
    saving.value = false
    rewriteProgress.value = null
  }
}
</script>

<style lang="scss">
@use "../../styles/CommitFixDialog.scss";
@use "../../styles/index.scss";
</style>
