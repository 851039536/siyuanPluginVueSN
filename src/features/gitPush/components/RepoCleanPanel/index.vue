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
          <!-- 总览卡片：打包体积 / 对象总数 / 超阈值大文件 -->
          <div class="grcp-cards">
            <div class="grcp-card">
              <div class="grcp-card-value">{{ formatBytes(result.packSize) }}</div>
              <!-- 卡片标签："打包体积" -->
              <div class="grcp-card-label">{{ i18n.repoCleanPackSize }}</div>
            </div>
            <div class="grcp-card">
              <div class="grcp-card-value">{{ result.objectCount }}</div>
              <!-- 卡片标签："对象总数" -->
              <div class="grcp-card-label">{{ i18n.repoCleanObjectCount }}</div>
            </div>
            <div class="grcp-card">
              <div
                class="grcp-card-value"
                :class="{ 'grcp-card-value--danger': result.oversizedCount > 0 }"
              >{{ result.oversizedCount }}</div>
              <!-- 卡片标签："超阈值大文件"（title 显示累计体积） -->
              <div
                class="grcp-card-label"
                :title="`${i18n.repoCleanOversizedBytes}: ${formatBytes(result.oversizedBytes)}`"
              >{{ i18n.repoCleanOversized }}</div>
            </div>
          </div>

          <!-- 大文件 Top 列表 -->
          <LargeBlobSection
            :i18n="i18n"
            :blobs="result.topBlobs"
            :pack-size="result.packSize"
            :threshold-mb="thresholdMb"
          />

          <!-- 历史清理入口 -->
          <div class="grcp-actions">
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              @click="showWizard = true"
            >
              <Icon
                icon="mdi:database-remove-outline"
                height="12"
              />
              <!-- 按钮文案："历史清理（BFG）" -->
              {{ i18n.bfgOpenWizard }}
            </button>
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
import { computed, ref } from "vue"
import { Icon } from "@iconify/vue"
import CleanWizardDialog from "./CleanWizardDialog.vue"
import EmptyState from "../common/EmptyState.vue"
import LargeBlobSection from "./LargeBlobSection.vue"
import Loader from "@/components/Loader.vue"
import RepoCleanToolbar from "./RepoCleanToolbar.vue"
import { formatBytes } from "./format"

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
  try {
    result.value = await props.manager.scanRepoObjects(project.path, thresholdMb.value)
    scanned.value = true
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e))
  } finally {
    scanning.value = false
  }
}
</script>

<style lang="scss">
@use "../../styles/RepoCleanPanel.scss";
@use "../../styles/index.scss";
</style>
