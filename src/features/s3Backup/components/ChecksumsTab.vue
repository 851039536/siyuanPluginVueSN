<!-- 校验 Tab — 文件校验与已存储校验值（数据与操作来自编排层） -->
<template>
  <div class="settings-container">
    <FileChecksumsCard
      :stored-items="orch.checksums"
      :workspace-root="orch.workspaceRoot"
      :i18n="i18n"
      @clear="orch.clearChecksums()"
      @remove-one="orch.removeOneChecksum($event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { BackupOrchestrator } from "../composables/useBackupOrchestrator"
import FileChecksumsCard from "./FileChecksumsCard.vue"

defineProps<{
  /** 备份编排聚合对象（由面板持有，本组件仅做视图投影） */
  orch: BackupOrchestrator
  i18n: Record<string, string>
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
