<!-- 手动备份卡片组件 — 备份按钮 + 日期文件夹 + 本地目录 + S3 子路径 -->
<template>
  <section class="card-section">
    <!-- 卡片标题 -->
    <div class="section-header">
      <!-- 标题："手动备份" -->
      <h4>{{ i18n.manualBackup }}</h4>
    </div>
    <!-- 备份操作按钮行 -->
    <div class="backup-actions-row">
      <!-- 按钮："立即备份"（主按钮，执行当前勾选的备份模式组合） -->
      <Button
        variant="primary"
        size="xsmall"
        :disabled="isAnyTaskRunning || isBackingUp || !canBackup || !workspacePath"
        :loading="isBackingUp"
        @click="$emit('performBackup')"
      >
        {{ i18n.backupNow }}
      </Button>
      <!-- 按钮："压缩包备份"（独立触发本地 ZIP 打包，不依赖模式开关） -->
      <Button
        variant="ghost"
        size="xsmall"
        :disabled="isAnyTaskRunning || isBackingUp || isZipBackingUp || !workspacePath"
        :loading="isZipBackingUp"
        @click="$emit('triggerZipBackup')"
      >
        {{ i18n.zipBackup }}
      </Button>
      <!-- 按钮："增量备份" -->
      <Button
        variant="ghost"
        size="xsmall"
        :disabled="isAnyTaskRunning || isBackingUp || isIncrementalRunning || !isConfigured || !workspacePath"
        :loading="isIncrementalRunning"
        @click="$emit('triggerIncremental')"
      >
        {{ i18n.incrementalBackup }}
      </Button>
      <!-- 按钮："增量还原" -->
      <Button
        variant="ghost"
        size="xsmall"
        :disabled="isAnyTaskRunning || isBackingUp || isIncrementalRestoring || !isConfigured || !workspacePath"
        :loading="isIncrementalRestoring"
        @click="$emit('triggerIncrementalRestore')"
      >
        {{ i18n.incrementalRestore }}
      </Button>
    </div>
    <!-- 日期文件夹开关 -->
    <div class="form-group form-group-checkbox">
      <!-- Switch 标签："生成日期子文件夹" -->
      <Switch
        v-model="useDateFolder"
        size="xsmall"
        :label="i18n.useDateFolder"
      />
      <!-- 提示文字 -->
      <span class="form-hint">{{ i18n.useDateFolderHint }}</span>
    </div>
    <!-- 本地备份目录 -->
    <div class="form-group">
      <Input
        v-model="localBackupDir"
        size="xsmall"
        :label="i18n.localBackupDir"
        :placeholder="DEFAULT_BACKUP_DIR"
      />
      <!-- 本地路径预览 -->
      <div v-if="resolvedLocalBackupPath" class="path-preview">
        <!-- 标签："实际路径" -->
        <span class="path-preview-label">{{ i18n.pathPreview }}</span>
        <code class="path-preview-value">{{ resolvedLocalBackupPath }}</code>
      </div>
    </div>
    <!-- S3 上传子路径 -->
    <div class="form-group">
      <Input
        v-model="s3SubPrefix"
        size="xsmall"
        :label="i18n.s3SubPath"
        :placeholder="DEFAULT_BACKUP_DIR"
      />
      <!-- S3 路径预览 -->
      <div v-if="resolvedS3Path" class="path-preview">
        <!-- 标签："云存储路径" -->
        <span class="path-preview-label">{{ i18n.s3PathPreview }}</span>
        <code class="path-preview-value">{{ resolvedS3Path }}</code>
      </div>
    </div>
    <!-- 立即备份动态提示：列出已勾选的备份模式 -->
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
import { DEFAULT_BACKUP_DIR } from "../types"

// defineModel — 双向绑定（对齐同模块 AutoBackupCard 写法）
const useDateFolder = defineModel<boolean>("useDateFolder", { required: true })
const localBackupDir = defineModel<string>("localBackupDir", { required: true })
const s3SubPrefix = defineModel<string>("s3SubPrefix", { required: true })

const props = defineProps<{
  isAnyTaskRunning: boolean
  isBackingUp: boolean
  canBackup: boolean
  isConfigured: boolean
  workspacePath: string
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
