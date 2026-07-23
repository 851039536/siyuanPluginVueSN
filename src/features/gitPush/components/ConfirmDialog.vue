<!-- gitPush 通用确认弹窗组件 -->
<template>
  <Transition name="gp-dialog-fade">
    <div
      v-if="visible"
      ref="rootRef"
      tabindex="-1"
      class="gp-confirm-mask"
      @keydown.escape="$emit('cancel')"
      @keydown.enter="$emit('confirm')"
      @click.self="$emit('cancel')"
    >
      <div class="gp-confirm-dialog">
        <div class="gp-confirm-header">
          <span>{{ title }}</span>
        </div>
        <div class="gp-confirm-body">
          <slot name="message">
            <p class="gp-confirm-message">{{ message }}</p>
          </slot>
        </div>
        <div class="gp-confirm-footer">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            @click="$emit('cancel')"
          >
            {{ cancelText }}
          </button>
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            @click="$emit('confirm')"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { toRef } from "vue"
import { useDialogKeyboard } from "../composables/useDialogKeyboard"

const props = defineProps<{
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()

const { rootRef } = useDialogKeyboard(toRef(props, "visible"))
</script>

<style lang="scss" scoped>
@use "../styles/ConfirmDialog.scss";
</style>
