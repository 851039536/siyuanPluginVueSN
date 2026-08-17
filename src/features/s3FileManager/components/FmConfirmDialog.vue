<!-- 通用确认对话框：危险操作二次确认，替代原生 confirm -->
<template>
  <div
    v-if="visible"
    class="fm-confirm-mask"
    @click.self="emit('close')"
  >
    <div
      class="fm-confirm-dialog"
      role="dialog"
      aria-modal="true"
    >
      <!-- 标题区 -->
      <div class="fm-confirm-header">
        <span class="fm-confirm-title">{{ title }}</span>
      </div>

      <!-- 消息区（支持多行文本） -->
      <div class="fm-confirm-body">
        <p
          v-for="(line, idx) in messageLines"
          :key="idx"
          class="fm-confirm-message"
        >{{ line }}</p>
      </div>

      <!-- 底部操作栏 -->
      <div class="fm-confirm-footer">
        <Button
          variant="ghost"
          size="small"
          @click="emit('close')"
        >
          {{ cancelText }}
        </Button>
        <Button
          :variant="danger ? 'danger' : 'primary'"
          size="small"
          @click="emit('confirm')"
        >
          {{ confirmText }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Button from "@/components/Button.vue"
import { useEscClose } from "../composables/useEscClose"

interface Props {
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  /** 确认按钮使用危险配色（删除/清空等不可撤销操作） */
  danger?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: "确定",
  cancelText: "取消",
  danger: true,
})

const emit = defineEmits<{
  confirm: []
  close: []
}>()

// Esc 关闭确认框（LIFO 栈，不会误关下层弹窗）
useEscClose(() => emit("close"))

const messageLines = computed(() => props.message.split("\n").filter((line) => line.trim() !== ""))
</script>

<style scoped lang="scss">
@use "../styles/FmConfirmDialog.scss";
@use "../styles/index.scss";
</style>
