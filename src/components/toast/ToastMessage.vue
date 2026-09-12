<!-- Toast 单条消息（私有子部件）：图标 + 标题/详情 + 关闭按钮 + life 计时（悬停暂停/移出续计） -->
<template>
  <div
    class="si-toast__message"
    :class="messageClasses"
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- container 插槽：整块替换单条消息（官方作用域 { message, closeCallback }） -->
    <slot
      v-if="hasContainerSlot"
      name="container"
      :message="message"
      :close-callback="handleClose"
    />
    <template v-else>
      <div class="si-toast__content">
        <!-- message 插槽：整块替换图标 + 文字区（官方作用域 { message }） -->
        <slot
          v-if="hasMessageSlot"
          name="message"
          :message="message"
        />
        <template v-else>
          <!--
            图标：优先 messageicon 插槽，其次已废弃的 icon 别名插槽，再回落各 severity 的默认图标；
            secondary / contrast 官方无默认图标 ⇒ 无插槽时该位置不渲染（不臆造图标）。
            ⚠️ 插槽外再套一层带 `.si-toast__icon` 的容器：`class` 作为**作用域参数**传给插槽
               （对齐官方 `{ class }`），调用方拿到的是字符串、不会自动成为真实 class，
               故由本容器承担图标位的尺寸约束与语义取色。
          -->
          <span
            v-if="hasIconSlot"
            class="si-toast__icon"
          >
            <slot
              :name="iconSlotName"
              class="si-toast__icon"
            />
          </span>
          <IconWrapper
            v-else-if="iconName"
            :name="iconName"
            :size="iconSize"
            class="si-toast__icon"
          />
          <div class="si-toast__text">
            <span class="si-toast__summary">{{ message.summary }}</span>
            <!-- 详情行：未传 detail 时整行不渲染 -->
            <div
              v-if="message.detail"
              class="si-toast__detail"
            >
              {{ message.detail }}
            </div>
          </div>
        </template>
      </div>
      <!-- 关闭按钮：closable !== false 才渲染（官方判据）；closeicon 插槽仅替换图标 -->
      <div
        v-if="isClosable"
        class="si-toast__close-wrap"
      >
        <Button
          v-if="!hasCloseIconSlot"
          class="si-toast__close"
          variant="ghost"
          text
          rounded
          :size="size"
          icon="close"
          :aria-label="closeLabel"
          @click="handleClose"
        />
        <!-- closeicon 插槽：仅替换关闭按钮内的图标（Button 的图标只能由 icon prop 驱动，故此处自绘按钮本体） -->
        <button
          v-else
          class="si-toast__close si-toast__close--slot"
          type="button"
          :aria-label="closeLabel"
          @click="handleClose"
        >
          <slot name="closeicon" />
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "../kit/icons"
import type {
  ToastMessage,
  ToastSeverity,
  ToastSize,
} from "./types"
import {
  computed,
  onBeforeUnmount,
  useSlots,
} from "vue"
import Button from "../Button.vue"
import IconWrapper from "../IconWrapper.vue"
import {
  SEVERITY_ICON,
  TIER_ICON_SIZE,
} from "./types"

interface Props {
  /** 单条消息（`id` 已由父组件补齐） */
  message: ToastMessage
  /** 尺寸档位（与根容器同档，由 Toast.vue 透传） */
  size: ToastSize
  /** 关闭按钮的可访问名称 */
  closeLabel: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 请求移除本消息：`life` 到期与点击关闭按钮走同一出口，第二条参数区分来源 */
  close: [message: ToastMessage, reason: "close" | "life-end"]
}>()

const slots = useSlots()

/** 官方 `message` 插槽存在时，图标与文字区整体交给调用方 */
const hasMessageSlot = computed(() => !!slots.message)
/** `container` 插槽存在时，整条消息（含关闭按钮）交给调用方 */
const hasContainerSlot = computed(() => !!slots.container)
/** `messageicon`（官方名）与 `icon`（官方 v4 已废弃别名）任一存在即视为图标插槽 */
const hasIconSlot = computed(() => !!slots.messageicon || !!slots.icon)
const iconSlotName = computed(() => (slots.messageicon ? "messageicon" : "icon"))
/** `closeicon` 插槽存在时改由自绘按钮承载（Button 的图标只能经 icon prop 指定） */
const hasCloseIconSlot = computed(() => !!slots.closeicon)

/** 未显式指定 severity 时按 info 渲染（与官方默认值一致） */
const severity = computed<ToastSeverity>(() => props.message.severity ?? "info")

const messageClasses = computed(() => [
  `si-toast__message--${severity.value}`,
])

/** 官方判据：`closable !== false` 即渲染关闭按钮（默认 true） */
const isClosable = computed(() => props.message.closable !== false)

const iconName = computed<IconKey | undefined>(() => SEVERITY_ICON[severity.value])
const iconSize = computed(() => TIER_ICON_SIZE[props.size])

// ==================== life 计时（悬停暂停 / 移出续计剩余时长） ====================

/**
 * 计时状态机（对齐官方 `lifeRemaining` 语义）：
 * - `remaining`：本次计时剩余的毫秒数（暂停时结算写回，恢复时作新的定时长度）
 * - `startedAt`：本次计时的起点时刻
 * - `timer`：`null` 表示「当前未在计时」（可能尚未启动、已暂停、或已到期）
 * - `hasLife`：该消息是否配置了有效的 `life`（无 life 的消息永不参与计时的启动/恢复）
 */
let remaining = 0
let startedAt = 0
let timer: number | null = null
const hasLife = typeof props.message.life === "number"
  && Number.isFinite(props.message.life)
  && props.message.life > 0

const clearTimer = () => {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
}

const startTimer = () => {
  clearTimer()
  startedAt = Date.now()
  timer = window.setTimeout(() => {
    timer = null
    emit("close", props.message, "life-end")
  }, remaining)
}

/** 暂停：结算已消耗时长并写回 `remaining`（可能为负 —— 表示悬停期间已耗尽） */
const pauseTimer = () => {
  if (timer === null) return
  remaining -= Date.now() - startedAt
  clearTimer()
}

/**
 * 恢复：以暂停时结算的剩余量为新的定时长度重新计时。
 * ⚠️ 悬停期间若已耗尽剩余时长（`remaining <= 0`），按官方语义**立即到期**而非静默停摆 ——
 *    否则会出现「悬停久了就再也不自动关闭」的哑火状态。
 */
const resumeTimer = () => {
  if (remaining <= 0) {
    emit("close", props.message, "life-end")
    return
  }
  startTimer()
}

if (hasLife) {
  remaining = props.message.life as number
  startTimer()
}

const handleMouseEnter = () => pauseTimer()

const handleMouseLeave = () => {
  // 仅对配置了 life 的消息恢复计时，避免无 life 的消息被悬停「激活」出倒计时
  if (hasLife) resumeTimer()
}

/** 手动关闭：先停掉计时，避免同一实例被「到期」与「点击」重复触发两次 */
const handleClose = () => {
  clearTimer()
  remaining = 0
  emit("close", props.message, "close")
}

onBeforeUnmount(clearTimer)
</script>

<style scoped lang="scss">
@use '../styles/ToastMessage.scss';
</style>
