<!-- gitPush 通用确认弹窗组件 -->
<template>
  <div
    v-if="visible"
    class="gp-confirm-mask"
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
</template>

<script setup lang="ts">
defineProps<{
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
</script>

<style lang="scss" scoped>
@use "../styles/ConfirmDialog.scss";
</style>
