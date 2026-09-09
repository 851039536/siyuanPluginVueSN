<!-- 增量实验 Tab — 实验性警告横幅 + 云端清单状态 + 增量备份/还原操作 + 进度，数据来自 BackupOrchestrator -->
<template>
  <div class="settings-container">
    <!-- 实验性警告横幅 -->
    <section class="card-section inc-warning-banner">
      <div class="inc-banner-head">
        <!-- 徽标："实验" -->
        <span class="inc-banner-badge">{{ i18n.experimentalBadge }}</span>
        <!-- 标题："增量备份 / 增量还原" -->
        <span class="inc-banner-title">{{ i18n.incrementalTab }}</span>
      </div>
      <!-- 已知限制与实验性说明 -->
      <p class="inc-banner-text">
        {{ i18n.incrementalExperimentalHint }}
      </p>
    </section>

    <!-- 云端清单状态 -->
    <section class="card-section">
      <div class="section-header">
        <!-- 卡片标题："云端清单" -->
        <h4>{{ i18n.incrementalManifestInfo }}</h4>
        <!-- 刷新按钮 -->
        <Button
          variant="ghost"
          size="xsmall"
          :disabled="!orch.isConfigured"
          :loading="orch.isLoadingManifest"
          @click="orch.refreshIncrementalManifest()"
        >
          {{ i18n.refresh }}
        </Button>
      </div>
      <!-- 未配置 S3 -->
      <p
        v-if="!orch.isConfigured"
        class="inc-empty"
      >
        {{ i18n.s3NotConfigured }}
      </p>
      <!-- 清单加载失败 -->
      <p
        v-else-if="orch.manifestLoadFailed"
        class="inc-empty inc-empty--error"
      >
        {{ i18n.manifestLoadFailed }}
      </p>
      <!-- 云端暂无清单 -->
      <p
        v-else-if="!orch.manifestInfo"
        class="inc-empty"
      >
        {{ i18n.manifestNotFound }}
      </p>
      <!-- 清单信息网格 -->
      <div
        v-else
        class="workspace-info-grid"
      >
        <div class="workspace-info-item">
          <!-- 标签："文件数" -->
          <span class="workspace-info-label">{{ i18n.manifestFiles }}</span>
          <span class="info-value">{{ orch.manifestInfo.fileCount }}</span>
        </div>
        <div class="workspace-info-item">
          <!-- 标签："生成时间" -->
          <span class="workspace-info-label">{{ i18n.manifestCreatedAt }}</span>
          <span class="info-value">{{ formattedCreatedAt }}</span>
        </div>
        <div class="workspace-info-item">
          <!-- 标签："来源设备" -->
          <span class="workspace-info-label">{{ i18n.manifestHost }}</span>
          <span
            class="info-value inc-host"
            :title="orch.manifestInfo.hostname"
          >{{ orch.manifestInfo.hostname || i18n.notSet }}</span>
        </div>
      </div>
    </section>

    <!-- 增量操作 -->
    <section class="card-section">
      <div class="section-header">
        <!-- 卡片标题："增量操作" -->
        <h4>{{ i18n.incrementalOps }}</h4>
      </div>
      <!-- 操作按钮行 -->
      <div class="backup-actions-row">
        <!-- 按钮："增量备份" -->
        <Button
          variant="ghost"
          size="xsmall"
          :disabled="orch.isAnyTaskRunning || !orch.isConfigured || !orch.workspacePath"
          :loading="orch.isIncrementalRunning"
          @click="orch.triggerIncrementalOnly()"
        >
          {{ i18n.incrementalBackup }}
        </Button>
        <!-- 按钮："增量还原"（还原确认对话框在编排层内部） -->
        <Button
          variant="ghost"
          size="xsmall"
          :disabled="orch.isAnyTaskRunning || !orch.isConfigured || !orch.workspacePath"
          :loading="orch.isIncrementalRestoring"
          @click="orch.triggerIncrementalRestore()"
        >
          {{ i18n.incrementalRestore }}
        </Button>
        <!-- 按钮："打开还原目录"（最近一次还原成功后显示） -->
        <Button
          v-if="orch.lastRestoreDir"
          variant="ghost"
          size="xsmall"
          :disabled="orch.isAnyTaskRunning"
          @click="orch.openRestoreFolder()"
        >
          {{ i18n.openRestoreFolder }}
        </Button>
      </div>
      <!-- 最近还原目录路径预览 -->
      <div
        v-if="orch.lastRestoreDir"
        class="path-preview"
      >
        <!-- 标签："还原目录" -->
        <span class="path-preview-label">{{ i18n.restoreDirLabel }}</span>
        <code class="path-preview-value">{{ orch.lastRestoreDir }}</code>
      </div>
    </section>

    <!-- 备份/还原进度 -->
    <BackupProgressSection
      v-if="orch.isAnyTaskRunning"
      :progress="orch.backupProgress"
      :phase-label="orch.phaseLabel"
      :i18n="i18n"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue"
import type { BackupOrchestrator } from "../composables/useBackupOrchestrator"
import BackupProgressSection from "./BackupProgressSection.vue"
import Button from "@/components/Button.vue"

const props = defineProps<{
  /** 备份编排聚合对象（由面板持有，本组件仅做视图投影） */
  orch: BackupOrchestrator
  i18n: Record<string, string>
}>()

/** 清单生成时间本地化展示（原始值为 ISO 字符串） */
const formattedCreatedAt = computed(() => {
  const info = props.orch.manifestInfo
  if (!info?.createdAt) { return props.i18n.notSet }
  const date = new Date(info.createdAt)
  return Number.isNaN(date.getTime()) ? info.createdAt : date.toLocaleString()
})

// Tab 首次打开且 S3 已配置时自动加载一次清单信息
onMounted(() => {
  if (props.orch.isConfigured) {
    void props.orch.refreshIncrementalManifest()
  }
})
</script>

<style scoped lang="scss">
@use "../styles/IncrementalTab.scss";
@use "../styles/index.scss";
</style>
