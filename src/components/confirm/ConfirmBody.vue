<!-- 确认类组件共用内容段：header（图标 + 标题 + 可选关闭）/ message（按 \n 拆行）/ footer（取消 + 确认） -->
<template>
  <div class="si-confirm-body">
    <div
      v-if="header || icon || closable || $slots.icon"
      class="si-confirm-body__header"
    >
      <span
        v-if="icon || $slots.icon"
        class="si-confirm-body__icon"
      >
        <!-- 图标内容可整体替换（作用域给容器类名，便于调用方沿用外观） -->
        <slot name="icon" :class="ICON_CLASS">
          <IconWrapper
            v-if="icon"
            :name="icon"
            :size="18"
          />
        </slot>
      </span>
      <span
        :id="titleId"
        class="si-confirm-body__title"
      >{{ header }}</span>
      <button
        v-if="closable"
        type="button"
        class="si-confirm-body__close"
        :aria-label="closeLabel"
        :title="closeLabel"
        @click="emit('reject')"
      >
        <IconWrapper
          name="close"
          :size="14"
        />
      </button>
    </div>

    <!-- 内容优先级：默认插槽 > message 插槽 > message 字段（按 \n 拆行） -->
    <div class="si-confirm-body__content">
      <slot>
        <slot
          name="message"
          :message="message"
          :icon="icon"
        >
          <p
            v-for="(line, index) in messageLines"
            :key="index"
            class="si-confirm-body__message"
          >{{ line }}</p>
        </slot>
      </slot>
    </div>

    <div class="si-confirm-body__footer">
      <!-- 传了对应插槽时改由插槽渲染图标内容（避免与 Button 的 icon prop 重复渲染） -->
      <Button
        variant="ghost"
        :size="size"
        :icon="$slots.rejecticon ? undefined : rejectIcon"
        @click="emit('reject')"
      >
        <slot name="rejecticon" />{{ rejectLabel }}
      </Button>
      <Button
        :variant="acceptSeverity"
        :size="size"
        :icon="$slots.accepticon ? undefined : acceptIcon"
        :loading="acceptLoading"
        @click="emit('accept')"
      >
        <slot name="accepticon" />{{ acceptLabel }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "../kit/icons"
import type {
  ConfirmSeverity,
  ConfirmSize,
} from "./types"
import {
  computed,
} from "vue"
import {
  DEFAULT_ACCEPT_LABEL,
  DEFAULT_CLOSE_LABEL,
  DEFAULT_REJECT_LABEL,
} from "./types"
import Button from "../Button.vue"
import IconWrapper from "../IconWrapper.vue"
// 主题注入由公开组件（ConfirmDialog / ConfirmPopup）的 `import "./kit/theme"` 触发，私有子部件不重复引入

/** 图标容器类名：同时作为 `icon` 插槽的作用域参数，便于调用方替换图标后沿用外观 */
const ICON_CLASS = "si-confirm-body__icon"

interface Props {
  /** 标题（不传且无图标 / 无关闭按钮时整块标题区不渲染） */
  header?: string
  /** 消息文本，支持 `\n` 多行（默认插槽 / `message` 插槽存在时被覆盖） */
  message?: string
  /** 标题图标 */
  icon?: IconKey
  /** 确认按钮文案 */
  acceptLabel?: string
  /** 取消按钮文案 */
  rejectLabel?: string
  /** 确认按钮配色 */
  acceptSeverity?: ConfirmSeverity
  /** 确认按钮前置图标 */
  acceptIcon?: IconKey
  /** 取消按钮前置图标 */
  rejectIcon?: IconKey
  /** 确认按钮加载态（异步确认时由调用方置位） */
  acceptLoading?: boolean
  /** 是否显示右上角关闭按钮 */
  closable?: boolean
  /** 关闭按钮的无障碍名称（默认中文，可覆盖为调用方 i18n） */
  closeLabel?: string
  /** 按钮尺寸档位 */
  size?: ConfirmSize
  /** 标题元素 id（父组件据此建立 `aria-labelledby` 关联） */
  titleId?: string
}

const props = withDefaults(defineProps<Props>(), {
  message: "",
  acceptLabel: DEFAULT_ACCEPT_LABEL,
  rejectLabel: DEFAULT_REJECT_LABEL,
  closeLabel: DEFAULT_CLOSE_LABEL,
  acceptSeverity: "danger",
  acceptLoading: false,
  closable: false,
  size: "small",
})

/** 内容段只负责「确认 / 取消」两个意图，关闭（遮罩 / Esc / 点外部）由外壳组件归入取消 */
const emit = defineEmits<{
  accept: []
  reject: []
}>()

/** 多行消息按行拆分，忽略空行 */
const messageLines = computed(() =>
  props.message.split("\n").filter((line) => line.trim() !== ""),
)
</script>

<style scoped lang="scss">
@use '../styles/ConfirmBody.scss';
</style>
