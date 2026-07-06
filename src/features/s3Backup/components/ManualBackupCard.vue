<!-- 手动备份卡片组件 — 备份按钮 + 日期文件夹 + 本地目录 + S3 子路径 -->
<template>
  <section class="card-section">
    <div class="section-header">
      <h4>{{ i18n.manualBackup || "手动备份" }}</h4>
    </div>
    <div class="backup-actions-row">
      <Button
        variant="primary"
        size="xsmall"
        :disabled="isBackingUp || !canBackup || !workspacePath"
        :loading="isBackingUp"
        @click="$emit('performBackup')"
      >
        {{ i18n.backupNow || "立即备份" }}
      </Button>
      <Button
        variant="ghost"
        size="xsmall"
        :disabled="isBackingUp || !isConfigured || !workspacePath"
        :loading="isS3OnlyBackingUp"
        @click="$emit('triggerS3Upload')"
      >
        {{ i18n.uploadToS3 || "上传到 S3" }}
      </Button>
    </div>
    <div class="form-group form-group-checkbox">
      <Switch
        :model-value="useDateFolder"
        size="xsmall"
        :label="i18n.useDateFolder || '生成日期子文件夹'"
        @update:model-value="$emit('update:useDateFolder', $event as boolean)"
      />
      <span class="form-hint">{{ i18n.useDateFolderHint || "勾选后按日期分类存储" }}</span>
    </div>
    <!-- 本地备份目录 -->
    <div class="form-group">
      <Input
        :model-value="localBackupDir"
        size="xsmall"
        :label="i18n.localBackupDir || '本地备份目录'"
        :hint="i18n.localBackupDirDesc || 'ZIP 压缩包保存到本地的哪个文件夹'"
        placeholder="data-backup"
        @update:model-value="$emit('update:localBackupDir', $event as string)"
      />
      <div v-if="resolvedLocalBackupPath" class="path-preview">
        <span class="path-preview-label">{{ i18n.pathPreview || "实际路径" }}</span>
        <code class="path-preview-value">{{ resolvedLocalBackupPath }}</code>
      </div>
    </div>
    <!-- S3 上传子路径 -->
    <div class="form-group">
      <Input
        :model-value="s3SubPrefix"
        size="xsmall"
        :label="i18n.s3SubPath || 'S3 上传子路径'"
        :hint="i18n.s3SubPathDesc || '上传到云存储时，在目录前缀之后追加的路径段'"
        placeholder="data-backup"
        @update:model-value="$emit('update:s3SubPrefix', $event as string)"
      />
      <div v-if="resolvedS3Path" class="path-preview">
        <span class="path-preview-label">{{ i18n.pathPreview || "云存储路径" }}</span>
        <code class="path-preview-value">{{ resolvedS3Path }}</code>
      </div>
    </div>
    <p class="backup-hint">
      {{ backupHintText }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Switch from "@/components/Switch.vue"

const props = defineProps<{
  isBackingUp: boolean
  isS3OnlyBackingUp: boolean
  canBackup: boolean
  isConfigured: boolean
  workspacePath: string
  useDateFolder: boolean
  localBackupDir: string
  s3SubPrefix: string
  resolvedLocalBackupPath: string
  resolvedS3Path: string
  backupModeLocalZip: boolean
  backupModeS3Upload: boolean
  i18n: Record<string, string>
}>()

defineEmits<{
  (e: "performBackup"): void
  (e: "triggerS3Upload"): void
  (e: "update:useDateFolder", value: boolean): void
  (e: "update:localBackupDir", value: string): void
  (e: "update:s3SubPrefix", value: string): void
}>()

const backupHintText = computed(() => {
  if (props.backupModeLocalZip && props.backupModeS3Upload) {
    return props.i18n.backupHintBoth || "将先打包本地 ZIP 再上传 S3"
  }
  if (props.backupModeLocalZip) {
    return props.i18n.backupHintLocal || "备份将打包为 data-*.zip 保存到本地备份目录"
  }
  return props.i18n.backupHint || "备份将逐文件上传到 S3"
})
</script>

<style scoped lang="scss">
@use "../styles/ManualBackupCard.scss";
@use "../styles/index.scss";
</style>
