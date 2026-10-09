<!-- gitPush 仓库清理视图入口容器（体检扫描编排 + 大文件列表 + 清理向导弹窗，自包含无跨视图状态） -->
<template>
  <div class="grcp-panel">
    <!-- 空状态：无项目 -->
    <EmptyState
      v-if="projects.length === 0"
      icon="mdi:source-repository"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条：项目选择 + 阈值 + 扫描按钮 + 状态 -->
      <RepoCleanToolbar
        :i18n="i18n"
        :projects="projects"
        :project-id="projectId"
        :threshold-mb="thresholdMb"
        :scanning="scanning"
        :scanned="scanned"
        :scanned-at="result?.scannedAt || ''"
        @update-project="updateProject"
        @update-threshold="updateThreshold"
        @run-scan="runScan"
      />

      <!-- 扫描失败提示（非空时展示；替代原 alert） -->
      <div
        v-if="scanError"
        class="grcp-error"
      >
        <Icon
          icon="mdi:alert-circle-outline"
          height="12"
        />
        <span>{{ i18n.repoCleanFailed }}: {{ scanError }}</span>
      </div>

      <!-- 扫描中占位（首次扫描时） -->
      <div
        v-if="scanning && !scanned"
        class="gp-loading"
      >
        <Loader />
        <!-- 加载中文案："扫描中…" -->
        <span class="gp-loading-text">{{ i18n.repoCleanScanning }}</span>
      </div>

      <!-- 未扫描提示 -->
      <EmptyState
        v-else-if="!scanned"
        icon="mdi:broom"
        :text="i18n.repoCleanNotRun"
      />

      <template v-else-if="result">
        <!-- 空状态：无可达对象（空仓库） -->
        <EmptyState
          v-if="result.objectCount === 0"
          icon="mdi:source-commit"
          :text="i18n.repoCleanNoData"
        />

        <template v-else>
          <!-- 总览卡片（共享 StatCardGrid：窄 Dock 下自动降列；4 张卡平级呈现各维度） -->
          <StatCardGrid
            :min-width="96"
            :cards="overviewCards"
          />

          <!-- 大文件 Top 列表 -->
          <LargeBlobSection
            :i18n="i18n"
            :blobs="result.topBlobs"
            :pack-size="result.packSize"
            :threshold-mb="thresholdMb"
          />

          <!-- 历史清理入口 -->
          <div class="grcp-actions">
            <Button
              variant="ghost"
              size="xsmall"
              icon="databaseRemoveOutline"
              @click="showWizard = true"
            >{{ i18n.bfgOpenWizard }}</Button>
          </div>
        </template>
      </template>
    </template>

    <!-- BFG 清理向导弹窗（自包含：前置检查 + 执行 + 结果 + 强推入口） -->
    <CleanWizardDialog
      v-if="showWizard && currentProject"
      :i18n="i18n"
      :manager="manager"
      :project="currentProject"
      :threshold-mb="thresholdMb"
      @close="showWizard = false"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 仓库清理视图入口容器（体检扫描 + 大文件列表 + 清理向导入口）
import type { GitProject } from "../../types"
import type { RepoScanResult } from "../../types"
import type { GitPushManager } from "../../GitPushManager"
import type { StatCardItem } from "../common/StatCardGrid.vue"
import { computed, ref } from "vue"
import Button from "@/components/Button.vue"
import CleanWizardDialog from "./CleanWizardDialog.vue"
import EmptyState from "../common/EmptyState.vue"
import LargeBlobSection from "./LargeBlobSection.vue"
import Loader from "@/components/Loader.vue"
import RepoCleanToolbar from "./RepoCleanToolbar.vue"
import StatCardGrid from "../common/StatCardGrid.vue"
import { Icon } from "@iconify/vue"
import { formatBytes } from "./format"
import { getErrorMessage } from "@/utils/stringUtils"

const props = defineProps<{
  i18n: Record<string, any>
  manager: GitPushManager
  /** 项目列表（供工具栏项目选择） */
  projects: GitProject[]
}>()

/** 扫描结果（视图本地持有，切换视图保留组件状态即保留结果） */
const result = ref<RepoScanResult | null>(null)
const scanning = ref(false)
const scanned = ref(false)
/** 扫描失败原因（非空时展示错误条，替代原 alert —— Electron 下原生 alert 会阻塞渲染进程且与插件对话框体系脱节） */
const scanError = ref("")
/** 清理向导弹窗开关 */
const showWizard = ref(false)

/** 当前选中的项目 ID（恢复上次偏好，空 = 第一个项目） */
const projectId = ref("")
/** 大文件阈值（MB） */
const thresholdMb = ref(10)

/** 当前选中项目对象 */
const currentProject = computed(() =>
  props.projects.find((p) => p.id === projectId.value) || null,
)

/**
 * 总览卡片：打包体积 / 对象总数 / 超阈值大文件数 / 超阈值共占体积。
 *
 * 第 3、4 张拆开是有意的：原实现把累计体积塞进第 3 张卡的 label tooltip，
 * 而「7 个超阈值文件」到底是 7×11MB（可忽略）还是 7×500MB（该清了）取决于体积 ——
 * 这是决定是否清理的主数据，必须直接可见（故用 sub 副值行而非 hint）。
 * 第 4 张独立成卡后，两数可各自纵向比较。
 */
const overviewCards = computed<StatCardItem[]>(() => {
  const r = result.value
  if (!r) return []
  const hasOversized = r.oversizedCount > 0
  return [
    { key: "packSize", value: formatBytes(r.packSize), label: props.i18n.repoCleanPackSize },
    { key: "objectCount", value: r.objectCount, label: props.i18n.repoCleanObjectCount },
    {
      key: "oversizedCount",
      value: r.oversizedCount,
      label: props.i18n.repoCleanOversized,
      cls: hasOversized ? "gp-statgrid-card--danger" : "gp-statgrid-card--muted",
    },
    {
      key: "oversizedBytes",
      value: formatBytes(r.oversizedBytes),
      label: props.i18n.repoCleanOversizedBytes,
      cls: hasOversized ? "gp-statgrid-card--danger" : "gp-statgrid-card--muted",
      // 占打包体积的比例：直观回答"清理能省多少"
      sub: r.packSize > 0
        ? `${Math.round((r.oversizedBytes / r.packSize) * 100)}% ${props.i18n.repoCleanOfPackSize}`
        : "",
    },
  ]
})

/** 初始化：恢复持久化偏好（进视图一次） */
let prefsLoaded = false
async function ensurePrefs() {
  if (prefsLoaded) return
  prefsLoaded = true
  const prefs = await props.manager.storage.repoCleanPrefs.loadOrDefault()
  if (prefs.projectId && props.projects.some((p) => p.id === prefs.projectId)) {
    projectId.value = prefs.projectId
  } else if (props.projects.length > 0) {
    projectId.value = props.projects[0].id
  }
  thresholdMb.value = prefs.thresholdMb
}
ensurePrefs()

/** 持久化偏好（切换项目/阈值时） */
async function persistPrefs() {
  await props.manager.storage.repoCleanPrefs.save({
    projectId: projectId.value,
    thresholdMb: thresholdMb.value,
  })
}

function updateProject(id: string) {
  projectId.value = id
  scanned.value = false
  result.value = null
  scanError.value = ""
  void persistPrefs()
}

function updateThreshold(mb: number) {
  thresholdMb.value = mb
  void persistPrefs()
}

/** 执行体检扫描（纯 git 只读，无需写锁） */
async function runScan() {
  const project = currentProject.value
  if (!project || scanning.value) return
  scanning.value = true
  scanned.value = false
  scanError.value = ""
  try {
    result.value = await props.manager.scanRepoObjects(project.path, thresholdMb.value)
    scanned.value = true
  } catch (e: unknown) {
    // 与全站一致：错误经 getErrorMessage 归一后以错误条呈现（原为原生 alert，会阻塞渲染进程）
    scanError.value = getErrorMessage(e) || String(e)
    scanned.value = true
  } finally {
    scanning.value = false
  }
}
</script>

<style lang="scss">
@use "../../styles/RepoCleanPanel.scss";
@use "../../styles/index.scss";
</style>
