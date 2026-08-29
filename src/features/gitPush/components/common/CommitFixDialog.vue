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
            <Icon icon="mdi:close" height="10" />
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
            <!-- 项目信息 + 提交 hash -->
            <div class="gp-fix-meta">
              <span class="gp-fix-project">{{ project?.name || target.projectName }}</span>
              <span class="gp-fix-hash">{{ target.hash }}</span>
              <span
                v-if="target.reason"
                class="gp-fix-reason"
              >{{ i18n[COMMIT_RULE_REASON_META[target.reason].labelKey] }}</span>
            </div>

            <!-- 原提交信息 -->
            <div class="gp-fix-block">
              <!-- 标签："原提交信息" -->
              <label class="gp-label">{{ i18n.ruleFixOriginal }}</label>
              <pre class="gp-fix-original">{{ target.message }}</pre>
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
              <!-- 不合规提示 -->
              <span
                v-if="validationReason"
                class="gp-fix-invalid"
              >{{ i18n[COMMIT_RULE_REASON_META[validationReason].labelKey] }}</span>
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
                <label class="gp-fix-date-option">
                  <input
                    type="radio"
                    name="gp-fix-date-choice"
                    :checked="preserveDate"
                    @change="onDateChoiceChange(true)"
                  />
                  {{ i18n.ruleFixPreserveDate }}
                </label>
                <label class="gp-fix-date-option">
                  <input
                    type="radio"
                    name="gp-fix-date-choice"
                    :checked="!preserveDate"
                    @change="onDateChoiceChange(false)"
                  />
                  {{ i18n.ruleFixDefaultDate }}
                </label>
              </div>
            </div>

            <!-- 历史提交 rebase 重写耗时提示（仅保存历史提交时显示，明确等待原因） -->
            <div
              v-if="saving && isHistoryCommit"
              class="gp-fix-warning"
            >
              <Icon
                icon="mdi:alert-circle-outline"
                height="12"
              />
              <span>{{ i18n.ruleFixRewriting }}</span>
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
          </template>
        </div>

        <div class="gp-dialog-footer">
          <!-- 底部提示："AI 生成结果仅供参考" -->
          <span class="gp-fix-hint">{{ i18n.aiAnalyzeFooterHint }}</span>
          <div class="gp-grow" />
          <!-- AI 生成修正 -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="loading || aiLoading || !project"
            @click="runAiFix"
          >
            <Icon
              :icon="aiLoading ? 'mdi:loading' : 'mdi:auto-fix'"
              height="12"
              :class="{ 'gp-spin': aiLoading }"
            />
            <span>{{ aiLoading ? i18n.ruleFixGenerating : i18n.ruleFixGenerate }}</span>
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
import type { CommitFixTarget, GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, inject, onMounted, onUnmounted, ref } from "vue"
import { COMMIT_RULE_REASON_META } from "../../types"
import { checkCommitRule } from "../../commitRuleChecker"
import { resolveValidPath } from "../../utils"
import { CARD_SERVICES_KEY } from "../../types"
import { getErrorMessage } from "@/utils/stringUtils"
import Loader from "@/components/Loader.vue"

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
const aiLoading = ref(false)
const aiError = ref("")
const saving = ref(false)
/** 提交时间策略：true = 保留原始提交时间，false = 按当前时间提交（持久化跨会话恢复） */
const preserveDate = ref(true)
const headHash = ref("")
const workingTreeClean = ref(false)

const projectPath = computed(() => project.value ? resolveValidPath(project.value) : "")

/** 是否历史提交（非 HEAD） */
const isHistoryCommit = computed(() => !!projectPath.value && !!headHash.value && !headHash.value.startsWith(props.target.hash))

/** 是否可执行修正：项目有效且工作区干净（HEAD 走 amend，历史提交走 rebase） */
const canAmend = computed(() => !!projectPath.value && !!headHash.value && workingTreeClean.value)

/** 当前新提交信息命中规则问题（合规时为 null） */
const validationReason = computed(() => checkCommitRule(newMessage.value))

/** 不可保存时的提示文案 */
const amendBlockedReason = computed(() => {
  if (!headHash.value) {
    return props.i18n.ruleFixNoHead
  }
  if (!workingTreeClean.value) {
    return props.i18n.ruleFixDirtyWorkingTree
  }
  return ""
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close")
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown)
  void init()
})
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
})

/** 切换提交时间策略并即时持久化（下次打开弹窗恢复选择） */
async function onDateChoiceChange(preserve: boolean) {
  preserveDate.value = preserve
  await manager.storage.commitFixPrefs.save({ preserveDate: preserve })
}

async function init() {
  try {
    // 恢复上次选择的提交时间策略（持久化偏好，无记录时默认保留原始时间）
    const prefs = await manager.storage.commitFixPrefs.loadOrDefault()
    preserveDate.value = prefs.preserveDate
    const p = await manager.getProjectById(props.target.projectId)
    project.value = p ?? null
    if (!p) return
    const path = resolveValidPath(p)
    const [head, wt] = await Promise.all([
      manager.getHeadHash(path),
      manager.getWorkingTreeStatus(path, { skipRefresh: true }),
    ])
    headHash.value = head
    workingTreeClean.value = !wt.hasChanges
  } finally {
    loading.value = false
  }
}

/** AI 生成修正建议（失败时提示，可重试） */
async function runAiFix() {
  if (!projectPath.value || aiLoading.value) return
  aiLoading.value = true
  aiError.value = ""
  try {
    const result = await manager.generateCommitFix(projectPath.value, props.target.hash, props.target.message)
    if (result.message) {
      newMessage.value = result.message
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

/** 点击保存：校验通过后按已选时间策略直接执行修正（选择框已常驻，无需二次确认） */
function save() {
  if (!canAmend.value || validationReason.value) return
  void performSave(preserveDate.value)
}

/** 执行修正：preserve=true 保留原始提交时间，false 使用当前时间 */
async function performSave(preserve: boolean) {
  if (!canAmend.value || !projectPath.value || validationReason.value) return
  saving.value = true
  try {
    await manager.rewriteCommitMessage(projectPath.value, props.target.hash, newMessage.value.trim(), preserve)
    emit("saved", props.target.projectId)
    emit("close")
  } catch (e: unknown) {
    console.error("[gitPush] 修正提交信息失败:", e)
    aiError.value = getErrorMessage(e) || props.i18n.ruleFixSaveFailed
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss">
@use "../../styles/CommitFixDialog.scss";
@use "../../styles/index.scss";
</style>
