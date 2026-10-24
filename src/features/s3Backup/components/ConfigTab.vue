<!-- 配置 Tab — 备份模式 / 自动备份 / S3 配置表单 + 保存内联反馈 -->
<template>
  <div class="settings-container">
    <BackupModeSelector
      :model-value="orch.backupModeLocal"
      :i18n="i18n"
      @update:model-value="orch.onBackupModeChanged"
    />

    <AutoBackupCard
      v-model:auto-backup-enabled="orch.autoBackupEnabled"
      v-model:backup-frequency="orch.backupFrequency"
      v-model:backup-time="orch.backupTime"
      v-model:keep-backup-count="orch.keepBackupCount"
      :i18n="i18n"
    />

    <section class="card-section">
      <S3ConfigForm
        :config="orch.s3Config"
        :i18n="i18n"
        :on-test-connection="orch.testConnection"
        @saved="handleConfigSaved"
      />
      <!-- 保存结果内联提示：面板遮罩会盖住全局 toast，必须在面板内反馈 -->
      <Message
        v-if="saveFeedback"
        class="config-save-feedback"
        :severity="saveFeedback.severity"
        size="xsmall"
        closable
        :life="saveFeedback.severity === 'success' ? 4000 : 0"
        @close="saveFeedback = null"
      >
        {{ saveFeedback.text }}
      </Message>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import type { BackupOrchestrator } from "../composables/useBackupOrchestrator"
import type { S3Config } from "../types"
import AutoBackupCard from "./AutoBackupCard.vue"
import BackupModeSelector from "./BackupModeSelector.vue"
import S3ConfigForm from "./S3ConfigForm.vue"
import Message from "@/components/Message.vue"

const props = defineProps<{
  /** 备份编排聚合对象（由面板持有，本组件仅做视图投影） */
  orch: BackupOrchestrator
  i18n: Record<string, string>
}>()

interface SaveFeedback {
  severity: "success" | "error"
  text: string
}

const saveFeedback = ref<SaveFeedback | null>(null)

/** 保存配置：加密落盘成功后才应用；结果写回面板内联提示 */
async function handleConfigSaved(config: S3Config): Promise<void> {
  const result = await props.orch.saveS3Config(config)
  if (result.success) {
    // 提示："配置已保存"
    saveFeedback.value = { severity: "success", text: props.i18n.configSaved }
    return
  }
  // 提示："配置保存失败"（技术原因仅作补充）
  saveFeedback.value = {
    severity: "error",
    text: result.error
      ? `${props.i18n.configSaveFailed}: ${result.error}`
      : props.i18n.configSaveFailed,
  }
}
</script>

<style scoped lang="scss">
@use "../styles/ConfigTab.scss";
@use "../styles/index.scss";
</style>
