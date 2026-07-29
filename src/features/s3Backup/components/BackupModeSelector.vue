<!-- 备份模式选择组件 — 本地 ZIP / S3 上传 / S3 增量备份三个开关（元数据驱动渲染） -->
<template>
  <section class="card-section backup-mode-section">
    <div class="section-header">
      <!-- 卡片标题："备份模式" -->
      <h4>{{ i18n.backupMode }}</h4>
    </div>
    <!-- 模式开关列表（各开关的标签/提示中文文案见 SWITCHES 元数据注释） -->
    <div
      v-for="s in SWITCHES"
      :key="s.key"
      class="form-group form-group-checkbox"
    >
      <Switch
        :model-value="model[s.key]"
        size="xsmall"
        :label="i18n[s.labelKey]"
        @update:model-value="model = { ...model, [s.key]: $event }"
      />
      <span class="form-hint">{{ i18n[s.hintKey] }}</span>
    </div>
    <!-- 模式组合提示："三种模式可任意组合勾选，执行顺序：本地 ZIP → S3 上传 → S3 增量" -->
    <p class="backup-hint">
      {{ i18n.backupModeHint }}
    </p>
  </section>
</template>

<script setup lang="ts">
import Switch from "@/components/Switch.vue"
import type { BackupMode } from "../types"

const model = defineModel<BackupMode>({ required: true })

defineProps<{
  i18n: Record<string, string>
}>()

/** 开关渲染元数据：模式字段 → i18n 标签键 / 提示键 */
const SWITCHES: Array<{ key: keyof BackupMode; labelKey: string; hintKey: string }> = [
  // 标签："本地 ZIP 备份"；提示："打包为 data-*.zip 保存到工作区 data-backup/ 目录"
  { key: "localZip", labelKey: "localZipBackup", hintKey: "localZipHint" },
  // 标签："上传到 S3"；提示："逐文件上传到 S3 兼容存储（需先完成 S3 配置）"
  { key: "s3Upload", labelKey: "s3Upload", hintKey: "s3UploadHint" },
  // 标签："S3 增量备份"；提示："仅上传 data/ 中新增或变更的文件到 S3（需先完成 S3 配置）"
  { key: "s3Incremental", labelKey: "s3Incremental", hintKey: "s3IncrementalHint" },
]
</script>

<style scoped lang="scss">
@use "../styles/BackupModeSelector.scss";
@use "../styles/index.scss";
</style>
