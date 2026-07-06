<!-- 备份进度组件 — 进度条 + 阶段信息 + 当前文件 -->
<template>
  <section class="card-section progress-section">
    <div class="section-header">
      <h4>{{ i18n.backupProgress || "备份进度" }}</h4>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar" :style="{ width: `${progress.percent}%` }" />
    </div>
    <div class="progress-info">
      <span class="progress-phase">{{ phaseLabel }}</span>
      <span class="progress-percent">{{ progress.percent }}%</span>
    </div>
    <div v-if="progress.currentFile" class="progress-current-file">
      {{ progress.currentFile }}
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ProgressInfo } from "../types"

defineProps<{
  progress: ProgressInfo
  phaseLabel: string
  i18n: Record<string, string>
}>()
</script>

<style scoped lang="scss">
@use "../styles/BackupProgressSection.scss";
@use "../styles/index.scss";
</style>
