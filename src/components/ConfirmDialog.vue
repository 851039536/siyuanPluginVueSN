<!-- 通用确认对话框：标题 + 多行消息 + 危险配色，支持遮罩点关与 Esc 取消 -->
<template>
  <Transition name="si-confirm-fade">
    <div
      v-if="visible"
      class="si-confirm-mask"
      @click.self="handleMaskClick"
    >
      <div
        ref="dialogRef"
        class="si-confirm"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
      >
        <!-- 标题区 -->
        <div class="si-confirm__header">
          <span class="si-confirm__title">{{ title }}</span>
        </div>
        <!-- 消息区：默认按 \n 拆行渲染，使用默认插槽可传富内容 -->
        <div class="si-confirm__body">
          <slot>
            <p
              v-for="(line, index) in messageLines"
              :key="index"
              class="si-confirm__message"
            >{{ line }}</p>
          </slot>
        </div>
        <!-- 操作区 -->
        <div class="si-confirm__footer">
          <Button
            variant="ghost"
            :size="size"
            @click="handleCancel"
          >
            {{ cancelText }}
          </Button>
          <Button
            :variant="danger ? 'danger' : 'primary'"
            :size="size"
            :loading="confirmLoading"
            @click="handleConfirm"
          >
            {{ confirmText }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"

type ConfirmDialogSize = "xsmall" | "small" | "medium" | "large"

interface Props {
  /** 是否显示（受控，配合 @update:visible 使用 v-model:visible） */
  visible: boolean
  /** 标题 */
  title: string
  /** 消息文本，支持 \n 多行 */
  message?: string
  /** 确认按钮文案 */
  confirmText?: string
  /** 取消按钮文案 */
  cancelText?: string
  /** 确认按钮使用危险配色（删除、覆盖等不可撤销操作） */
  danger?: boolean
  /** 按钮尺寸档位 */
  size?: ConfirmDialogSize
  /** 点击遮罩是否触发取消 */
  closeOnMask?: boolean
  /** 确认按钮加载态（异步确认操作时由调用方置位） */
  confirmLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  message: "",
  confirmText: "确定",
  cancelText: "取消",
  danger: true,
  size: "small",
  closeOnMask: true,
  confirmLoading: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  "update:visible": [value: boolean]
}>()

const dialogRef = ref<HTMLElement | null>(null)
/** 打开前的焦点元素，关闭时归还，避免键盘用户丢失位置 */
let previousActive: HTMLElement | null = null

/** 多行消息按行拆分，忽略空行 */
const messageLines = computed(() =>
  props.message.split("\n").filter((line) => line.trim() !== ""),
)

function handleConfirm(): void {
  emit("confirm")
}

/** 取消：同时同步受控值，便于父组件直接 v-model:visible */
function handleCancel(): void {
  emit("update:visible", false)
  emit("cancel")
}

function handleMaskClick(): void {
  if (props.closeOnMask) {
    handleCancel()
  }
}

/**
 * 仅监听 Esc：Enter 交由聚焦按钮的原生键盘行为触发，
 * 避免 window 监听与按钮 click 重复派发确认
 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault()
    handleCancel()
  }
}

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      previousActive = document.activeElement as HTMLElement | null
      window.addEventListener("keydown", handleKeydown)
      await nextTick()
      // 焦点给对话框容器而非确认按钮：危险操作默认聚焦按钮会被 Enter 误触
      dialogRef.value?.focus()
    } else {
      window.removeEventListener("keydown", handleKeydown)
      previousActive?.focus()
      previousActive = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown)
})
</script>

<style scoped lang="scss">
@use './styles/ConfirmDialog.scss';
</style>
