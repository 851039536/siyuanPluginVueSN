<!-- 批量解密对话框组件 -->
<template>
  <div
    v-if="visible"
    class="dialog-overlay"
    @click="$emit('close')"
  >
    <div
      class="dialog"
      @click.stop
    >
      <div class="dialog-header">
        <h3><IconWrapper
          name="pageLock"
          :size="16"
        /> {{ t("batchDecryptTitle") }}</h3>
        <Button
          icon="x"
          variant="ghost"
          size="xsmall"
          :disabled="progress"
          @click="$emit('close')"
        />
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>{{ t("decryptVideoCount") }}</label>
          <div class="file-info">
            {{ t("encryptedCount", { count: encryptedCount }) }}
          </div>
        </div>

        <div
          v-if="progress"
          class="form-group"
        >
          <label>{{ t("decryptProgress") }}</label>
          <div class="progress-info">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${progressPercent}%` }"
              ></div>
            </div>
            <div class="progress-text">
              {{ currentFile }} ({{ currentIndex }}/{{ totalCount }})
            </div>
          </div>
        </div>

        <div class="form-group">
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">{{ t("decryptFormat") }}：</span>
              <span class="info-value">{{ t("decryptOriginalFormat") }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t("encryptedFileHandling") }}</span>
              <span class="info-value">{{ t("decryptAutoDelete") }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t("decryptPurpose") }}：</span>
              <span class="info-value">{{ t("decryptPurposeDesc") }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <Button
          variant="secondary"
          :disabled="progress"
          @click="$emit('close')"
        >
          {{ t("cancel") }}
        </Button>
        <Button
          variant="primary"
          :disabled="progress"
          @click="$emit('start')"
        >
          {{ progress ? t("decrypting") : t("startDecrypt") }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlugin } from "@/main"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

defineProps<{
  visible: boolean
  encryptedCount: number
  progress: boolean
  progressPercent: number
  currentFile: string
  currentIndex: number
  totalCount: number
}>()

defineEmits<{
  close: []
  start: []
}>()

// i18n
const plugin = usePlugin()
function t(key: string, vars?: Record<string, string | number>): string {
  const i18n = (plugin as any).i18n?.video
  let text = i18n?.[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v))
    }
  }
  return text
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
