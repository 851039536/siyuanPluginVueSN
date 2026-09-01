<!-- 远程与本地一致性分析弹窗：批量比对所有项目各本地分支与各远程分支（存在性/领先/落后/分叉），支持先 fetch --prune -->
<template>
  <Transition name="gp-dialog-fade">
    <div
      ref="rootRef"
      tabindex="-1"
      class="gca-mask"
      @keydown.escape="emit('close')"
      @click.self="emit('close')"
    >
      <div class="gca-dialog">
        <!-- 头部：标题 + 关闭 -->
        <div class="gca-header">
          <span class="gca-title">{{ i18n.consistencyTitle }}</span>
          <button
            class="gca-close"
            :title="i18n.close"
            @click="emit('close')"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>

        <!-- 工具栏：fetch 开关 + 仅显示问题开关 + 分析按钮 -->
        <div class="gca-toolbar">
          <!-- 开关："分析前先 fetch 远程"（悬停提示解释 fetch 含义与开关影响） -->
          <label
            class="gca-switch-item"
            :title="i18n.consistencyFetchFirstTip"
          >
            <SiSwitch
              v-model="fetchFirst"
              size="xsmall"
              :disabled="analyzing"
            />
            <span>{{ i18n.consistencyFetchFirst }}</span>
          </label>
          <!-- 开关："仅显示问题" -->
          <label class="gca-switch-item">
            <SiSwitch
              v-model="issueOnly"
              size="xsmall"
            />
            <span>{{ i18n.consistencyIssueOnly }}</span>
          </label>
          <!-- 按钮："开始分析"/"重新分析"（分析中转圈禁用） -->
          <button
            class="vp-btn vp-btn--primary vp-btn--sm gca-run-btn"
            :disabled="analyzing"
            @click="runAudit"
          >
            <Icon
              :icon="analyzing ? 'mdi:loading' : 'mdi:magnify-scan'"
              height="12"
              :class="{ 'gca-spin': analyzing }"
            />
            <span>{{ analyzed ? i18n.consistencyRerun : i18n.consistencyRun }}</span>
          </button>
        </div>

        <!-- 未分析提示 -->
        <div
          v-if="!analyzed && !analyzing"
          class="gca-hint"
        >
          {{ i18n.consistencyHint }}
        </div>

        <!-- 分析中进度："分析中… 12/34" -->
        <div
          v-else-if="analyzing"
          class="gca-progress"
        >
          <Icon
            icon="mdi:loading"
            height="12"
            class="gca-spin"
          />
          <span>{{ i18n.consistencyAnalyzing }} {{ progress.done }}/{{ progress.total }}</span>
        </div>

        <template v-else>
          <!-- 暂无项目空态 -->
          <div
            v-if="projectCount === 0"
            class="gca-hint"
          >
            {{ i18n.consistencyNoProjects }}
          </div>
          <!-- 全部一致空态 -->
          <div
            v-else-if="displayRows.length === 0"
            class="gca-all-clear"
          >
            <Icon
              icon="mdi:check-all"
              height="12"
            />
            <span>{{ i18n.consistencyAllClear }}</span>
          </div>
          <!-- 结果区：七态汇总 chips + 项目分组表格 -->
          <template v-else>
            <div class="gca-summary">
              <div
                v-for="chip in SUMMARY_CHIPS"
                :key="chip.state"
                class="gca-chip"
                :class="`gca-chip--${chip.state}`"
                :title="i18n[chip.labelKey]"
              >
                <Icon
                  :icon="chip.icon"
                  height="12"
                />
                <span>{{ summary[chip.state] }}</span>
              </div>
            </div>
            <div class="gca-results">
              <div
                v-for="row in displayRows"
                :key="row.id"
                class="gca-project"
              >
                <!-- 项目头行（点击跳转项目卡片） -->
                <div
                  class="gca-project-head"
                  :title="row.path"
                  @click="emit('viewProject', row.id)"
                >
                  <Icon
                    icon="mdi:chevron-right"
                    height="12"
                  />
                  <span class="gca-project-name">{{ row.name }}</span>
                  <!-- 项目级问题徽章："路径无效或检测失败"/"未配置远程"/"空仓库或无分支" -->
                  <span
                    v-if="row.error"
                    class="gca-badge gca-badge--error"
                  >{{ i18n.consistencyStateError }}</span>
                  <span
                    v-if="row.noRemote"
                    class="gca-badge gca-badge--warn"
                  >{{ i18n.consistencyNoRemote }}</span>
                  <span
                    v-if="row.noBranches"
                    class="gca-badge gca-badge--warn"
                  >{{ i18n.consistencyNoBranches }}</span>
                  <!-- fetch 失败徽章（tooltip 列出各远程失败原因） -->
                  <span
                    v-if="fetchErrorTitle(row)"
                    class="gca-badge gca-badge--warn"
                    :title="fetchErrorTitle(row)"
                  >{{ i18n.consistencyFetchFailed }}</span>
                </div>
                <!-- 分支比对表 -->
                <div
                  v-if="row.branches.length > 0"
                  class="gca-table"
                >
                  <div class="gca-tr gca-tr--head">
                    <!-- 表头："分支" -->
                    <span class="gca-td gca-td--branch">{{ i18n.consistencyColBranch }}</span>
                    <!-- 表头："远程" -->
                    <span class="gca-td gca-td--remote">{{ i18n.consistencyColRemote }}</span>
                    <!-- 表头："状态" -->
                    <span class="gca-td gca-td--state">{{ i18n.consistencyColStatus }}</span>
                    <!-- 表头："领先/落后" -->
                    <span class="gca-td gca-td--diff">{{ i18n.consistencyColDiff }}</span>
                  </div>
                  <div
                    v-for="(b, bi) in row.branches"
                    :key="`${b.remote}/${b.branch}/${bi}`"
                    class="gca-tr"
                  >
                    <span class="gca-td gca-td--branch">
                      {{ b.branch }}
                      <!-- 当前分支标记 -->
                      <Icon
                        v-if="b.current"
                        icon="mdi:circle-medium"
                        height="12"
                        class="gca-current-dot"
                        :title="i18n.consistencyCurrentBranch"
                      />
                    </span>
                    <span class="gca-td gca-td--remote">{{ b.remote }}</span>
                    <span class="gca-td gca-td--state">
                      <Icon
                        :icon="STATE_META[b.state].icon"
                        height="12"
                        :class="`gca-state--${b.state}`"
                      />
                      <span>{{ i18n[STATE_META[b.state].labelKey] }}</span>
                    </span>
                    <span class="gca-td gca-td--diff">{{ diffText(b) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </template>

        <!-- 底部操作栏 -->
        <div class="gca-footer">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            @click="emit('close')"
          >{{ i18n.close }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type {
  ConsistencyBranchRow,
  ConsistencyProjectRow,
  ConsistencyState,
  GitPushManager,
} from "../../types"
import { Icon } from "@iconify/vue"
import { onMounted, ref } from "vue"
import SiSwitch from "@/components/Switch.vue"
import { useConsistencyAudit } from "../../composables/useConsistencyAudit"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"

const props = defineProps<{
  i18n: Record<string, any>
  manager: GitPushManager
}>()

const emit = defineEmits<{
  close: []
  viewProject: [projectId: string]
}>()

const {
  displayRows,
  analyzing,
  analyzed,
  fetchFirst,
  issueOnly,
  progress,
  summary,
  runAudit,
} = useConsistencyAudit(props.manager)

/** 项目总数（空态判断用，挂载时快照） */
const projectCount = ref(0)
onMounted(async () => {
  try {
    projectCount.value = (await props.manager.getProjects()).length
  } catch {
    projectCount.value = 0
  }
})

// 七态图标 + 文案键（cls 对应 gca-chip--*/gca-state--* 修饰类）
const STATE_META: Record<ConsistencyState, { icon: string, labelKey: string }> = {
  synced: { icon: "mdi:check-circle-outline", labelKey: "consistencySynced" },
  ahead: { icon: "mdi:arrow-up", labelKey: "consistencyAhead" },
  behind: { icon: "mdi:arrow-down", labelKey: "consistencyBehind" },
  diverged: { icon: "mdi:call-split", labelKey: "consistencyDiverged" },
  localOnly: { icon: "mdi:laptop", labelKey: "consistencyLocalOnly" },
  remoteOnly: { icon: "mdi:cloud-outline", labelKey: "consistencyRemoteOnly" },
  error: { icon: "mdi:alert-circle-outline", labelKey: "consistencyStateError" },
}

// 汇总 chips 顺序
const SUMMARY_CHIPS: { state: ConsistencyState, icon: string, labelKey: string }[] = [
  { state: "synced", icon: STATE_META.synced.icon, labelKey: STATE_META.synced.labelKey },
  { state: "ahead", icon: STATE_META.ahead.icon, labelKey: STATE_META.ahead.labelKey },
  { state: "behind", icon: STATE_META.behind.icon, labelKey: STATE_META.behind.labelKey },
  { state: "diverged", icon: STATE_META.diverged.icon, labelKey: STATE_META.diverged.labelKey },
  { state: "localOnly", icon: STATE_META.localOnly.icon, labelKey: STATE_META.localOnly.labelKey },
  { state: "remoteOnly", icon: STATE_META.remoteOnly.icon, labelKey: STATE_META.remoteOnly.labelKey },
  { state: "error", icon: STATE_META.error.icon, labelKey: STATE_META.error.labelKey },
]

/** 领先/落后列文案（synced/localOnly/remoteOnly/error 显示 "-"） */
function diffText(b: ConsistencyBranchRow): string {
  if (b.state === "ahead") { return props.i18n.consistencyAheadCount.replace("{0}", String(b.ahead)) }
  if (b.state === "behind") { return props.i18n.consistencyBehindCount.replace("{0}", String(b.behind)) }
  if (b.state === "diverged") {
    return `${props.i18n.consistencyAheadCount.replace("{0}", String(b.ahead))} / ${props.i18n.consistencyBehindCount.replace("{0}", String(b.behind))}`
  }
  return "-"
}

/** 项目 fetch 失败 tooltip："远程名: 错误信息" 多行拼接（无失败返回空串以隐藏徽章） */
function fetchErrorTitle(row: ConsistencyProjectRow): string {
  const entries = Object.entries(row.fetchErrors)
  if (entries.length === 0) { return "" }
  return entries.map(([remote, msg]) => `${remote}: ${msg}`).join("\n")
}

const { rootRef } = useDialogKeyboard()
</script>

<style lang="scss">
@use "../../styles/ConsistencyAuditDialog.scss";
@use "../../styles/index.scss";
</style>
