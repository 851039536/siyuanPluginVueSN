<!-- 视频压缩对话框组件 -->
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
          name="copy"
          :size="16"
        /> {{ t("compressTitle") }}</h3>
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
          <label>{{ t("selectVideoToCompress") }}</label>
          <Select
            :model-value="selectedVideo"
            :options="videoOptions"
            @update:model-value="$emit('update:selectedVideo', $event)"
          />
        </div>

        <div class="form-group">
          <label>{{ t("compressMode") }}</label>
          <div class="compress-mode-selector">
            <label class="radio-label">
              <input
                :checked="mode === 'crf'"
                type="radio"
                value="crf"
                @change="$emit('update:mode', 'crf')"
              />
              <span>{{ t("crfMode") }}</span>
            </label>
            <label class="radio-label">
              <input
                :checked="mode === 'bitrate'"
                type="radio"
                value="bitrate"
                @change="$emit('update:mode', 'bitrate')"
              />
              <span>{{ t("bitrateMode") }}</span>
            </label>
          </div>
        </div>

        <div
          v-if="mode === 'crf'"
          class="form-group"
        >
          <label>{{ t("crfValue") }}</label>
          <Input
            :model-value="crf"
            type="number"
            @update:model-value="$emit('update:crf', $event)"
          />
          <div class="form-hint">
            {{ t("crfHint") }}
          </div>
        </div>

        <div
          v-if="mode === 'bitrate'"
          class="form-group"
        >
          <label>{{ t("bitrateValue") }}</label>
          <Input
            :model-value="bitrate"
            :placeholder="t('bitratePlaceholder')"
            @update:model-value="$emit('update:bitrate', $event)"
          />
          <div class="form-hint">
            {{ t("bitrateHint") }}
          </div>
        </div>

        <div class="form-group">
          <label>{{ t("outputFileName") }}</label>
          <Input
            :model-value="outputName"
            :placeholder="t('compressedVideoPlaceholder')"
            @update:model-value="$emit('update:outputName', $event)"
          />
        </div>

        <div
          v-if="selectedVideo"
          class="form-group"
        >
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">{{ t("originalSizeLabel") }}：</span>
              <span class="info-value">{{ originalSize }}</span>
            </div>
          </div>
        </div>

        <div
          v-if="progress"
          class="form-group"
        >
          <label>{{ t("compressProgress") }}</label>
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
                {{ result.success ? t("compressSuccessStatus") : t("compressFailedStatus") }}
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
              v-if="originalSizeResult && result.success"
              class="info-item"
            >
              <span class="info-label">{{ t("originalSizeLabel") }}：</span>
              <span class="info-value">{{ originalSizeResult }}</span>
            </div>
            <div
              v-if="newSize && result.success"
              class="info-item"
            >
              <span class="info-label">{{ t("compressedSizeLabel") }}：</span>
              <span class="info-value">{{ newSize }}</span>
            </div>
            <div
              v-if="compressionRate && result.success"
              class="info-item"
            >
              <span class="info-label">{{ t("compressionRateLabel") }}：</span>
              <span class="info-value">{{ compressionRate }}</span>
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
          :disabled="progress || !selectedVideo"
          @click="$emit('start')"
        >
          {{ progress ? t("compressing") : t("startCompress") }}
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
  selectedVideo: string
  mode: string
  crf: string | number
  bitrate: string
  outputName: string
  originalSize: string
  progress: boolean
  progressPercent: number
  result: { success: boolean; outputPath?: string; error?: string } | null
  originalSizeResult: string
  newSize: string
  compressionRate: string
}>()

defineEmits<{
  close: []
  start: []
  "update:selectedVideo": [value: string]
  "update:mode": [value: string]
  "update:crf": [value: string]
  "update:bitrate": [value: string]
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
