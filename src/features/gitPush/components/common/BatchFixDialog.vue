<!-- gitPush 提交信息批量修正弹窗（自包含：多条违规校验、AI 批量生成、批量保存、逐项状态） -->
<template>
  <Teleport to="body">
    <div
      class="gp-mask"
      @click.self="onMaskClose"
    >
      <div class="gp-dialog gp-fix-batch-dialog">
        <div class="gp-dialog-header">
          <!-- 弹窗标题："批量修正提交信息" -->
          <span class="gp-dialog-title">{{ i18n.ruleFixBatchTitle }}</span>
          <button
            class="vp-btn vp-btn--ghost vp-btn--xs"
            :disabled="busy"
            @click="emit('close')"
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
            <!-- 提交时间策略勾选（radio 单选，全批共享，保存时按此执行并持久化） -->
            <div class="gp-fix-block">
              <!-- 标签："提交时间" -->
              <label class="gp-label">{{ i18n.ruleFixDateChoice }}</label>
              <div class="gp-fix-date-options">
                <label class="gp-fix-date-option">
                  <input
                    type="radio"
                    name="gp-fix-batch-date-choice"
                    :checked="preserveDate"
                    @change="onDateChoiceChange(true)"
                  />
                  {{ i18n.ruleFixPreserveDate }}
                </label>
                <label class="gp-fix-date-option">
                  <input
                    type="radio"
                    name="gp-fix-batch-date-choice"
                    :checked="!preserveDate"
                    @change="onDateChoiceChange(false)"
                  />
                  {{ i18n.ruleFixDefaultDate }}
                </label>
              </div>
            </div>

            <!-- AI 批量生成进度："正在生成 (i/N)…" -->
            <div
              v-if="generating"
              class="gp-fix-warning"
            >
              <Icon
                icon="mdi:auto-fix"
                height="12"
                class="gp-spin"
              />
              <span>{{ i18n.ruleFixBatchGenerating.replace("{0}", String(genDone)).replace("{1}", String(genTotal)) }}</span>
            </div>

            <!-- 批量保存进度："正在保存 (i/N)…" + 当前项历史重写计数与进度条 -->
            <div
              v-if="saving"
              class="gp-fix-warning"
            >
              <Icon
                icon="mdi:content-save-outline"
                height="12"
                class="gp-spin"
              />
              <span>{{ i18n.ruleFixBatchSaving.replace("{0}", String(saveDone)).replace("{1}", String(saveTotal)) }}</span>
              <span
                v-if="currentRewrite"
                class="gp-fix-rewrite-count"
              >{{ i18n.ruleFixRewritingProgress.replace("{0}", String(currentRewrite.current)).replace("{1}", String(currentRewrite.total)) }}</span>
              <!-- 重写进度条（细条，宽度随计数实时更新） -->
              <div class="gp-fix-progress">
                <div
                  class="gp-fix-progress-bar"
                  :style="{ width: (currentRewrite ? Math.round(currentRewrite.current / currentRewrite.total * 100) : 0) + '%' }"
                />
              </div>
            </div>

            <!-- 保存结果汇总："成功 X 项，失败 Y 项，跳过 Z 项" -->
            <div
              v-if="summary"
              class="gp-fix-warning"
              :class="{ 'gp-fix-warning--error': summary.failed > 0 }"
            >
              <Icon
                :icon="summary.failed > 0 ? 'mdi:alert-circle-outline' : 'mdi:check-decagram'"
                height="12"
              />
              <span>{{ summaryText }}</span>
            </div>

            <!-- 批量条目列表 -->
            <div class="gp-fix-batch-list">
              <div
                v-for="(item, idx) in items"
                :key="item.key"
                class="gp-fix-batch-item"
                :class="{ 'gp-fix-batch-item--saved': item.status === 'saved' }"
              >
                <!-- 条目头部：序号 + 项目 + hash + 违规原因徽章 + 状态图标 -->
                <div class="gp-fix-meta">
                  <span class="gp-fix-batch-index">{{ idx + 1 }}</span>
                  <span
                    class="gp-fix-project"
                    :title="item.projectName"
                  >{{ item.projectName }}</span>
                  <span class="gp-fix-hash">{{ item.hash }}</span>
                  <span
                    v-if="item.reason"
                    class="gp-fix-reason"
                  >{{ i18n[COMMIT_RULE_REASON_META[item.reason].labelKey] }}</span>
                  <span
                    class="gp-fix-batch-state"
                    :class="`gp-fix-batch-state--${item.status}`"
                    :title="item.status !== 'pending' ? statusTitle(item.status) : undefined"
                  >
                    <Icon
                      v-if="item.status === 'saved'"
                      icon="mdi:check-circle"
                      height="12"
                    />
                    <Icon
                      v-else-if="item.status === 'error'"
                      icon="mdi:alert-circle"
                      height="12"
                    />
                  </span>
                </div>

                <!-- 原提交信息 -->
                <div class="gp-fix-block">
                  <pre class="gp-fix-original">{{ item.message }}</pre>
                </div>

                <!-- 新提交信息 -->
                <div class="gp-fix-block">
                  <textarea
                    v-model="item.newMessage"
                    class="gp-fix-input"
                    rows="2"
                    :disabled="item.status === 'saved' || !!item.blockedReason || busy"
                    :placeholder="i18n.ruleFixNewPlaceholder"
                  />
                  <!-- 不合规提示 -->
                  <span
                    v-if="validationOf(item)"
                    class="gp-fix-invalid"
                  >{{ i18n[COMMIT_RULE_REASON_META[validationOf(item) as CommitRuleReasonKey].labelKey] }}</span>
                  <!-- 保存失败提示 -->
                  <span
                    v-if="item.error"
                    class="gp-fix-invalid"
                  >{{ item.error }}</span>
                </div>

                <!-- 历史提交重写警告（非 HEAD 且可修正） -->
                <div
                  v-if="item.isHistory && !item.blockedReason"
                  class="gp-fix-warning"
                >
                  <Icon
                    icon="mdi:alert-circle-outline"
                    height="12"
                  />
                  <span>{{ i18n.ruleFixForcePushHint }}</span>
                </div>

                <!-- 不可修正提示 -->
                <div
                  v-if="item.blockedReason"
                  class="gp-fix-warning"
                >
                  <Icon
                    icon="mdi:alert-circle-outline"
                    height="12"
                  />
                  <span>{{ item.blockedReason }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="gp-dialog-footer">
          <!-- 底部提示："AI 生成结果仅供参考" -->
          <span class="gp-fix-hint">{{ i18n.aiAnalyzeFooterHint }}</span>
          <div class="gp-grow" />
          <!-- AI 批量生成 -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="busy || pendingCount === 0"
            @click="runAiFixAll"
          >
            <Icon
              :icon="generating ? 'mdi:loading' : 'mdi:auto-fix'"
              height="12"
              :class="{ 'gp-spin': generating }"
            />
            <span>{{ generating ? i18n.ruleFixGenerating : i18n.ruleFixBatchGenerate }}</span>
          </button>
          <!-- 批量保存 -->
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="busy || saveCandidates.length === 0"
            @click="saveAll"
          >
            <Icon
              :icon="saving ? 'mdi:loading' : 'mdi:content-save-outline'"
              height="12"
              :class="{ 'gp-spin': saving }"
            />
            <span>{{ saving ? i18n.ruleFixSaving : i18n.ruleFixBatchSave }}</span>
          </button>
          <!-- 完成（保存完成后出现，关闭弹窗） -->
          <button
            v-if="summary"
            class="vp-btn vp-btn--ghost vp-btn--sm"
            @click="emit('close')"
          >
            <Icon icon="mdi:check" height="12" />
            <span>{{ i18n.ruleFixBatchDone }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// gitPush 提交信息批量修正弹窗（自包含：多条违规校验、AI 批量生成、批量保存、逐项状态）
import type { CommitRuleReasonKey, CommitRuleViolation } from "../../types"
import { CARD_SERVICES_KEY, COMMIT_RULE_REASON_META } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, inject, onMounted, onUnmounted, ref } from "vue"
import { checkCommitRule } from "../../commitRuleChecker"
import { resolveValidPath } from "../../utils"
import { getErrorMessage } from "@/utils/stringUtils"
import Loader from "@/components/Loader.vue"

/** 单个违规的批量修正视图：原信息 + 可编辑新信息 + 阻止原因 + 处理状态 */
interface BatchFixItem {
  key: string
  projectId: string
  projectName: string
  hash: string
  message: string
  reason?: CommitRuleReasonKey
  /** ISO 提交时间（用于防御性降序排序，保证同项目祖先-后代违规"新→旧"处理） */
  date?: string
  projectPath: string
  newMessage: string
  /** 是否 merge 提交（修正不可行） */
  isMerge: boolean
  /** 是否历史提交（非 HEAD，重写会影响下游 hash） */
  isHistory: boolean
  /** 阻止保存原因（"" = 可修正） */
  blockedReason: string
  status: "pending" | "saved" | "error"
  /** 保存失败错误文案 */
  error: string
}

/** 每个项目的 HEAD/工作区/rebase 前置状态（init 时一次加载） */
interface ProjectRuntime {
  headHash: string
  workingTreeClean: boolean
  rebaseStuck: boolean
}

const props = defineProps<{
  i18n: Record<string, any>
  targets: CommitRuleViolation[]
}>()

const emit = defineEmits<{
  close: []
  saved: [projectIds: string[]]
}>()

const services = inject(CARD_SERVICES_KEY)!
const { manager } = services

const loading = ref(true)
/** 提交时间策略：true = 保留原始提交时间，false = 按当前时间提交（持久化跨会话恢复） */
const preserveDate = ref(true)
const items = ref<BatchFixItem[]>([])
const generating = ref(false)
const saving = ref(false)
/** AI 批量生成进度（计数） */
const genDone = ref(0)
const genTotal = ref(0)
/** 批量保存进度（计数） */
const saveDone = ref(0)
const saveTotal = ref(0)
/** 当前项历史重写进度（{current, total}，null = 尚未开始） */
const currentRewrite = ref<{ current: number, total: number } | null>(null)
/** 保存结果汇总（null = 尚未保存完成） */
const summary = ref<{ succeeded: number, failed: number, skipped: number } | null>(null)

const busy = computed(() => loading.value || generating.value || saving.value)

/** 可修正（未 blocked）且未保存的条目 = AI 生成候选集 */
const pendingItems = computed(() => items.value.filter((it) => !it.blockedReason && it.status !== "saved"))
const pendingCount = computed(() => pendingItems.value.length)

/** 可保存条目（可修正、未保存、新信息合规）；含规则问题的条目保持 pending，用户可修正后重存 */
const saveCandidates = computed(() => pendingItems.value.filter((it) => !validationOf(it)))

/** 保存结果汇总文案："成功 X 项，失败 Y 项，跳过 Z 项" */
const summaryText = computed(() => {
  if (!summary.value) return ""
  return props.i18n.ruleFixBatchSummary
    .replace("{0}", String(summary.value.succeeded))
    .replace("{1}", String(summary.value.failed))
    .replace("{2}", String(summary.value.skipped))
})

/** 新提交信息命中规则问题（合规为 null；实时跟随编辑） */
function validationOf(item: BatchFixItem): CommitRuleReasonKey | null {
  return checkCommitRule(item.newMessage)
}

/** 条目状态图标 tooltip 文案（"已修正"/"修正失败"） */
function statusTitle(status: BatchFixItem["status"]): string {
  if (status === "saved") return props.i18n.ruleFixBatchSaved
  if (status === "error") return props.i18n.ruleFixSaveFailed
  return ""
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && !busy.value) emit("close")
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown)
  void init()
})
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
})

function onMaskClose() {
  if (!busy.value) emit("close")
}

/** 切换提交时间策略并即时持久化（下次打开弹窗恢复选择） */
async function onDateChoiceChange(preserve: boolean) {
  preserveDate.value = preserve
  await manager.storage.commitFixPrefs.save({ preserveDate: preserve })
}

/** 计算不可修正原因（merge / rebase 残留 / 无 HEAD / 工作区脏，优先级同单条弹窗） */
function computeBlockedReason(item: Pick<BatchFixItem, "isMerge">, rt: ProjectRuntime): string {
  if (item.isMerge) return props.i18n.ruleFixMergeBlocked
  if (rt.rebaseStuck) return props.i18n.ruleFixRebaseStuck
  if (!rt.headHash) return props.i18n.ruleFixNoHead
  if (!rt.workingTreeClean) return props.i18n.ruleFixDirtyWorkingTree
  return ""
}

async function init() {
  try {
    // 恢复上次选择的提交时间策略（持久化偏好，无记录时默认保留原始时间）
    const prefs = await manager.storage.commitFixPrefs.loadOrDefault()
    preserveDate.value = prefs.preserveDate

    // 按项目分组，每组一次加载 HEAD/工作区/rebase；每条检测 merge
    const byProject = new Map<string, CommitRuleViolation[]>()
    for (const t of props.targets) {
      const list = byProject.get(t.projectId) ?? []
      list.push(t)
      byProject.set(t.projectId, list)
    }

    const built: BatchFixItem[] = []
    await Promise.all([...byProject.entries()].map(async ([projectId, targets]) => {
      const p = await manager.getProjectById(projectId)
      if (!p) return
      const path = resolveValidPath(p)
      const [head, wt, stuck] = await Promise.all([
        manager.getHeadHash(path),
        manager.getWorkingTreeStatus(path),
        manager.isInRebaseState(path),
      ])
      const rt: ProjectRuntime = { headHash: head, workingTreeClean: !wt.hasChanges, rebaseStuck: stuck }

      await Promise.all(targets.map(async (t) => {
        const isMerge = await manager.isMergeCommit(path, t.hash)
        const isHistory = !!rt.headHash && !rt.headHash.startsWith(t.hash)
        built.push({
          key: `${t.projectId}-${t.hash}-${t.reason ?? ""}`,
          projectId: t.projectId,
          projectName: t.projectName,
          hash: t.hash,
          message: t.message,
          reason: t.reason,
          date: t.date,
          projectPath: path,
          newMessage: t.message,
          isMerge,
          isHistory,
          blockedReason: computeBlockedReason({ isMerge }, rt),
          status: "pending",
          error: "",
        })
      }))
    }))

    // 防御性按提交时间降序（同项目祖先-后代违规必须"新→旧"处理，避免祖先重写使后代 hash 失效）
    built.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    items.value = built
  } finally {
    loading.value = false
  }
}

/** AI 批量生成修正建议（逐条填充新信息；生成失败沿用单条降级语义，保留原信息） */
async function runAiFixAll() {
  if (busy.value || pendingCount.value === 0) return
  generating.value = true
  const targets = pendingItems.value
  genDone.value = 0
  genTotal.value = targets.length
  try {
    for (const item of targets) {
      try {
        const result = await manager.generateCommitFix(item.projectPath, item.hash, item.message)
        if (result.message) item.newMessage = result.message
      } catch (e) {
        console.error("[gitPush] AI 批量生成失败:", e)
      }
      genDone.value++
    }
  } finally {
    generating.value = false
  }
}

/** 批量保存：逐条重写提交信息（HEAD→amend，历史→commit-tree 重建），每条独立成败 */
async function saveAll() {
  if (busy.value || saveCandidates.value.length === 0) return
  saving.value = true
  currentRewrite.value = null
  const targets = saveCandidates.value
  saveDone.value = 0
  saveTotal.value = targets.length
  try {
    for (const item of targets) {
      try {
        await manager.rewriteCommitMessage(item.projectPath, item.hash, item.newMessage.trim(), preserveDate.value, (cur, total) => {
          currentRewrite.value = { current: cur, total }
        })
        item.status = "saved"
      } catch (e) {
        console.error("[gitPush] 批量修正保存失败:", e)
        item.status = "error"
        item.error = getErrorMessage(e) || props.i18n.ruleFixSaveFailed
      }
      saveDone.value++
      currentRewrite.value = null
    }
  } finally {
    saving.value = false
    currentRewrite.value = null
    finalize()
  }
}

/** 保存收尾：统计汇总并通知父组件刷新受影响项目（弹窗保持打开，由"完成"按钮关闭） */
function finalize() {
  let succeeded = 0
  let failed = 0
  let skipped = 0
  for (const it of items.value) {
    if (it.status === "saved") succeeded++
    else if (it.status === "error") failed++
    else skipped++
  }
  summary.value = { succeeded, failed, skipped }
  const projectIds = [...new Set(items.value.filter((it) => it.status === "saved").map((it) => it.projectId))]
  if (projectIds.length > 0) emit("saved", projectIds)
}
</script>

<style lang="scss">
@use "../../styles/BatchFixDialog.scss";
@use "../../styles/index.scss";
</style>
