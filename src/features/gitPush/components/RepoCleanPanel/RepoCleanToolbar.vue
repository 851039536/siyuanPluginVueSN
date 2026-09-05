<!-- gitPush 仓库清理顶部工具条（项目选择 + 大文件阈值 + 扫描按钮 + 状态文案） -->
<template>
  <!-- 顶部工具条：第一行项目 + 阈值 + 扫描按钮；第二行状态 -->
  <div class="grcp-toolbar">
    <div class="grcp-toolbar-row">
      <!-- 项目选择下拉（单选；项目多时可输入搜索） -->
      <Select
        :model-value="projectId"
        class="grcp-project-select"
        size="xsmall"
        :options="projectOptions"
        :placeholder="i18n.ruleCheckSelectProject"
        :max-height="200"
        :filterable="projects.length >= 10"
        :filter-placeholder="i18n.searchPlaceholder"
        @change="onProjectChange"
      />
      <!-- 大文件阈值选择（tooltip："扫描大于该体积的文件"） -->
      <Select
        :model-value="thresholdMb"
        class="grcp-threshold-select"
        size="xsmall"
        :options="thresholdOptions"
        :title="i18n.repoCleanThresholdTitle"
        @change="onThresholdChange"
      />
      <!-- 按钮文案："开始体检"/"重新体检"（扫描中切换为环形 loading 图标并旋转） -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :disabled="scanning"
        @click="emit('runScan')"
      >
        <Icon
          :icon="scanning ? 'mdi:loading' : 'mdi:broom'"
          height="12"
          :class="{ 'gp-spin': scanning }"
        />
        {{ scanned ? i18n.auditRerun : i18n.repoCleanRun }}
      </button>
    </div>
    <!-- 状态文案："扫描中…/上次扫描 xx/未扫描" -->
    <span class="grcp-status">{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
// gitPush 仓库清理顶部工具条（项目选择 + 阈值 + 扫描按钮）
import type { GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import Select from "@/components/Select.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 项目列表（供下拉选择） */
  projects: GitProject[]
  /** 当前选中的项目 ID */
  projectId: string
  /** 大文件阈值（MB） */
  thresholdMb: number
  scanning: boolean
  scanned: boolean
  /** 上次扫描完成时间（ISO，未扫描为空串） */
  scannedAt: string
}>()

const emit = defineEmits<{
  runScan: []
  updateProject: [projectId: string]
  updateThreshold: [mb: number]
}>()

/** 阈值档位（MB） */
const THRESHOLD_OPTIONS = [1, 5, 10, 50, 100]

/** 项目下拉选项 */
const projectOptions = computed(() =>
  props.projects.map((p) => ({ value: p.id, label: p.name })),
)

/** 阈值下拉选项（"不小于 10 MB"） */
const thresholdOptions = computed(() =>
  THRESHOLD_OPTIONS.map((mb) => ({ value: mb, label: `≥ ${mb} MB` })),
)

/** 状态文案（复用规则检查的三态文案模式，键独立） */
const statusText = computed(() => {
  if (props.scanning) return props.i18n.repoCleanScanning
  if (props.scanned && props.scannedAt) {
    return `${props.i18n.repoCleanLastScan}${new Date(props.scannedAt).toLocaleString()}`
  }
  return props.i18n.repoCleanNotRun
})

function onProjectChange(v: string | number | boolean | null) {
  if (typeof v === "string") emit("updateProject", v)
}

function onThresholdChange(v: string | number | boolean | null) {
  const n = Number(v)
  if (Number.isFinite(n) && n > 0) emit("updateThreshold", n)
}
</script>

<style lang="scss">
@use "../../styles/RepoCleanPanel.scss";
@use "../../styles/index.scss";
</style>
