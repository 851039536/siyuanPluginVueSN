<!-- FFmpeg 路径设置对话框组件 -->
<template>
  <Dialog
    :visible="visible"
    :header="t('ffmpegPathTitle')"
    :close-label="t('close')"
    :dismissable-mask="true"
    @update:visible="$emit('close')"
  >
    <div class="form-group">
      <label>{{ t("currentFFmpegPath") }}</label>
      <div
        class="file-info"
        :title="currentPath"
      >
        {{ currentPath }}
      </div>
      <div class="form-hint">
        {{ t("ffmpegPathHint") }}
      </div>
    </div>

    <div class="form-group">
      <label>{{ t("customFFmpegPath") }}</label>
      <Input
        :model-value="customPath"
        :placeholder="t('customFFmpegPathPlaceholder')"
        @update:model-value="$emit('update:customPath', String($event ?? ''))"
      />
      <div class="form-hint">
        {{ t("customFFmpegPathHint") }}
      </div>
    </div>

    <div
      v-if="testResult"
      class="form-group"
    >
      <label>{{ t("testResult") }}</label>
      <div class="encrypt-info">
        <div class="info-item">
          <span class="info-label">{{ t("status") }}：</span>
          <span
            class="info-value"
            :style="{ color: testResult === 'success' ? '#788c5d' : '#d97757' }"
          >
            <IconWrapper
              v-if="testResult === 'success'"
              name="success"
              :size="14"
            />
            <IconWrapper
              v-else
              name="error"
              :size="14"
            />
            {{ testResult === 'success' ? t("pathValid") : t("pathInvalid") }}
          </span>
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        variant="secondary"
        @click="$emit('reset')"
      >
        {{ t("reset") }}
      </Button>
      <Button
        variant="secondary"
        @click="$emit('test')"
      >
        {{ t("testPath") }}
      </Button>
      <Button
        variant="primary"
        @click="$emit('save')"
      >
        {{ t("save") }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { usePlugin } from "@/main"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"

defineProps<{
  visible: boolean
  currentPath: string
  customPath: string
  testResult: string | null
}>()

defineEmits<{
  close: []
  reset: []
  test: []
  save: []
  "update:customPath": [value: string]
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
