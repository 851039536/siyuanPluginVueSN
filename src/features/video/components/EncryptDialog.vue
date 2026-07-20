<!-- 批量加密对话框组件 -->
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
        /> {{ t("batchEncryptTitle") }}</h3>
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
          <label>{{ t("encryptVideoCount") }}</label>
          <div class="file-info">
            {{ t("unencryptedCount", { count: unencryptedCount }) }}
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              :checked="doubleCompress"
              type="checkbox"
              :disabled="progress"
              @change="$emit('update:doubleCompress', ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ t("doubleCompress") }}</span>
          </label>
          <div class="form-hint">
            {{ t("singleCompressDesc") }}<br>
            {{ t("doubleCompressDesc") }}
          </div>
        </div>

        <div
          v-if="progress"
          class="form-group"
        >
          <label>{{ t("encryptProgress") }}</label>
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
              <span class="info-label">{{ t("encryptFormat") }}</span>
              <span class="info-value">{{ doubleCompress ? '.sn2' : '.sn' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t("originalFileHandling") }}</span>
              <span class="info-value">{{ t("encryptAutoDelete") }}</span>
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
          {{ progress ? t("encrypting") : t("startEncrypt") }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlugin } from "@/main"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

const props = defineProps<{
  visible: boolean
  unencryptedCount: number
  doubleCompress: boolean
  progress: boolean
  progressPercent: number
  currentFile: string
  currentIndex: number
  totalCount: number
}>()

defineEmits<{
  close: []
  start: []
  "update:doubleCompress": [value: boolean]
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
