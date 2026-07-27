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
      <!-- 压缩包备份按钮："压缩包备份"（独立触发本地 ZIP 打包，不依赖模式开关） -->
      <Button
        variant="ghost"
        size="xsmall"
        :disabled="isBackingUp || isZipBackingUp || !workspacePath"
        :loading="isZipBackingUp"
        @click="$emit('triggerZipBackup')"
      >
        {{ i18n.zipBackup }}
      </Button>
      <!-- 增量备份按钮："增量备份" -->
      <Button
        variant="ghost"
        size="xsmall"
        :disabled="isBackingUp || isIncrementalRunning || !isConfigured || !workspacePath"
        :loading="isIncrementalRunning"
        @click="$emit('triggerIncremental')"
      >
        {{ i18n.incrementalBackup }}
      </Button>
      <!-- 增量还原按钮："增量还原" -->
      <Button
        variant="ghost"
        size="xsmall"
        :disabled="isBackingUp || isIncrementalRestoring || !isConfigured || !workspacePath"
        :loading="isIncrementalRestoring"
        @click="$emit('triggerIncrementalRestore')"
      >
        {{ i18n.incrementalRestore }}
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
        placeholder="data-backup"
        @update:model-value="$emit('update:s3SubPrefix', $event as string)"
      />
      <div v-if="resolvedS3Path" class="path-preview">
        <span class="path-preview-label">{{ i18n.pathPreview || "云存储路径" }}</span>
        <code class="path-preview-value">{{ resolvedS3Path }}</code>
      </div>
    </div>
    <!-- 立即备份动态提示：如"点击「立即备份」将执行：本地 ZIP 备份 + 上传到 S3"，未勾选模式时提示去配置 -->
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
  backupModeS3Incremental?: boolean
  isZipBackingUp?: boolean
  isIncrementalRunning?: boolean
  isIncrementalRestoring?: boolean
  i18n: Record<string, string>
}>()

defineEmits<{
  (e: "performBackup"): void
  (e: "triggerZipBackup"): void
  (e: "triggerIncremental"): void
  (e: "triggerIncrementalRestore"): void
  (e: "update:useDateFolder", value: boolean): void
  (e: "update:localBackupDir", value: string): void
  (e: "update:s3SubPrefix", value: string): void
}>()

const backupHintText = computed(() => {
  // 动态列出已勾选的备份模式，明确「立即备份」将执行的动作
  const modes: string[] = []
  if (props.backupModeLocalZip) { modes.push(props.i18n.localZipBackup) }
  if (props.backupModeS3Upload) { modes.push(props.i18n.s3Upload) }
  if (props.backupModeS3Incremental) { modes.push(props.i18n.s3Incremental) }
  if (modes.length === 0) {
    return props.i18n.backupNowHintNone
  }
  return `${props.i18n.backupNowHintPrefix}${modes.join(" + ")}`
})
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
