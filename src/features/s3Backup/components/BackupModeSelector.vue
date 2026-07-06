<!-- 备份模式选择组件 — 本地 ZIP / S3 上传两个开关 -->
<template>
  <section class="card-section backup-mode-section">
    <div class="section-header">
      <h4>{{ i18n.backupMode || "备份模式" }}</h4>
    </div>
    <div class="form-group form-group-checkbox">
      <Switch
        :model-value="modelValue.localZip"
        size="small"
        :label="i18n.localZipBackup || '本地 ZIP 备份'"
        @update:model-value="$emit('update:modelValue', { ...modelValue, localZip: $event as boolean })"
      />
      <span class="form-hint">{{ i18n.localZipHint || "打包为 data-*.zip 保存到工作区 data-backup/ 目录" }}</span>
    </div>
    <div class="form-group form-group-checkbox">
      <Switch
        :model-value="modelValue.s3Upload"
        size="small"
        :label="i18n.s3Upload || '上传到 S3'"
        @update:model-value="$emit('update:modelValue', { ...modelValue, s3Upload: $event as boolean })"
      />
      <span class="form-hint">{{ i18n.s3UploadHint || "逐文件上传到 S3 兼容存储（需先完成 S3 配置）" }}</span>
    </div>
    <p class="backup-hint">
      {{ i18n.backupModeHint || "可同时勾选两项，本地 ZIP 和 S3 上传将顺序执行" }}
    </p>
  </section>
</template>

<script setup lang="ts">
import Switch from "@/components/Switch.vue"
import type { BackupMode } from "../types"

defineProps<{
  modelValue: BackupMode
  i18n: Record<string, string>
}>()

defineEmits<{
  (e: "update:modelValue", value: BackupMode): void
}>()
</script>

<style scoped lang="scss">
@use "../styles/BackupModeSelector.scss";
@use "../styles/index.scss";
</style>
