<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="script-output-mask"
      @click="handleMaskClick"
    >
      <div
        class="script-output"
        @click.stop
      >
        <div class="script-output__header">
          <div class="script-output__info">
            <span class="script-output__name">{{ script?.name }}</span>
            <Badge
              v-if="script"
              :color="getLanguageColor(script.language)"
              size="small"
            >
              {{ getLanguageLabel(script.language) }}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="small"
            icon="close"
            @click="emit('close')"
          />
        </div>

        <div
          ref="outputRef"
          class="script-output__terminal"
        >
          <div
            v-if="running"
            class="script-output__spinner-row"
          >
            <span class="script-output__spinner" />
            <span>{{ i18n.running || "运行中..." }}</span>
          </div>

          <div
            v-if="stdout"
            class="script-output__stdout"
          >
            <pre>{{ stdout }}</pre>
          </div>

          <div
            v-if="stderr"
            class="script-output__stderr"
          >
            <pre>{{ stderr }}</pre>
          </div>

          <div
            v-if="!running && exitCode !== null"
            class="script-output__exit"
            :class="{ 'script-output__exit--error': exitCode !== 0 }"
          >
            {{ i18n.exitCode || "退出码" }}: {{ exitCode }}
          </div>
        </div>

        <div class="script-output__footer">
          <Button
            variant="secondary"
            size="small"
            @click="emit('close')"
          >
            {{ i18n.close || "关闭" }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Script } from "../types"
import type { I18n } from "../types/index"
import {
  nextTick,
  ref,
  watch,
} from "vue"
import Badge from "@/components/Badge.vue"
import Button from "@/components/Button.vue"
import { SCRIPT_LANGUAGE_CONFIG } from "../types"

interface Props {
  script: Script | null
  visible: boolean
  running: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  i18n: I18n
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const outputRef = ref<HTMLElement>()

function getLanguageColor(language: string): string {
  return SCRIPT_LANGUAGE_CONFIG[language as keyof typeof SCRIPT_LANGUAGE_CONFIG]?.color || "#6B7280"
}

function getLanguageLabel(language: string): string {
  return SCRIPT_LANGUAGE_CONFIG[language as keyof typeof SCRIPT_LANGUAGE_CONFIG]?.label || language
}

function handleMaskClick() {
  emit("close")
}

function scrollToBottom() {
  nextTick(() => {
    if (outputRef.value) {
      outputRef.value.scrollTop = outputRef.value.scrollHeight
    }
  })
}

watch(() => props.stdout, scrollToBottom)
watch(() => props.stderr, scrollToBottom)
watch(() => props.visible, (visible) => {
  if (visible) scrollToBottom()
})
</script>

<style lang="scss" scoped>
@use "@/variables.scss" as *;

.script-output-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.script-output {
  width: 640px;
  max-width: 90vw;
  height: 70vh;
  background: var(--b3-theme-background, $brand-light);
  border-radius: $radius-lg;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-3 $spacing-4;
    border-bottom: 1px solid var(--b3-border-color, $brand-subtle-gray);
  }

  &__info {
    display: flex;
    align-items: center;
    gap: $spacing-2;
  }

  &__name {
    font-family: $font-heading;
    font-weight: 600;
    font-size: $font-size-base;
    color: var(--b3-theme-on-background, $brand-dark);
  }

  &__terminal {
    flex: 1;
    overflow-y: auto;
    padding: $spacing-3 $spacing-4;
    background: #1e1e1e;
    color: #d4d4d4;
    font-family: "Consolas", "Monaco", "Courier New", monospace;
    font-size: 13px;
    line-height: 1.5;

    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  &__spinner-row {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    color: #d4d4d4;
    margin-bottom: $spacing-2;
  }

  &__spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid #d4d4d4;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  &__stdout {
    color: #4ec9b0;
    margin-bottom: $spacing-2;
  }

  &__stderr {
    color: #f48771;
    margin-bottom: $spacing-2;
  }

  &__exit {
    padding: $spacing-1 $spacing-2;
    border-radius: $radius-sm;
    background: rgba(78, 201, 176, 0.15);
    color: #4ec9b0;
    font-size: 12px;
    font-weight: 500;
    display: inline-block;

    &--error {
      background: rgba(244, 135, 113, 0.15);
      color: #f48771;
    }
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: $spacing-2;
    padding: $spacing-3 $spacing-4;
    border-top: 1px solid var(--b3-border-color, $brand-subtle-gray);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
