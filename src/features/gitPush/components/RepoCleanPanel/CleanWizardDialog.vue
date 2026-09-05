<!-- gitPush BFG 历史清理向导弹窗（自包含：策略表单 → 前置检查 → 执行 → 结果，调 manager 完成 CRUD） -->
<template>
  <Teleport to="body">
    <div
      class="gp-mask"
      @click.self="onMaskClick"
    >
      <div class="gp-dialog grcp-wizard">
        <div class="gp-dialog-header">
          <!-- 弹窗标题："历史清理（BFG）" -->
          <span class="gp-dialog-title">{{ i18n.bfgTitle }}</span>
          <button
            class="vp-btn vp-btn--ghost vp-btn--xs"
            :disabled="running"
            @click="$emit('close')"
          >
            <Icon icon="mdi:close" height="10" />
          </button>
        </div>

        <div class="gp-dialog-body">
          <!-- ── 阶段 1：策略表单 ── -->
          <template v-if="phase === 'plan'">
            <!-- 项目信息 -->
            <div class="grcp-wizard-meta">
              <span class="grcp-wizard-project">{{ project.name }}</span>
              <Icon
                icon="mdi:shield-lock-outline"
                height="12"
              />
            </div>

            <!-- 清理策略 -->
            <div class="grcp-wizard-block">
              <!-- 区块标签："清理策略" -->
              <label class="gp-label">{{ i18n.bfgStrategy }}</label>

              <!-- 大文件阈值 -->
              <div class="grcp-wizard-field">
                <!-- 字段标签："清理大于此体积的文件" -->
                <span class="grcp-wizard-field-label">{{ i18n.bfgStripBigger }}</span>
                <Select
                  v-model="stripMb"
                  class="grcp-wizard-select"
                  size="small"
                  :options="stripOptions"
                />
              </div>

              <!-- 删除文件 glob（逗号分隔） -->
              <div class="grcp-wizard-field">
                <!-- 字段标签："按名称删除文件（逗号分隔 glob，如 id_rsa, *.log）" -->
                <span class="grcp-wizard-field-label">{{ i18n.bfgDeleteFiles }}</span>
                <Input
                  v-model="deleteFiles"
                  size="small"
                  :placeholder="i18n.bfgDeleteFilesPlaceholder"
                />
              </div>

              <!-- 删除文件夹 glob（逗号分隔） -->
              <div class="grcp-wizard-field">
                <!-- 字段标签："按名称删除文件夹（逗号分隔 glob，如 .svn, node_modules）" -->
                <span class="grcp-wizard-field-label">{{ i18n.bfgDeleteFolders }}</span>
                <Input
                  v-model="deleteFolders"
                  size="small"
                  :placeholder="i18n.bfgDeleteFoldersPlaceholder"
                />
              </div>

              <!-- 敏感文本替换规则（每行一条） -->
              <div class="grcp-wizard-field">
                <!-- 字段标签："敏感文本替换规则（每行一条，支持 原文==>替换值 与 regex: 前缀）" -->
                <span class="grcp-wizard-field-label">{{ i18n.bfgReplaceRules }}</span>
                <textarea
                  v-model="replaceText"
                  class="grcp-wizard-textarea"
                  rows="4"
                  :placeholder="i18n.bfgReplaceRulesPlaceholder"
                />
              </div>
            </div>

            <!-- 策略为空提示 -->
            <div
              v-if="!hasAnyStrategy"
              class="grcp-wizard-warning"
            >
              <Icon icon="mdi:alert-circle-outline" height="12" />
              <span>{{ i18n.bfgEmptyPlan }}</span>
            </div>
          </template>

          <!-- ── 阶段 2：前置检查 ── -->
          <template v-else-if="phase === 'check'">
            <div class="grcp-wizard-block">
              <!-- 区块标签："执行前检查" -->
              <label class="gp-label">{{ i18n.bfgChecks }}</label>
              <div class="grcp-check-list">
                <div
                  v-for="item in checkItems"
                  :key="item.key"
                  class="grcp-check-item"
                >
                  <Icon
                    :icon="item.ok ? 'mdi:check-circle-outline' : 'mdi:close-circle-outline'"
                    height="12"
                    :class="item.ok ? 'grcp-check-ok' : 'grcp-check-fail'"
                  />
                  <span>{{ item.label }}</span>
                  <!-- jar 缺失时内联下载按钮 -->
                  <button
                    v-if="item.key === 'jar' && !item.ok && !jarDownloading"
                    class="vp-btn vp-btn--ghost vp-btn--xs"
                    @click="downloadJar"
                  >
                    <Icon icon="mdi:download-outline" height="10" />
                    <!-- 按钮文案："下载" -->
                    {{ i18n.bfgDownloadJar }}
                  </button>
                  <span
                    v-if="item.key === 'jar' && jarDownloading"
                    class="grcp-check-progress"
                  >{{ jarProgress }}%</span>
                </div>
              </div>
            </div>

            <!-- 破坏性警告 -->
            <div class="grcp-wizard-warning grcp-wizard-warning--danger">
              <Icon icon="mdi:alert-circle-outline" height="12" />
              <span>{{ i18n.bfgWarnDestructive }}</span>
            </div>
            <div class="grcp-wizard-warning">
              <Icon icon="mdi:shield-lock-outline" height="12" />
              <span>{{ i18n.bfgWarnHeadProtected }}</span>
            </div>
          </template>

          <!-- ── 阶段 3：执行中 ── -->
          <template v-else-if="phase === 'running'">
            <!-- 六步步骤条 -->
            <div class="grcp-steps">
              <div
                v-for="(step, i) in STEPS"
                :key="step.key"
                class="grcp-step"
                :class="{ 'is-active': i === stepIndex, 'is-done': i < stepIndex }"
              >
                <Icon
                  :icon="i < stepIndex ? 'mdi:check-circle-outline' : 'mdi:circle-outline'"
                  height="12"
                />
                <!-- 步骤名："备份/镜像克隆/BFG 重写/压缩/回写" -->
                <span>{{ i18n[step.labelKey] }}</span>
              </div>
            </div>
            <!-- 实时日志 -->
            <CloneLogPanel
              :lines="log.lines.value"
              :running="true"
              :i18n="i18n"
            />
          </template>

          <!-- ── 阶段 4：结果 ── -->
          <template v-else>
            <!-- 前后体积对比 -->
            <div class="grcp-result-cards">
              <div class="grcp-result-card">
                <div class="grcp-card-value">{{ formatBytes(resultData?.sizeBefore ?? 0) }}</div>
                <!-- 卡片标签："清理前" -->
                <div class="grcp-card-label">{{ i18n.bfgResultBefore }}</div>
              </div>
              <div class="grcp-result-card">
                <div class="grcp-card-value">{{ formatBytes(resultData?.sizeAfter ?? 0) }}</div>
                <!-- 卡片标签："清理后" -->
                <div class="grcp-card-label">{{ i18n.bfgResultAfter }}</div>
              </div>
            </div>

            <!-- 备份路径 -->
            <div
              class="grcp-wizard-warning"
              :title="resultData?.backupPath"
            >
              <Icon icon="mdi:content-save-edit-outline" height="12" />
              <span class="grcp-backup-path">{{ i18n.bfgBackupPath }}: {{ resultData?.backupPath }}</span>
            </div>

            <!-- 强推提示 -->
            <div class="grcp-wizard-warning grcp-wizard-warning--danger">
              <Icon icon="mdi:alert-circle-outline" height="12" />
              <span>{{ i18n.bfgWarnForcePushAfter }}</span>
            </div>

            <!-- 执行/收尾实时日志（保留清理过程输出，收尾 fetch/gc 追加显示） -->
            <CloneLogPanel
              :lines="log.lines.value"
              :running="finalizing"
              :i18n="i18n"
              @clear="log.clear"
            />
          </template>
        </div>

        <div class="gp-dialog-footer">
          <!-- 底部提示（结果阶段显示各阶段耗时） -->
          <span class="grcp-wizard-hint">{{ footerHint }}</span>
          <div class="gp-grow" />

          <!-- 阶段 1：下一步 -->
          <button
            v-if="phase === 'plan'"
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="!hasAnyStrategy"
            @click="goCheck"
          >
            <!-- 按钮文案："下一步" -->
            {{ i18n.bfgNext }}
          </button>

          <!-- 阶段 2：返回 + 开始清理（红色危险按钮） -->
          <template v-if="phase === 'check'">
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              @click="phase = 'plan'"
            >
              <!-- 按钮文案："返回" -->
              {{ i18n.bfgBack }}
            </button>
            <button
              class="vp-btn vp-btn--danger vp-btn--sm"
              :disabled="!allChecksOk || running"
              @click="startClean"
            >
              <Icon icon="mdi:database-remove-outline" height="12" />
              <!-- 按钮文案："开始清理" -->
              {{ i18n.bfgStart }}
            </button>
          </template>

          <!-- 阶段 4：强推远端 + 完成 -->
          <template v-if="phase === 'result'">
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :disabled="forcePushing || finalizing"
              @click="forcePush"
            >
              <Icon
                :icon="forcePushing || finalizing ? 'mdi:loading' : 'mdi:cloud-upload-outline'"
                height="12"
                :class="{ 'gp-spin': forcePushing || finalizing }"
              />
              <!-- 按钮文案："强推远端"/"收尾中…" -->
              {{ finalizing ? i18n.bfgFinalizingBtn : i18n.bfgForcePush }}
            </button>
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              :disabled="forcePushing || finalizing"
              @click="finishWizard"
            >
              <!-- 按钮文案："完成" -->
              {{ i18n.bfgDone }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// gitPush BFG 历史清理向导弹窗（策略表单 → 前置检查 → 执行 → 结果，自包含调 manager）
import type { GitProject, BfgCleanPlan, BfgCleanResult } from "../../types"
import type { GitPushManager } from "../../GitPushManager"
import { Icon } from "@iconify/vue"
import { computed, onMounted, onUnmounted, ref } from "vue"
import { getErrorMessage } from "@/utils/stringUtils"
import CloneLogPanel from "../common/CloneLogPanel.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { formatBytes } from "./format"
import { useCloneLog } from "../../composables/useCloneLog"

/** 清理阶段标识 */
type Phase = "plan" | "check" | "running" | "result"

/** 六步工作流步骤定义（onStep 回传 step 标识对齐） */
const STEPS: { key: string, labelKey: string }[] = [
  { key: "backup", labelKey: "bfgStepBackup" },
  { key: "mirror", labelKey: "bfgStepMirror" },
  { key: "bfg", labelKey: "bfgStepBfg" },
  { key: "gc", labelKey: "bfgStepGc" },
  { key: "sync", labelKey: "bfgStepSync" },
]

const props = defineProps<{
  i18n: Record<string, any>
  manager: GitPushManager
  /** 目标项目（父面板已选中的当前项目） */
  project: GitProject
  /** 父面板当前阈值（默认选中项） */
  thresholdMb: number
}>()

const emit = defineEmits<{
  close: []
}>()

/** 当前阶段 */
const phase = ref<Phase>("plan")
/** 是否执行中（运行中禁用关闭/遮罩点击，防误触中断） */
const running = computed(() => phase.value === "running")

// ── 策略表单状态 ──
const stripMb = ref(props.thresholdMb)
const deleteFiles = ref("")
const deleteFolders = ref("")
const replaceText = ref("")

/** 大文件阈值选项（0 = 不启用） */
const stripOptions = computed(() => [
  { value: 0, label: props.i18n.bfgStripDisabled },
  ...[1, 5, 10, 50, 100].map((mb) => ({ value: mb, label: `≥ ${mb} MB` })),
])

/** 拆分逗号分隔 glob（去空 + 去重） */
function parseGlobs(s: string): string[] {
  return [...new Set(s.split(/[,，]/).map((g) => g.trim()).filter(Boolean))]
}

/** 是否配置了至少一项策略 */
const hasAnyStrategy = computed(() =>
  stripMb.value > 0 || parseGlobs(deleteFiles.value).length > 0
  || parseGlobs(deleteFolders.value).length > 0 || replaceText.value.trim().length > 0,
)

// ── 前置检查状态 ──
const runtime = ref<Awaited<ReturnType<GitPushManager["getBfgRuntime"]>> | null>(null)
const wtClean = ref(false)
const rebaseStuck = ref(true)
const jarDownloading = ref(false)
const jarProgress = ref(0)

/** 检查清单条目（key 对齐 i18n 键 bfgCheckWorkspace 等） */
const checkItems = computed(() => [
  { key: "workspace", ok: wtClean.value, label: props.i18n.bfgCheckWorkspace },
  { key: "rebase", ok: !rebaseStuck.value, label: props.i18n.bfgCheckRebase },
  { key: "java", ok: runtime.value?.javaOk ?? false, label: runtime.value?.javaOk ? `${props.i18n.bfgCheckJava} (${runtime.value.javaVersion})` : props.i18n.bfgCheckJava },
  { key: "jar", ok: runtime.value?.jarOk ?? false, label: props.i18n.bfgCheckJar },
])

/** 检查项是否全部通过 */
const allChecksOk = computed(() => checkItems.value.every((c) => c.ok))

// ── 执行状态 ──
const log = useCloneLog()
const stepIndex = ref(0)
/** 清理结果 */
const resultData = ref<BfgCleanResult | null>(null)
/** 强推状态 */
const forcePushing = ref(false)
/** 收尾状态（强推后自动 fetch --prune + gc） */
const finalizing = ref(false)
/** 强推/下载错误提示 */
const actionError = ref("")

/** 底部提示文案（结果阶段显示耗时，错误阶段显示错误） */
const footerHint = computed(() => {
  if (actionError.value) return actionError.value
  if (phase.value === "result" && resultData.value) {
    const total = Object.values(resultData.value.durations).reduce((a, b) => a + b, 0)
    return `${props.i18n.bfgDuration}: ${(total / 1000).toFixed(1)}s`
  }
  return props.i18n.bfgHintBackup
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && !running.value) emit("close")
}

function onMaskClick() {
  if (!running.value) emit("close")
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown)
})
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
})

/** 进入检查阶段：并行拉取运行时 + 工作区状态 */
async function goCheck() {
  phase.value = "check"
  runtime.value = null
  try {
    const [rt, wt, stuck] = await Promise.all([
      props.manager.getBfgRuntime(),
      props.manager.getWorkingTreeStatus(props.project.path),
      props.manager.isInRebaseState(props.project.path),
    ])
    runtime.value = rt
    wtClean.value = !wt.hasChanges
    rebaseStuck.value = stuck
  } catch (e) {
    actionError.value = getErrorMessage(e)
  }
}

/** 下载 bfg.jar（进度回显） */
async function downloadJar() {
  jarDownloading.value = true
  jarProgress.value = 0
  try {
    await props.manager.downloadBfgJar((pct) => { jarProgress.value = pct })
    runtime.value = await props.manager.getBfgRuntime()
  } catch (e) {
    actionError.value = getErrorMessage(e)
  } finally {
    jarDownloading.value = false
  }
}

/** 组装清理计划并开始六步执行 */
function startClean() {
  if (!allChecksOk.value) return
  const plan: BfgCleanPlan = {
    stripBiggerThanMb: stripMb.value,
    deleteFileGlobs: parseGlobs(deleteFiles.value),
    deleteFolderGlobs: parseGlobs(deleteFolders.value),
    replaceRules: replaceText.value.split("\n").map((l) => l.trim()).filter(Boolean),
  }

  phase.value = "running"
  stepIndex.value = 0
  log.start("bfg")
  actionError.value = ""

  void (async () => {
    try {
      const result = await props.manager.runBfgClean(props.project.path, plan, {
        onStep: (step) => {
          const idx = STEPS.findIndex((s) => s.key === step)
          if (idx >= 0) stepIndex.value = idx
        },
        onOutput: (chunk) => log.append(chunk),
      })
      resultData.value = result
      log.finish("done")
      phase.value = "result"
    } catch (e) {
      log.finish(getErrorMessage(e))
      actionError.value = getErrorMessage(e)
      // 失败回检查阶段让用户看到具体失败项
      phase.value = "check"
    }
  })()
}

/** 强推远端（复用现有 forcePushToAll；成功后自动收尾 fetch --prune + gc 清除本地残留） */
async function forcePush() {
  if (forcePushing.value || finalizing.value) return
  forcePushing.value = true
  actionError.value = ""
  try {
    const res = await props.manager.forcePushToAll(props.project.id)
    const platforms = [res.github, res.gitee, res.gitea, res.cnb]
    const failed = platforms.filter((r) => !r.ok)
    const pushMsg = failed.length > 0
      ? `${props.i18n.bfgForcePushDone}（${failed.length} ${props.i18n.bfgForcePushFailedCount}）`
      : props.i18n.bfgForcePushDone
    await runFinalize(pushMsg)
  } catch (e) {
    actionError.value = getErrorMessage(e)
  } finally {
    forcePushing.value = false
  }
}

/** 收尾：fetch --prune 全部远程 + reflog 过期 + gc（同步远程跟踪引用并物理清除本地残留） */
async function runFinalize(prefixMsg?: string) {
  finalizing.value = true
  try {
    log.append(`\n${props.i18n.bfgFinalizing}\n`)
    const { fetchErrors } = await props.manager.finalizeBfgClean(props.project.path, (chunk) => log.append(chunk))
    const suffix = fetchErrors.length > 0
      ? props.i18n.bfgFinalizeFetchFailed.replace("{0}", fetchErrors.map((e) => e.remote).join(", "))
      : props.i18n.bfgFinalizeDone
    actionError.value = prefixMsg ? `${prefixMsg}；${suffix}` : suffix
  } catch (e) {
    actionError.value = getErrorMessage(e)
  } finally {
    finalizing.value = false
  }
}

/** 完成关闭 */
function finishWizard() {
  emit("close")
}
</script>

<style lang="scss">
@use "../../styles/RepoCleanPanel.scss";
@use "../../styles/index.scss";
</style>
