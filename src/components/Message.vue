<!-- 内联消息提示：语义着色 + 可选图标 + 可关闭 + 定时关闭 -->
<template>
  <div
    :class="rootClasses"
    role="alert"
    aria-live="polite"
    aria-atomic="true"
  >
    <div class="si-message__content">
      <!-- 图标：icon 插槽优先，其次 icon prop，都不传则不渲染（与官方一致：severity 不自动附带图标） -->
      <slot
        name="icon"
        class="si-message__icon"
      >
        <IconWrapper
          v-if="icon"
          :name="icon"
          :size="iconSize"
          class="si-message__icon"
        />
      </slot>
      <div class="si-message__text">
        <slot />
      </div>
    </div>
    <!--
      关闭按钮：closebutton 插槽整块替换（命名对齐库内 Dialog 的 closebutton，而非官方的 closeicon ——
      同类语义全库只有一个名字；自定义内容请自行接线 closeCallback 并保留可访问名称）
    -->
    <template v-if="closable">
      <slot
        name="closebutton"
        v-bind="closeButtonScope"
      >
        <Button
          class="si-message__close"
          variant="ghost"
          text
          rounded
          :size="size"
          icon="close"
          :aria-label="closeLabel"
          @click="handleClose"
        />
      </slot>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "./kit/icons"
import {
  computed,
  onBeforeUnmount,
  watch,
} from "vue"
import Button from "./Button.vue"
import IconWrapper from "./IconWrapper.vue"
import "./kit/theme"

/**
 * 语义类型：取值逐字对齐 PrimeVue Message（warn / error / contrast 为官方写法）
 * ⚠️ 与库内 Button.severity（warning / danger）有意不统一，勿按库内命名「修正」
 */
type MessageSeverity = "secondary" | "success" | "info" | "warn" | "error" | "contrast"
/** 尺寸档位：官方仅 small / large 两档 + 默认档，本项目按库规范收敛为四档（有意差异） */
type MessageSize = "xsmall" | "small" | "medium" | "large"

/** 各档位图标边长（档位字号 10/12/14/16 逐档 +2px） */
const TIER_ICON_SIZE: Record<MessageSize, number> = {
  xsmall: 12,
  small: 14,
  medium: 16,
  large: 18,
}

interface Props {
  /** 语义类型；不传时为主题主色默认外观（官方 Basic 示例） */
  severity?: MessageSeverity
  /** 图标键名；不传且未提供 icon 插槽时不渲染图标 */
  icon?: IconKey
  /** 尺寸档位 */
  size?: MessageSize
  /** 是否显示关闭按钮 */
  closable?: boolean
  /** 自动关闭延时（毫秒）：仅有限正数生效，到期派发 close(null) 并清理定时器 */
  life?: number
  /** 关闭按钮的可访问名称（可覆盖为调用方 i18n 文案） */
  closeLabel?: string
}

interface Emits {
  /**
   * 点击关闭按钮（原生 MouseEvent）或 life 到期（null）时派发。
   * ⚠️ 组件**不自动隐藏**：是否移除由调用方 v-if 决定（同 ConfirmDialog「confirm 后不自动关闭」范式）
   */
  (e: "close", event: MouseEvent | null): void
}

const props = withDefaults(defineProps<Props>(), {
  size: "small",
  closable: false,
  closeLabel: "关闭",
})

const emit = defineEmits<Emits>()

const rootClasses = computed(() => [
  "si-message",
  `si-message--${props.size}`,
  ...(props.severity ? [`si-message--${props.severity}`] : []),
  { "si-message--closable": props.closable },
])

const iconSize = computed(() => TIER_ICON_SIZE[props.size])

/**
 * life 定时器句柄：组件内原生定时器（库内 tooltip / megaMenu / sidebar / tieredMenu 同范式）。
 * 刻意不用 `@/utils/timerRegistry` —— 组件库需可整目录外迁、零业务耦合。
 * ⚠️ 显式标注 `number`：`@types/node` 在作用域内会污染全局 `setTimeout` 的返回类型
 *    （解析到 Node 的 `Timeout`），用 `ReturnType<typeof setTimeout>` 或
 *    `ReturnType<typeof window.setTimeout>` 都会拿到 `Timeout`，与浏览器实现不符。
 */
let lifeTimer: number | null = null

const clearLifeTimer = () => {
  if (lifeTimer !== null) {
    window.clearTimeout(lifeTimer)
    lifeTimer = null
  }
}

// life 变更即「先清后设」（重置而非叠加）；到期先置空句柄再派发，避免与手动关闭重复触发
watch(
  () => props.life,
  (life) => {
    clearLifeTimer()
    if (typeof life === "number" && Number.isFinite(life) && life > 0) {
      lifeTimer = window.setTimeout(() => {
        lifeTimer = null
        emit("close", null)
      }, life)
    }
  },
  { immediate: true },
)

onBeforeUnmount(clearLifeTimer)

const handleClose = (event: MouseEvent) => {
  clearLifeTimer()
  emit("close", event)
}

/** `closebutton` 插槽作用域（对齐库内 `Dialog` 的 `{ closeCallback }`） */
const closeButtonScope = computed(() => ({
  closeCallback: handleClose,
}))
</script>

<style scoped lang="scss">
@use './styles/Message.scss';
</style>
