<!-- 日志 Tab — 操作日志列表（数据与清空操作来自编排层） -->
<template>
  <div class="settings-container">
    <BackupLogCard
      :logs="orch.backupLogs"
      :i18n="i18n"
      @clear="orch.clearLogs()"
    />
  </div>
</template>

<script setup lang="ts">
import type { BackupOrchestrator } from "../composables/useBackupOrchestrator"
import BackupLogCard from "./BackupLogCard.vue"

defineProps<{
  /** 备份编排聚合对象（由面板持有，本组件仅做视图投影） */
  orch: BackupOrchestrator
  i18n: Record<string, string>
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
