<!-- 工作区信息卡片组件 — 显示工作区路径和上次备份时间 -->
<template>
  <section class="card-section">
    <div class="section-header">
      <h4>{{ i18n.workspaceInfo || "工作区信息" }}</h4>
    </div>
    <div class="workspace-info-grid">
      <div class="workspace-info-item">
        <span class="workspace-info-label">{{ i18n.workspacePath || "工作区路径" }}</span>
        <div class="workspace-path-row">
          <span class="info-value workspace-path">{{ workspacePath || (i18n.notSet || "未设置") }}</span>
          <div class="path-actions">
            <Button variant="ghost" size="small" @click="$emit('selectPath')">
              {{ i18n.selectPath || "选择路径" }}
            </Button>
            <Button variant="ghost" size="small" :disabled="!workspaceRoot" @click="$emit('openFolder')">
              打开
            </Button>
          </div>
        </div>
      </div>
      <div class="workspace-info-item">
        <span class="workspace-info-label">{{ i18n.lastBackup || "上次备份" }}</span>
        <span class="info-value">{{ lastBackupTime || (i18n.never || "从未") }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"

defineProps<{
  workspacePath: string
  workspaceRoot: string
  lastBackupTime: string
  i18n: Record<string, string>
}>()

defineEmits<{
  (e: "selectPath"): void
  (e: "openFolder"): void
}>()
</script>

<style scoped lang="scss">
@use "../styles/WorkspaceInfoCard.scss";
@use "../styles/index.scss";
</style>
