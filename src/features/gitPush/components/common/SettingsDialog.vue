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
            <!-- 本地提交索引：开关 + 状态 + 重建（统计「秒开 + 增量刷新」的基础） -->
            <div class="gp-set-row gp-set-row--spaced">
              <label class="gp-set-label">{{ i18n.indexTitle }}</label>
              <div class="gp-set-input-row">
                <!-- 索引总开关：关闭后统计路径全部回退直接跑 git（行为与改造前一致） -->
                <ToggleButton
                  :model-value="indexEnabled"
                  size="xsmall"
                  dense
                  :on-label="i18n.indexEnabledLabel"
                  :off-label="i18n.indexDisabledLabel"
                  :aria-label="i18n.indexToggleTip"
                  :title="i18n.indexToggleTip"
                  :disabled="indexBusy"
                  @update:model-value="toggleIndexEnabled"
                />
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  :disabled="indexBusy"
                  @click="refreshIndexStatus"
                >
                  {{ i18n.indexRefreshStatus }}
                </button>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  :disabled="indexBusy || !indexEnabled"
                  :title="i18n.indexRebuildHint"
                  @click="rebuildIndex"
                >
                  {{ i18n.indexRebuild }}
                </button>
              </div>
            </div>
            <!-- 索引状态摘要：目录 + 已索引项目数/提交数；命中即表示统计不再重跑全量 git log -->
            <div class="gp-set-hint">
              <!-- 读取失败与「索引为空」必须区分：否则目录不可写会伪装成正常空态 -->
              <span v-if="indexError">{{ i18n.indexLoadFailed }}</span>
              <template v-else-if="indexStatus">
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
            <!-- ── 实时探测（三层：文件监听 → 工作区轮询 → 网络轮询）── -->
            <div class="gp-set-section-title">
              {{ i18n.probeTitle }}
            </div>
            <!-- 第 1 层：.git 文件监听（0 次 git 子进程，捕获提交/切分支/fetch） -->
            <div class="gp-set-row gp-set-row--spaced">
              <label class="gp-set-label">{{ i18n.probeWatchLabel }}</label>
              <div class="gp-set-input-row">
                <ToggleButton
                  :model-value="localProbe.watch.enabled"
                  size="xsmall"
                  dense
                  :on-label="i18n.probeOn"
                  :off-label="i18n.probeOff"
                  :aria-label="i18n.probeWatchLabel"
                  :title="i18n.probeWatchHint"
                  @update:model-value="patchProbe({ watch: { enabled: $event } })"
                />
              </div>
            </div>
            <div class="gp-set-hint">
              {{ i18n.probeWatchHint }}
              <!-- 已建立监听的项目数：0 且开关为开 = 环境不支持，已自动降级到轮询层 -->
              <span v-if="localProbe.watch.enabled">
                {{ i18n.probeWatchedCount.replace("{0}", String(probeWatchedCount)) }}
              </span>
            </div>
            <!-- 第 2 层：工作区轮询（stat 预筛 + 指数退避） -->
            <div class="gp-set-row gp-set-row--spaced">
              <label class="gp-set-label">{{ i18n.probePollLabel }}</label>
              <div class="gp-set-input-row">
                <ToggleButton
                  :model-value="localProbe.poll.enabled"
                  size="xsmall"
                  dense
                  :on-label="i18n.probeOn"
                  :off-label="i18n.probeOff"
                  :aria-label="i18n.probePollLabel"
                  :title="i18n.probePollHint"
                  @update:model-value="patchProbe({ poll: { enabled: $event } })"
                />
                <Input
                  :model-value="localPollIntervalDraft"
                  type="number"
                  size="xsmall"
                  class="gp-set-concurrency-input"
                  :disabled="!localProbe.poll.enabled"
                  @update:model-value="onPollIntervalInput"
                  @change="commitPollInterval"
                  @blur="commitPollInterval"
                />
                <!-- 立即检测：动作是「跑一轮本地状态查询」，故放在轮询分区且跟随轮询开关，
                     而非网络分区（否则语义与开关都错位） -->
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  :disabled="!localProbe.poll.enabled"
                  :title="i18n.probeNowHint"
                  @click="emit('probeNow')"
                >
                  {{ i18n.probeNow }}
                </button>
              </div>
            </div>
            <div class="gp-set-hint">
              {{ i18n.probePollHint }}
            </div>
            <!-- stat 预筛：零子进程判断「值不值得跑 git」，是减少 git 进程数的关键 -->
            <div class="gp-set-row gp-set-row--spaced">
              <label class="gp-set-label">{{ i18n.probePrefilterLabel }}</label>
              <div class="gp-set-input-row">
                <ToggleButton
                  :model-value="localProbe.poll.statPrefilter"
                  size="xsmall"
                  dense
                  :on-label="i18n.probeOn"
                  :off-label="i18n.probeOff"
                  :aria-label="i18n.probePrefilterLabel"
                  :title="i18n.probePrefilterHint"
                  :disabled="!localProbe.poll.enabled"
                  @update:model-value="patchProbe({ poll: { statPrefilter: $event } })"
                />
              </div>
            </div>
            <div class="gp-set-hint">
              {{ i18n.probePrefilterHint }}
            </div>
            <!-- 第 3 层：网络轮询（唯一能发现「需拉取」的层，默认关闭） -->
            <div class="gp-set-row gp-set-row--spaced">
              <label class="gp-set-label">{{ i18n.probeNetworkLabel }}</label>
              <div class="gp-set-input-row">
                <ToggleButton
                  :model-value="localProbe.network.enabled"
                  size="xsmall"
                  dense
                  :on-label="i18n.probeOn"
                  :off-label="i18n.probeOff"
                  :aria-label="i18n.probeNetworkLabel"
                  :title="i18n.probeNetworkHint"
                  @update:model-value="patchProbe({ network: { enabled: $event } })"
                />
              </div>
            </div>
            <div class="gp-set-hint">
              {{ i18n.probeNetworkHint }}
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
  ProbeConfig,
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
import ToggleButton from "@/components/ToggleButton.vue"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"
import {
  clampDiffContextBudget,
  clampGitConcurrency,
  clampMaxBodyLineLength,
  clampMinSubjectLength,
  clampNetworkTimeout,
} from "../../types"
import { clampProbeConfig } from "../../types/probeConfig"
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
  /** 实时探测配置（三层：文件监听 / 工作区轮询 / 网络轮询） */
  probeConfig: ProbeConfig
  /** 已建立 .git 文件监听的项目数（0 = 环境不支持或监听关闭，已降级到轮询层） */
  probeWatchedCount: number
}>()

const emit = defineEmits<{
  close: []
  save: [value: number]
  saveNetworkTimeout: [value: number]
  /** 提交规则配置局部更新（开关即时/阈值保存按钮与 Enter 键共用） */
  saveRuleConfig: [patch: Partial<CommitRuleConfig>]
  saveBranchMode: [mode: "all" | "head"]
  updateViewSettings: [patch: Partial<CommitAnalysisViewSettings>]
  /** 实时探测配置变更（即时保存并让运行中的探测按新配置重排） */
  saveProbeConfig: [config: ProbeConfig]
  /** 立即探测一次（清空预筛基准强制真查） */
  probeNow: []
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

// ── 实时探测（三层）本地编辑态：改动即时保存并下发父级重排运行中的探测 ──

/** 探测配置本地副本（父级 probeConfig 为权威值，此处仅承载编辑态） */
const localProbe = ref<ProbeConfig>(clampProbeConfig(props.probeConfig))

// 父级配置变化（如首次异步加载完成）时同步下来，避免弹窗停留在默认值
watch(() => props.probeConfig, (cfg) => {
  localProbe.value = clampProbeConfig(cfg)
}, { deep: true })

/**
 * 提交探测配置变更（归一化后下发）。
 * 逐字段合并而非整体替换：调用方只改一个开关时不必构造完整对象。
 */
function patchProbe(patch: {
  watch?: Partial<ProbeConfig["watch"]>
  poll?: Partial<ProbeConfig["poll"]>
  network?: Partial<ProbeConfig["network"]>
}) {
  const next = clampProbeConfig({
    watch: { ...localProbe.value.watch, ...patch.watch },
    poll: { ...localProbe.value.poll, ...patch.poll },
    network: { ...localProbe.value.network, ...patch.network },
  })
  localProbe.value = next
  emit("saveProbeConfig", next)
}

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

/**
 * 轮询间隔输入的**未钳位草稿**（字符串）。
 *
 * 为什么不直接把 `localProbe.poll.intervalMs` 绑给 Input：
 *   该 Input 是受控字段，而 `patchProbe` 每次都会走 `clampProbeConfig` 钳位（下限 5000）。
 *   于是清空输入框 → `Number("") === 0` → 立即被抬回 5000 写回，DOM 重渲染成 "5000"，
 *   用户**根本无法键入多位数**（输 "3" 就被抬成 5000）。故用草稿串承接键入过程，
 *   只在 change/blur 时钳位并提交。
 */
const localPollIntervalDraft = ref(String(props.probeConfig.poll.intervalMs))

/** 键入过程中只更新草稿，不做钳位（允许出现暂时越界或空串） */
function onPollIntervalInput(value: unknown) {
  localPollIntervalDraft.value = String(value ?? "")
}

/** 失焦/提交时钳位并下发；空串或非法值回退到当前生效值，避免误清成下限 */
function commitPollInterval() {
  const parsed = Number(localPollIntervalDraft.value)
  if (!Number.isFinite(parsed) || localPollIntervalDraft.value.trim() === "") {
    localPollIntervalDraft.value = String(localProbe.value.poll.intervalMs)
    return
  }
  patchProbe({ poll: { intervalMs: parsed } })
  // 以钳位后的权威值回填草稿（用户输入越界时立刻看到被纠正为合法值）
  localPollIntervalDraft.value = String(localProbe.value.poll.intervalMs)
}

// 父级配置变化时同步草稿（如首次异步加载完成、或钳位后回填）
watch(() => localProbe.value.poll.intervalMs, (ms) => {
  localPollIntervalDraft.value = String(ms)
})

// ── 本地提交索引状态（确认索引是否生效的可视入口）──

/** 索引状态摘要（null = 尚未查询/查询中） */
const indexStatus = ref<{ dir: string, projects: Array<{ projectId: string, commits: number, complete: boolean, analyzedAt: string }> } | null>(null)
/** 索引开关当前值（关闭时统计回退直接跑 git） */
const indexEnabled = ref(true)
/** 索引操作进行中（防并发点击） */
const indexBusy = ref(false)
/**
 * 索引状态读取失败（与「索引为空」区分展示）。
 * 目录不可写/权限拒绝时若也归入空态，用户无法察觉索引其实坏了。
 */
const indexError = ref(false)
/**
 * 索引操作的并发深度。
 * `rebuildIndex` 会内层调用 `refreshIndexStatus`，若各自在 finally 里清 `indexBusy`，
 * 内层结束就会提前解锁按钮（外层仍在跑），"防并发点击"形同虚设。
 * 故用深度计数：只有最外层结束时才复位。
 */
let indexBusyDepth = 0

function beginIndexBusy() {
  indexBusyDepth++
  indexBusy.value = true
}

function endIndexBusy() {
  indexBusyDepth = Math.max(0, indexBusyDepth - 1)
  indexBusy.value = indexBusyDepth > 0
}

/** 已索引项目的提交总数（状态摘要展示用） */
const indexTotalCommits = computed(() => {
  const list = indexStatus.value?.projects ?? []
  return list.reduce((sum, p) => sum + p.commits, 0)
})

/** 查询索引状态（打开弹窗时自动调用，也可手动刷新） */
async function refreshIndexStatus() {
  beginIndexBusy()
  try {
    indexEnabled.value = await props.manager.isIndexEnabled()
    indexStatus.value = await props.manager.getIndexStatus()
    indexError.value = false
  } catch (e) {
    console.warn("[gitPush] 读取索引状态失败", e)
    indexStatus.value = null
    indexError.value = true
  } finally {
    endIndexBusy()
  }
}

/** 切换索引开关（关闭后统计路径全部回退直接跑 git；下次统计生效） */
async function toggleIndexEnabled() {
  if (indexBusy.value) return
  beginIndexBusy()
  try {
    const next = !indexEnabled.value
    await props.manager.setIndexEnabled(next)
    indexEnabled.value = next
    showMessage(next ? props.i18n.indexEnabledOn : props.i18n.indexEnabledOff, 3000, "info")
    // 关闭后状态摘要已无意义（索引不再参与统计）；开启则重新查询一次
    if (next) await refreshIndexStatus()
  } catch (e) {
    showMessage(String(e), 3000, "error")
  } finally {
    endIndexBusy()
  }
}

/**
 * 重建索引：清空索引，下次统计时按当前结构全量重建。
 * 只做清空不做立即重扫（重扫需用户进入统计视图，那里有进度反馈）。
 */
async function rebuildIndex() {
  if (indexBusy.value) return
  beginIndexBusy()
  try {
    await props.manager.clearIndex()
    await refreshIndexStatus()
    showMessage(props.i18n.indexRebuilt, 3000, "info")
  } catch (e) {
    showMessage(String(e), 3000, "error")
  } finally {
    endIndexBusy()
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
