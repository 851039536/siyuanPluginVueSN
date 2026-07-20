<!-- 视频合并对话框组件 -->
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
          name="video"
          :size="16"
        /> {{ t("mergeTitle") }}</h3>
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
          <label>{{ t("selectVideosToMerge") }}</label>
          <div class="video-selector">
            <div
              v-for="(video, index) in selectedVideos"
              :key="index"
              class="selected-video-item"
            >
              <span class="video-index">{{ index + 1 }}</span>
              <span
                class="video-name"
                :title="video.name"
              >{{ video.name }}</span>
              <Button
                icon="x"
                variant="ghost"
                size="xsmall"
                :title="t('remove')"
                @click="$emit('remove', index)"
              />
            </div>
            <div
              v-if="selectedVideos.length === 0"
              class="empty-selection"
            >
              {{ t("selectVideoFile") }}
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>{{ t("optionalVideos") }}</label>
          <div class="video-list-select">
            <div
              v-for="video in videos"
              :key="video.path"
              class="video-option"
              :class="{ selected: props.isSelected(video) }"
              @click="$emit('toggle', video)"
            >
              <span class="video-name">{{ video.name }}</span>
              <span class="video-size">{{ formatFileSize(video.size) }}</span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>{{ t("outputFileName") }}</label>
          <Input
            :model-value="outputName"
            :placeholder="t('outputFileNamePlaceholder')"
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
          :disabled="progress || selectedVideos.length < 2"
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

const props = defineProps<{
  visible: boolean
  selectedVideos: Array<{ name: string; path: string; size: number }>
  videos: Array<{ name: string; path: string; size: number }>
  outputName: string
  progress: boolean
  progressPercent: number
  result: { success: boolean; outputPath?: string; error?: string } | null
  isSelected: (video: { path: string }) => boolean
}>()

defineEmits<{
  close: []
  remove: [index: number]
  toggle: [video: { name: string; path: string; size: number }]
  start: []
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 B"
  }
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}


</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
