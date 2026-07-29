<!-- 备份进度组件 — 进度条 + 阶段信息 + 当前文件 -->
<template>
  <section class="card-section progress-section">
    <!-- 卡片标题 -->
    <div class="section-header">
      <!-- 标题："备份进度" -->
      <h4>{{ i18n.backupProgress }}</h4>
    </div>
    <!-- 进度条 -->
    <div class="progress-bar-container">
      <div class="progress-bar" :style="{ width: `${progress.percent}%` }" />
    </div>
    <!-- 阶段标签与百分比 -->
    <div class="progress-info">
      <span class="progress-phase">{{ phaseLabel }}</span>
      <span class="progress-percent">{{ progress.percent }}%</span>
    </div>
    <!-- 当前处理文件（v-if 懒显示） -->
    <div v-if="progress.currentFile" class="progress-current-file">
      {{ progress.currentFile }}
    </div>
  </section>
</template>

<script setup lang="ts">
import type { BackupProgress } from "../modules/BackupManager"

defineProps<{
  progress: BackupProgress
  phaseLabel: string
  i18n: Record<string, string>
}>()
</script>

<style scoped lang="scss">
@use "../styles/BackupProgressSection.scss";
@use "../styles/index.scss";
</style>
