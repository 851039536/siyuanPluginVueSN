<!-- 备份 Tab 容器 — 工作区信息/进度/手动备份/本地与云端备份列表，数据与操作来自 BackupOrchestrator -->
<template>
  <div class="settings-container">
    <!-- 工作区信息 -->
    <WorkspaceInfoCard
      :workspace-path="orch.workspaceRoot"
      :workspace-root="orch.workspaceRoot"
      :last-backup-time="orch.lastBackupTime"
      :i18n="i18n"
      @select-path="orch.selectWorkspacePath"
      @open-folder="orch.openWorkspaceFolder"
    />

    <!-- 备份进度（含独立压缩包/增量备份/还原运行期间） -->
    <BackupProgressSection
      v-if="orch.isAnyTaskRunning"
      :progress="orch.backupProgress"
      :phase-label="orch.phaseLabel"
      :i18n="i18n"
    />

    <!-- 手动备份 -->
    <ManualBackupCard
      v-model:use-date-folder="orch.useDateFolder"
      v-model:local-backup-dir="orch.localBackupDir"
      v-model:s3-sub-prefix="orch.s3SubPrefix"
      :is-any-task-running="orch.isAnyTaskRunning"
      :is-backing-up="orch.isBackingUp"
      :can-backup="orch.canBackup"
      :workspace-path="orch.workspaceRoot"
      :resolved-local-backup-path="orch.resolvedLocalBackupPath"
      :resolved-s3-path="orch.resolvedS3Path"
      :backup-mode-local-zip="orch.backupModeLocal.localZip"
      :backup-mode-s3-upload="orch.backupModeLocal.s3Upload"
      :backup-mode-s3-incremental="orch.backupModeLocal.s3Incremental"
      :is-zip-backing-up="orch.isZipBackingUp"
      :i18n="i18n"
      @perform-backup="orch.performManualBackup()"
      @trigger-zip-backup="orch.triggerZipBackupOnly()"
      @update:use-date-folder="orch.saveWorkspaceSettings()"
      @update:local-backup-dir="orch.onLocalBackupDirChanged()"
      @update:s3-sub-prefix="orch.saveWorkspaceSettings()"
    />

    <!-- 本地备份列表 -->
    <BackupListCard
      :title="i18n.localBackups"
      :empty-text="i18n.noLocalBackups"
      :items="orch.localBackupList"
      :disable-refresh="orch.isLoadingLocal || !orch.workspaceRoot"
      :i18n="i18n"
      @refresh="orch.loadLocalBackupList()"
    >
      <template #actions="{ item }">
        <Button
          size="xsmall"
          :disabled="!orch.isConfigured || orch.uploadingItems[item.path] || orch.isAlreadyUploaded(item.name)"
          @click="orch.uploadLocalBackup(item)"
        >
          {{ orch.isAlreadyUploaded(item.name) ? i18n.alreadyUploaded : i18n.uploadToS3 }}
        </Button>
        <Button variant="danger" size="xsmall" @click="orch.deleteLocalBackup(item)">
          {{ i18n.delete }}
        </Button>
      </template>
    </BackupListCard>

    <!-- S3 备份列表 -->
    <BackupListCard
      :title="i18n.s3Backups"
      :empty-text="i18n.noBackups"
      :items="orch.backupList"
      :disable-refresh="orch.isLoading || !orch.isConfigured"
      :i18n="i18n"
      :host-map="orch.uploadHostMap"
      @refresh="orch.refreshBackupList()"
    >
      <template #actions="{ item }">
        <Button size="xsmall" @click="orch.handleDownload(item)">
          {{ i18n.download }}
        </Button>
        <Button variant="danger" size="xsmall" @click="orch.handleDelete(item)">
          {{ i18n.delete }}
        </Button>
      </template>
    </BackupListCard>
  </div>
</template>

<script setup lang="ts">
import type { BackupOrchestrator } from "../composables/useBackupOrchestrator"
import WorkspaceInfoCard from "./WorkspaceInfoCard.vue"
import BackupProgressSection from "./BackupProgressSection.vue"
import ManualBackupCard from "./ManualBackupCard.vue"
import BackupListCard from "./BackupListCard.vue"
import Button from "@/components/Button.vue"

defineProps<{
  /** 备份编排聚合对象（由面板持有，本组件仅做视图投影） */
  orch: BackupOrchestrator
  i18n: Record<string, string>
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
