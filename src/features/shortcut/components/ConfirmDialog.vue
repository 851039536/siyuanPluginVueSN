<!-- 通用确认对话框：标题 + 消息 + 取消/确认按钮，用于删除等危险操作 -->
<template>
  <div
    v-if="visible"
    class="shortcut-confirm-overlay"
    @click="$emit('close')"
  >
    <div
      class="shortcut-confirm-dialog"
      role="dialog"
      aria-modal="true"
      @click.stop
    >
      <!-- 标题区 -->
      <div class="confirm-header">
        <div class="confirm-title">
          {{ title }}
        </div>
      </div>
      <!-- 消息区 -->
      <div class="confirm-body">
        <p>{{ message }}</p>
      </div>
      <!-- 底部操作栏 -->
      <div class="confirm-footer">
        <Button
          variant="secondary"
          size="xsmall"
          @click="$emit('close')"
        >
          {{ cancelText }}
        </Button>
        <Button
          variant="danger"
          size="xsmall"
          @click="$emit('confirm')"
        >
          {{ confirmText }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"

interface Props {
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
}

withDefaults(defineProps<Props>(), {
  confirmText: "删除",
  cancelText: "取消",
})

defineEmits<{
  close: []
  confirm: []
}>()
</script>

<style lang="scss" scoped>
@use "../styles/ConfirmDialog.scss";
</style>
