<!-- 视频音频合并对话框组件 -->
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
          name="headphones"
          :size="16"
        /> {{ t("mergeVideoAudioTitle") }}</h3>
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
          <label>{{ t("selectVideo") }}</label>
          <Select
            :model-value="selectedVideo"
            :options="videoOptions"
            @update:model-value="$emit('update:selectedVideo', $event)"
          />
        </div>

        <div class="form-group">
          <label>{{ t("selectAudio") }}</label>
          <Select
            :model-value="selectedAudio"
            :options="audioOptions"
            @update:model-value="$emit('update:selectedAudio', $event)"
          />
        </div>

        <div class="form-group">
          <label>{{ t("outputFileName") }}</label>
          <Input
            :model-value="outputName"
            :placeholder="t('videoWithAudioPlaceholder')"
            @update:model-value="$emit('update:outputName', $event)"
          />
        </div>

        <div
          v-if="progress"
          class="form-group"
        >
          <label>{{ t("mergeProgress") }}</label>
          <div class="progress-info">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${progressPercent}%` }"
              ></div>
            </div>
            <div class="progress-text">
              {{ progressPercent }}%
            </div>
          </div>
        </div>

        <div
          v-if="result"
          class="form-group"
        >
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">{{ t("status") }}：</span>
              <span
                class="info-value"
                :style="{ color: result.success ? '#788c5d' : '#d97757' }"
              >
                <IconWrapper
                  v-if="result.success"
                  name="success"
                  :size="14"
                />
                <IconWrapper
                  v-else
                  name="error"
                  :size="14"
                />
                {{ result.success ? t("mergeSuccessStatus") : t("mergeFailedStatus") }}
              </span>
            </div>
            <div
              v-if="result.outputPath"
              class="info-item"
            >
              <span class="info-label">{{ t("outputPath") }}：</span>
              <span class="info-value">{{ result.outputPath }}</span>
            </div>
            <div
              v-if="result.error"
              class="info-item"
            >
              <span class="info-label">{{ t("errorMessage") }}：</span>
              <span class="info-value">{{ result.error }}</span>
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
          {{ result ? t("close") : t("cancel") }}
        </Button>
        <Button
          variant="primary"
          :disabled="progress || !selectedVideo || !selectedAudio"
          @click="$emit('start')"
        >
          {{ progress ? t("merging") : t("startMerge") }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlugin } from "@/main"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

defineProps<{
  visible: boolean
  videoOptions: Array<{ label: string; value: string }>
  audioOptions: Array<{ label: string; value: string }>
  selectedVideo: string
  selectedAudio: string
  outputName: string
  progress: boolean
  progressPercent: number
  result: { success: boolean; outputPath?: string; error?: string } | null
}>()

defineEmits<{
  close: []
  start: []
  "update:selectedVideo": [value: string]
  "update:selectedAudio": [value: string]
  "update:outputName": [value: string]
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
