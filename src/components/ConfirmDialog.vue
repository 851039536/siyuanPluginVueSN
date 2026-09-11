<!-- 确认对话框：受控显示（v-model:visible）+ 九档位置 + 官方命名的插槽，内容段由 ConfirmBody 渲染 -->
<template>
  <Transition name="si-confirm-fade">
    <div
      v-if="visible"
      :class="maskClasses"
      @mousedown="handleMaskMouseDown"
      @mouseup="handleMaskMouseUp"
    >
      <div
        ref="dialogRef"
        class="si-confirm"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="header ? titleId : undefined"
        :aria-label="header ? undefined : ariaLabel"
        tabindex="-1"
      >
        <!-- 整块内容可替换（作用域含全部字段与三个回调；官方另有 initDragCallback，本项目不做 draggable） -->
        <slot
          name="container"
          v-bind="containerScope"
        >
          <ConfirmBody
            :header="header"
            :message="message"
            :icon="icon"
            :accept-label="acceptLabel"
            :reject-label="rejectLabel"
            :accept-severity="acceptSeverity"
            :accept-icon="acceptIcon"
            :reject-icon="rejectIcon"
            :accept-loading="acceptLoading"
            :closable="closable"
            :close-label="closeLabel"
            :size="size"
            :title-id="titleId"
            @accept="handleConfirm"
            @reject="handleReject"
          >
            <!-- 五个官方插槽原样转发给内容段（未传时不建立插槽，让内容段的回退逻辑生效） -->
            <template
              v-if="$slots.default"
              #default
            >
              <slot />
            </template>
            <template
              v-if="$slots.message"
              #message="scope"
            >
              <slot
                name="message"
                v-bind="scope"
              />
            </template>
            <template
              v-if="$slots.icon"
              #icon="scope"
            >
              <slot
                name="icon"
                v-bind="scope"
              />
            </template>
            <template
              v-if="$slots.accepticon"
              #accepticon
            >
              <slot name="accepticon" />
            </template>
            <template
              v-if="$slots.rejecticon"
              #rejecticon
            >
              <slot name="rejecticon" />
            </template>
          </ConfirmBody>
        </slot>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { IconKey } from "./kit/icons"
import type {
  ConfirmContainerScope,
  ConfirmPosition as ConfirmPositionShape,
  ConfirmSeverity as ConfirmSeverityShape,
  ConfirmSize as ConfirmSizeShape,
} from "./confirm/types"
import {
  computed,
  ref,
  useId,
} from "vue"
import {
  DEFAULT_ACCEPT_LABEL,
  DEFAULT_CLOSE_LABEL,
  DEFAULT_REJECT_LABEL,
} from "./confirm/types"
import { overlayPositionClass } from "./overlay/types"
import { useOverlay } from "./overlay/useOverlay"
import ConfirmBody from "./confirm/ConfirmBody.vue"
import "./kit/theme"

// 公开类型转出（沿用 Paginator / Timeline 的别名转出写法：`<script setup>` 不能直接 re-export 导入名）
export type ConfirmPosition = ConfirmPositionShape
export type ConfirmSeverity = ConfirmSeverityShape
export type ConfirmSize = ConfirmSizeShape

interface Props {
  /** 是否显示（受控，配合 `v-model:visible`） */
  visible: boolean
  /** 标题（官方命名：`ConfirmationOptions.header`） */
  header?: string
  /** 消息文本，支持 `\n` 多行（默认插槽 / `message` 插槽存在时被覆盖） */
  message?: string
  /** 标题图标 */
  icon?: IconKey
  /** 确认按钮文案 */
  acceptLabel?: string
  /** 取消按钮文案 */
  rejectLabel?: string
  /** 确认按钮配色：`danger`（默认，不可撤销操作）/ `primary` */
  acceptSeverity?: ConfirmSeverity
  /** 确认按钮前置图标 */
  acceptIcon?: IconKey
  /** 取消按钮前置图标 */
  rejectIcon?: IconKey
  /** 确认按钮加载态（异步确认操作时由调用方置位） */
  acceptLoading?: boolean
  /** 是否显示右上角关闭按钮（默认关闭：确认框已有「取消」，与官方 Dialog 默认 `true` 属有意差异） */
  closable?: boolean
  /** 关闭按钮的无障碍名称（默认中文，可覆盖为调用方 i18n） */
  closeLabel?: string
  /** 点击遮罩是否触发取消（官方 Dialog 命名 `dismissableMask`） */
  dismissableMask?: boolean
  /** 按 Esc 是否触发取消 */
  closeOnEscape?: boolean
  /** 位置九档：`center`（默认）/ `left` / `right` / `top` / `bottom` / 四角 */
  position?: ConfirmPosition
  /** 按钮尺寸档位 */
  size?: ConfirmSize
  /** 无标题时的无障碍名称（有标题时自动关联标题） */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  header: "",
  message: "",
  acceptLabel: DEFAULT_ACCEPT_LABEL,
  rejectLabel: DEFAULT_REJECT_LABEL,
  closeLabel: DEFAULT_CLOSE_LABEL,
  acceptSeverity: "danger",
  acceptLoading: false,
  closable: false,
  dismissableMask: true,
  closeOnEscape: true,
  position: "center",
  size: "small",
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  "update:visible": [value: boolean]
}>()

/** 标题元素 id（`aria-labelledby` 指向它；内容段负责把 id 打在标题上） */
const titleId = `${useId()}-title`

const dialogRef = ref<HTMLElement | null>(null)

const maskClasses = computed(() => [
  "si-confirm-mask",
  overlayPositionClass("si-confirm-mask", props.position),
])

/** `container` 插槽作用域：关闭与取消同义（都派发 cancel + 关闭） */
const containerScope = computed<ConfirmContainerScope>(() => ({
  header: props.header,
  message: props.message,
  icon: props.icon,
  acceptLabel: props.acceptLabel,
  rejectLabel: props.rejectLabel,
  closeCallback: handleReject,
  rejectCallback: handleReject,
  acceptCallback: handleConfirm,
}))

/** 确认：不自动关闭，由调用方决定关闭时机（便于异步操作） */
function handleConfirm(): void {
  emit("confirm")
}

/** 取消 / 关闭：同时同步受控值，便于父组件直接 `v-model:visible` */
function handleReject(): void {
  emit("cancel")
  emit("update:visible", false)
}

/**
 * 遮罩点关 / Esc / 焦点接管与归还统一交给共享弹层外壳（overlay/useOverlay，与 Dialog 同一套）：
 * 点关需「在遮罩上按下并抬起」才算数（官方语义，替代此前的 `@click.self`）；
 * 打开时仍聚焦容器而非确认按钮（危险操作默认聚焦按钮会被 Enter 误触），关闭时归还焦点。
 */
const {
  handleMaskMouseDown,
  handleMaskMouseUp,
} = useOverlay({
  visible: () => props.visible,
  dismissableMask: () => props.dismissableMask,
  closeOnEscape: () => props.closeOnEscape,
  onDismiss: handleReject,
  containerRef: dialogRef,
})
</script>

<style scoped lang="scss">
@use './styles/ConfirmDialog.scss';
</style>
