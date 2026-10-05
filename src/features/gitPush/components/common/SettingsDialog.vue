<!-- gitPush 设置汇总弹窗：左侧分区导航（常规=并发数+分支模式 / 显示=分析显示设置 / Git 配置=全局配置管理） -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @keydown.enter="onEnterKey"
    @click.self="$emit('close')"
  >
    <div class="gp-dialog gp-dialog--settings">
      <!-- 弹窗头部 -->
      <div class="gp-dialog-header">
        <!-- 弹窗标题："设置" -->
        <span class="gp-dialog-title">{{ i18n.settings }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon
            icon="mdi:close"
            height="12"
          />
        </button>
      </div>

      <div class="gp-settings-layout">
        <!-- 左侧分区导航 -->
        <nav class="gp-settings-nav">
          <button
            v-for="sec in sections"
            :key="sec.id"
            class="gp-settings-nav-btn"
            :class="{ active: activeSection === sec.id }"
            :title="i18n[sec.labelKey]"
            @click="activeSection = sec.id"
          >
            <Icon
              :icon="sec.icon"
              height="14"
            />
            <!-- 导航项文案："常规"/"显示"/"Git 配置" -->
            <span>{{ i18n[sec.labelKey] }}</span>
          </button>
          <!-- 底部固定操作（tooltip："管理分类"）：点击后关闭设置并打开分类弹窗 -->
          <button
            class="gp-settings-nav-btn gp-settings-nav-manage"
            :title="i18n.manageCategories"
            @click="$emit('openCategory')"
          >
            <Icon
              icon="mdi:tag-outline"
              height="14"
            />
            <!-- 操作文案："管理分类" -->
            <span>{{ i18n.manageCategories }}</span>
          </button>
        </nav>

        <!-- 右侧内容区 -->
        <div class="gp-settings-content">
          <!-- ── 常规分区：并发数 + 推送分支模式 ── -->
          <template v-if="activeSection === 'general'">
            <!-- 并发数设置行 -->
            <div class="gp-set-row">
              <!-- 设置项标签："Git 并发数" -->
              <label class="gp-set-label">{{ i18n.gitConcurrency }}</label>
              <div class="gp-set-input-row">
                <Input
                  :model-value="localConcurrency"
                  type="number"
                  size="xsmall"
                  class="gp-set-concurrency-input"
                  @update:model-value="localConcurrency = clampGitConcurrency(Number($event))"
                />
                <button
                  class="vp-btn vp-btn--primary vp-btn--sm"
                  @click="saveConcurrency"
                >
                  <!-- 按钮文案："保存" -->
                  {{ i18n.save }}
                </button>
              </div>
            </div>
            <!-- 提示文案："同时执行的 git 子进程数上限（1~10）" -->
            <div class="gp-set-hint">
              {{ i18n.concurrencyHint }}
            </div>
            <!-- 推送分支模式设置行 -->
            <div class="gp-set-row gp-set-row--spaced">
              <!-- 设置项标签："推送分支模式" -->
              <label class="gp-set-label">{{ i18n.pushBranchModeLabel }}</label>
              <div class="gp-set-radio-group">
                <!-- 分支模式单选组（同组共用 name，方向键与 ARIA 语义方生效） -->
                <RadioButton
                  class="gp-set-radio"
                  name="gp-push-branch-mode"
                  :model-value="localBranchMode"
                  value="all"
                  size="xsmall"
                  :label="i18n.pushBranchAllOpt"
                  @update:model-value="localBranchMode = toBranchMode($event)"
                />
                <RadioButton
                  class="gp-set-radio"
                  name="gp-push-branch-mode"
                  :model-value="localBranchMode"
                  value="head"
                  size="xsmall"
                  :label="i18n.pushBranchHeadOpt"
                  @update:model-value="localBranchMode = toBranchMode($event)"
                />
              </div>
            </div>
            <!-- 提示文案："仅当前分支模式更快，避免推送无变更的其他分支" -->
            <div class="gp-set-hint">
              {{ i18n.pushBranchHint }}
            </div>
            <!-- 网络超时设置行 -->
            <div class="gp-set-row gp-set-row--spaced">
              <!-- 设置项标签："网络超时（秒）" -->
              <label class="gp-set-label">{{ i18n.networkTimeout }}</label>
              <div class="gp-set-input-row">
                <Input
                  :model-value="localNetworkTimeout"
                  type="number"
                  size="xsmall"
                  class="gp-set-concurrency-input"
                  @update:model-value="localNetworkTimeout = clampNetworkTimeout(Number($event))"
                />
                <button
                  class="vp-btn vp-btn--primary vp-btn--sm"
                  @click="saveNetworkTimeout"
                >
                  <!-- 按钮文案："保存" -->
                  {{ i18n.save }}
                </button>
              </div>
            </div>
            <!-- 提示文案："网络/推送命令超时上限（30~600 秒），推送大仓库时网络较慢可将值调大" -->
            <div class="gp-set-hint">
              {{ i18n.networkTimeoutHint }}
            </div>
            <!-- 本地提交索引：状态 + 开关 + 重建（统计「秒开 + 增量刷新」的基础） -->
            <div class="gp-set-row gp-set-row--spaced">
              <label class="gp-set-label">{{ i18n.indexTitle }}</label>
              <div class="gp-set-input-row">
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  :disabled="indexBusy"
                  @click="refreshIndexStatus"
                >
                  {{ i18n.indexRefreshStatus }}
                </button>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  :disabled="indexBusy"
                  :title="i18n.indexRebuildHint"
                  @click="rebuildIndex"
                >
                  {{ i18n.indexRebuild }}
                </button>
              </div>
            </div>
            <!-- 索引状态摘要：目录 + 已索引项目数/提交数；命中即表示统计不再重跑全量 git log -->
            <div class="gp-set-hint">
              <template v-if="indexStatus">
                <span v-if="!indexEnabled">{{ i18n.indexDisabled }}</span>
                <template v-else-if="indexStatus.projects.length === 0">
                  {{ i18n.indexEmpty }}
                </template>
                <template v-else>
                  {{ i18n.indexSummary
                    .replace("{0}", String(indexStatus.projects.length))
                    .replace("{1}", String(indexTotalCommits)) }}
                </template>
                <div
                  v-if="indexStatus.dir"
                  class="gp-set-index-dir"
                  :title="indexStatus.dir"
                >{{ indexStatus.dir }}</div>
              </template>
              <template v-else>
                {{ i18n.indexChecking }}
              </template>
            </div>
            <!-- 描述最短字数设置行（提交规则检查"描述过短"阈值） -->
            <div class="gp-set-row gp-set-row--spaced">
              <!-- 设置项标签："描述最短字数" -->
              <label class="gp-set-label">{{ i18n.ruleCheckMinSubjectLength }}</label>
              <div class="gp-set-input-row">
                <Input
                  :model-value="localMinSubjectLength"
                  type="number"
                  size="xsmall"
                  class="gp-set-concurrency-input"
                  @update:model-value="localMinSubjectLength = clampMinSubjectLength(Number($event))"
                />
                <button
                  class="vp-btn vp-btn--primary vp-btn--sm"
                  @click="saveMinSubjectLength"
                >
                  <!-- 按钮文案："保存" -->
                  {{ i18n.save }}
                </button>
              </div>
            </div>
            <!-- 提示文案："提交规则检查中描述少于该字数判为'描述过短'（1~100），修改后需重新分析生效" -->
            <div class="gp-set-hint">
              {{ i18n.ruleCheckMinSubjectLengthHint }}
            </div>
            <!-- 可选规则开关：描述首字母大写（勾选即时保存） -->
            <div class="gp-set-row gp-set-row--spaced">
              <!-- 设置项标签："描述首字母大写" -->
              <label class="gp-set-label">{{ i18n.ruleCheckOptCapitalized }}</label>
              <div class="gp-set-input-row">
                <input
                  type="checkbox"
                  class="gp-set-switch"
                  :checked="ruleConfig.requireCapitalizedSubject"
                  @change="onRuleToggle('requireCapitalizedSubject', $event)"
                />
              </div>
            </div>
            <!-- 提示文案："描述以小写英文字母开头时判违规，中文/数字开头不受影响" -->
            <div class="gp-set-hint">
              {{ i18n.ruleCheckOptCapitalizedHint }}
            </div>
            <!-- 可选规则开关：WIP 临时提交检测（勾选即时保存） -->
            <div class="gp-set-row gp-set-row--spaced">
              <!-- 设置项标签："WIP 临时提交检测" -->
              <label class="gp-set-label">{{ i18n.ruleCheckOptWip }}</label>
              <div class="gp-set-input-row">
                <input
                  type="checkbox"
                  class="gp-set-switch"
                  :checked="ruleConfig.detectWipSubject"
                  @change="onRuleToggle('detectWipSubject', $event)"
                />
              </div>
            </div>
            <!-- 提示文案："描述以 wip/todo/fixme/tbd 等临时标记开头判违规" -->
            <div class="gp-set-hint">
              {{ i18n.ruleCheckOptWipHint }}
            </div>
            <!-- 可选规则开关：scope 格式校验（勾选即时保存；默认关闭，见 DEFAULT_COMMIT_RULE_CONFIG 注释） -->
            <div class="gp-set-row gp-set-row--spaced">
              <!-- 设置项标签："scope 格式校验" -->
              <label class="gp-set-label">{{ i18n.ruleCheckOptScopeFormat }}</label>
              <div class="gp-set-input-row">
                <input
                  type="checkbox"
                  class="gp-set-switch"
                  :checked="ruleConfig.scopeFormatEnabled"
                  @change="onRuleToggle('scopeFormatEnabled', $event)"
                />
              </div>
            </div>
            <!-- 提示文案："开启后 scope 仅允许小写字母、数字、连字符（如 hid-helper）；关闭则不限写法，仅拦截空 scope" -->
            <div class="gp-set-hint">
              {{ i18n.ruleCheckOptScopeFormatHint }}
            </div>
            <!-- 可选规则开关：正文行长限制（勾选即时保存 + 行长阈值输入） -->
            <div class="gp-set-row gp-set-row--spaced">
              <!-- 设置项标签："正文行长限制" -->
              <label class="gp-set-label">{{ i18n.ruleCheckOptBodyLineLimit }}</label>
              <div class="gp-set-input-row">
                <input
                  type="checkbox"
                  class="gp-set-switch"
                  :checked="ruleConfig.bodyLineLimitEnabled"
                  @change="onRuleToggle('bodyLineLimitEnabled', $event)"
                />
                <Input
                  :model-value="localMaxBodyLineLength"
                  type="number"
                  size="xsmall"
                  class="gp-set-concurrency-input"
                  :disabled="!ruleConfig.bodyLineLimitEnabled"
                  @update:model-value="localMaxBodyLineLength = clampMaxBodyLineLength(Number($event))"
                />
                <button
                  class="vp-btn vp-btn--primary vp-btn--sm"
                  @click="saveBodyLineLimit"
                >
                  <!-- 按钮文案："保存" -->
                  {{ i18n.save }}
                </button>
              </div>
            </div>
            <!-- 提示文案："多行提交信息正文每行超过该字符数判违规（1~500），空行不检查" -->
            <div class="gp-set-hint">
              {{ i18n.ruleCheckOptBodyLineLimitHint }}
            </div>
            <!-- AI diff 上下文预算设置行（生成提交信息时送入 AI 的字符预算） -->
            <div class="gp-set-row gp-set-row--spaced">
              <!-- 设置项标签："Diff 上下文预算" -->
              <label class="gp-set-label">{{ i18n.ruleCheckDiffBudget }}</label>
              <div class="gp-set-input-row">
                <Input
                  :model-value="localDiffContextBudget"
                  type="number"
                  size="xsmall"
                  class="gp-set-concurrency-input"
                  @update:model-value="localDiffContextBudget = clampDiffContextBudget(Number($event))"
                />
                <button
                  class="vp-btn vp-btn--primary vp-btn--sm"
                  @click="saveDiffContextBudget"
                >
                  <!-- 按钮文案："保存" -->
                  {{ i18n.save }}
                </button>
              </div>
            </div>
            <!-- 提示文案："AI 生成提交信息时按文件分块送入的 diff 字符上限（1000~50000），改动文件较多时可调大" -->
            <div class="gp-set-hint">
              {{ i18n.ruleCheckDiffBudgetHint }}
            </div>
          </template>

          <!-- ── 显示分区：提交分析显示设置 ── -->
          <template v-else-if="activeSection === 'display'">
            <!-- 提示文案："改动即时保存并生效" -->
            <div class="gp-set-hint">
              {{ i18n.settingsDisplayHint }}
            </div>
            <AnalysisSettingsForm
              :i18n="i18n"
              :view-settings="viewSettings"
              :years="yearOptions"
              @update="$emit('updateViewSettings', $event)"
            />
          </template>

          <!-- ── Git 配置分区：全局 Git 配置管理（自包含，直接写入 ~/.gitconfig）── -->
          <GitConfigSection
            v-else
            :i18n="i18n"
            :manager="manager"
            scope="global"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 设置汇总弹窗（分区导航：常规 / 显示 / Git 配置，各分区改动即时或按钮保存）
import type {
  CommitAnalysisViewSettings,
  CommitRuleConfig,
  GitPushManager,
} from "../../types"
import { Icon } from "@iconify/vue"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"
import Input from "@/components/Input.vue"
import RadioButton from "@/components/RadioButton.vue"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"
import {
  clampDiffContextBudget,
  clampGitConcurrency,
  clampMaxBodyLineLength,
  clampMinSubjectLength,
  clampNetworkTimeout,
} from "../../types"
import AnalysisSettingsForm from "../CommitAnalysis/AnalysisSettingsForm.vue"
import GitConfigSection from "./GitConfigSection.vue"

type SettingsSection = "general" | "display" | "gitconfig"

const props = defineProps<{
  i18n: Record<string, any>
  manager: GitPushManager
  concurrency: number
  /** 网络命令超时（秒） */
  networkTimeout: number
  /** 提交规则配置（最短描述阈值 + 可选规则开关） */
  ruleConfig: CommitRuleConfig
  pushBranchMode: "all" | "head"
  /** 提交分析显示设置（父级预载后下发，与 popover 入口同源） */
  viewSettings: CommitAnalysisViewSettings
  /** 显示设置年份选项（数据年份 ∪ 今年 ∪ 已保存年份） */
  yearOptions: number[]
}>()

const emit = defineEmits<{
  close: []
  save: [value: number]
  saveNetworkTimeout: [value: number]
  /** 提交规则配置局部更新（开关即时/阈值保存按钮与 Enter 键共用） */
  saveRuleConfig: [patch: Partial<CommitRuleConfig>]
  saveBranchMode: [mode: "all" | "head"]
  updateViewSettings: [patch: Partial<CommitAnalysisViewSettings>]
  /** 底部「管理分类」操作：由父级关闭设置弹窗并打开分类弹窗 */
  openCategory: []
}>()

/** 分区导航元数据（图标均为本地 MDI 集已注册图标） */
const sections: { id: SettingsSection, icon: string, labelKey: string }[] = [
  {
    id: "general",
    icon: "mdi:tune",
    labelKey: "settingsSectionGeneral",
  },
  {
    id: "display",
    icon: "mdi:eye-outline",
    labelKey: "settingsSectionDisplay",
  },
  {
    id: "gitconfig",
    icon: "mdi:source-branch",
    labelKey: "settingsSectionGitConfig",
  },
]

const localConcurrency = ref(clampGitConcurrency(props.concurrency))
const localNetworkTimeout = ref(clampNetworkTimeout(props.networkTimeout))
const localMinSubjectLength = ref(clampMinSubjectLength(props.ruleConfig.minSubjectLength))
const localMaxBodyLineLength = ref(clampMaxBodyLineLength(props.ruleConfig.maxBodyLineLength))
const localDiffContextBudget = ref(clampDiffContextBudget(props.ruleConfig.diffContextBudget))
const localBranchMode = ref<"all" | "head">(props.pushBranchMode)

/** Select/RadioButton 载荷收窄为分支模式：非枚举值回退 "head"（与默认行为一致） */
function toBranchMode(value: unknown): "all" | "head" {
  return value === "all" ? "all" : "head"
}
const activeSection = ref<SettingsSection>("general")
// ⚠️ `rootRef` 必须保留为本地绑定：模板 `ref="rootRef"` 依赖它把根节点交给 composable 聚焦。
// TS 看不到「模板里的使用」，故以 void 显式消费，避免 noUnusedLocals 误判（下同各弹窗）。
const { rootRef } = useDialogKeyboard()
void rootRef

// 分支模式即时保存（radio 切换立即持久化，无需保存按钮）
watch(localBranchMode, (mode) => emit("saveBranchMode", mode))

// ── 本地提交索引状态（确认索引是否生效的可视入口）──

/** 索引状态摘要（null = 尚未查询/查询中） */
const indexStatus = ref<{ dir: string, projects: Array<{ projectId: string, commits: number, complete: boolean, analyzedAt: string }> } | null>(null)
/** 索引开关当前值（关闭时统计回退直接跑 git） */
const indexEnabled = ref(true)
/** 索引操作进行中（防并发点击） */
const indexBusy = ref(false)

/** 已索引项目的提交总数（状态摘要展示用） */
const indexTotalCommits = computed(() => {
  const list = indexStatus.value?.projects ?? []
  return list.reduce((sum, p) => sum + p.commits, 0)
})

/** 查询索引状态（打开弹窗时自动调用，也可手动刷新） */
async function refreshIndexStatus() {
  indexBusy.value = true
  try {
    indexEnabled.value = await props.manager.isIndexEnabled()
    indexStatus.value = await props.manager.getIndexStatus()
  } catch (e) {
    console.warn("[gitPush] 读取索引状态失败", e)
    indexStatus.value = {
      dir: "",
      projects: [],
    }
  } finally {
    indexBusy.value = false
  }
}

/** 重建索引：清空后立即对当前项目全量重扫（用于排障或数据结构升级后） */
async function rebuildIndex() {
  if (indexBusy.value) return
  indexBusy.value = true
  try {
    await props.manager.clearIndex()
    await refreshIndexStatus()
    showMessage(props.i18n.indexRebuilt, 3000, "info")
  } catch (e) {
    showMessage(String(e), 3000, "error")
  } finally {
    indexBusy.value = false
  }
}

// 打开弹窗即查询一次，用户无需额外操作即可看到索引是否在工作
onMounted(() => {
  void refreshIndexStatus()
})

/** 保存并发数（保存按钮 / Enter 键共用；汇总页多分区场景保存后不关闭弹窗） */
function saveConcurrency() {
  emit("save", localConcurrency.value)
}

/** 保存网络超时（保存按钮 / Enter 键共用） */
function saveNetworkTimeout() {
  emit("saveNetworkTimeout", localNetworkTimeout.value)
}

/** 保存描述最短字数（保存按钮 / Enter 键共用） */
function saveMinSubjectLength() {
  emit("saveRuleConfig", { minSubjectLength: localMinSubjectLength.value })
}

/** 保存正文行长上限（保存按钮 / Enter 键共用） */
function saveBodyLineLimit() {
  emit("saveRuleConfig", { maxBodyLineLength: localMaxBodyLineLength.value })
}

/** 保存 Diff 上下文预算（保存按钮 / Enter 键共用） */
function saveDiffContextBudget() {
  emit("saveRuleConfig", { diffContextBudget: localDiffContextBudget.value })
}

/** 可选规则开关切换（checkbox 即时保存，同分支模式 radio 即时语义） */
function onRuleToggle(key: "requireCapitalizedSubject" | "detectWipSubject" | "scopeFormatEnabled" | "bodyLineLimitEnabled", e: Event) {
  const patch: Partial<CommitRuleConfig> = {}
  patch[key] = (e.target as HTMLInputElement).checked
  emit("saveRuleConfig", patch)
}

/** Enter 键仅在常规分区保存并发数、网络超时、描述最短字数、正文行长与 Diff 预算（Git 配置分区输入由组件内 stop 拦截，显示分区无提交语义） */
function onEnterKey() {
  if (activeSection.value === "general") {
    saveConcurrency()
    saveNetworkTimeout()
    saveMinSubjectLength()
    saveBodyLineLimit()
    saveDiffContextBudget()
  }
}
</script>

<style lang="scss">
@use "../../styles/SettingsDialog.scss";
@use "../../styles/index.scss";
</style>
