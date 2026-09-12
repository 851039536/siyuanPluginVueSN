<!-- 消息通知浮层：八向停靠的消息堆栈（受控 messages + 自动清除 + size 档位 + 进出场过渡） -->
<template>
  <div
    class="si-toast"
    :class="rootClasses"
    role="region"
    :aria-label="ariaLabel"
  >
    <TransitionGroup
      name="si-toast-item"
      tag="div"
      class="si-toast__list"
    >
      <ToastMessageItem
        v-for="message in visibleMessages"
        :key="message.id"
        :message="message"
        :size="size"
        :close-label="closeLabel"
        @close="handleMessageClose"
      >
        <!-- 具名 / 作用域插槽全量透传给单条消息（Toast 自身不消费，只做转发） -->
        <template
          v-if="$slots.container"
          #container="scope"
        >
          <slot
            name="container"
            v-bind="scope"
          />
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
          v-if="$slots.messageicon"
          #messageicon="scope"
        >
          <slot
            name="messageicon"
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
          v-if="$slots.closeicon"
          #closeicon="scope"
        >
          <slot
            name="closeicon"
            v-bind="scope"
          />
        </template>
      </ToastMessageItem>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import type {
  ToastMessage,
  ToastMessageOptions,
  ToastPosition,
  ToastSeverity,
  ToastSize,
} from "./toast/types"
import {
  computed,
  ref,
  watch,
} from "vue"
import "./kit/theme"
import ToastMessageItem from "./toast/ToastMessage.vue"
import {
  DEFAULT_POSITION,
  DEFAULT_SEVERITY,
} from "./toast/types"

// 公开类型转出（沿用 Tooltip / Dialog 的别名转出写法：`<script setup>` 不能直接 re-export 导入名）
export type ToastMessageOptionsPublic = ToastMessageOptions
export type ToastSeverityPublic = ToastSeverity
export type ToastPositionPublic = ToastPosition
export type ToastSizePublic = ToastSize

interface Props {
  /**
   * 消息队列（**受控**，配合 `v-model:messages`）。
   * 组件不会直接改动该数组，而是经 `update:messages` 派发**移除后的新数组**等调用方回写
   * （同 `Dialog.visible` / `ConfirmDialog.visible` 的受控范式）；不传时组件自持内部副本（便于 `add()` 独立使用）。
   */
  messages?: ToastMessageOptions[]
  /**
   * 分组名：仅渲染 `group` 与之相等的消息（`undefined` 只匹配未指定 group 的消息），与官方一致。
   * ⚠️ 它同时是 `removeGroup()` 的作用域边界。
   */
  group?: string
  /** 停靠方位（八档，默认 `top-right`） */
  position?: ToastPosition
  /** 尺寸档位：驱动字号 10/12/14/16、消息卡宽度与图标边长 */
  size?: ToastSize
  /** 关闭按钮的可访问名称（可覆盖为调用方 i18n 文案） */
  closeLabel?: string
  /** 浮层根元素的无障碍名称 */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  messages: undefined,
  group: undefined,
  position: DEFAULT_POSITION,
  size: "small",
  closeLabel: "关闭",
  ariaLabel: "消息通知",
})

const emit = defineEmits<{
  /** 队列变更：载荷为移除后的**剩余队列**（关闭按钮 / life 到期 / 程序化移除都走此出口） */
  "update:messages": [messages: ToastMessageOptions[]]
  /** 单条消息关闭：第二条参数区分来源（`life-end` 为自动到期） */
  close: [message: ToastMessage, reason: "close" | "life-end"]
}>()

/** 未接 `v-model:messages` 时组件自持的副本（便于 `add()` 独立使用；接管后可无视） */
const innerMessages = ref<ToastMessageOptions[]>([])

/** 是否受控：显式传了 `messages` 即以调用方为准（`undefined` 为自持模式） */
const isControlled = computed(() => props.messages !== undefined)

/** 模块级自增 id：`v-for` 的 key 与 `remove()` 的精确定位都依赖它 */
let messageIdx = 0

/**
 * 稳定 id 登记表：以**消息对象本身**为键（`WeakMap` 不阻止 GC）。
 * ⚠️ 自增计数器绝不能放进 `computed` —— 每次重算都会继续递增，同一条消息的 `id` 随之漂移，
 *    `v-for` 的 key 失效会导致列表错位与过渡动画错乱。故 id 一律在此按对象身份登记一次（幂等）。
 */
const idRegistry = new WeakMap<object, number>()

/** 取（或登记）某条消息的稳定 id */
const resolveId = (message: ToastMessageOptions): number => {
  if (message.id !== undefined) return message.id
  const existing = idRegistry.get(message)
  if (existing !== undefined) return existing
  const id = messageIdx++
  idRegistry.set(message, id)
  return id
}

/** 入列适配：逐条补 `id` 与默认 `severity`（`add()` 与受控入参两条入口共用） */
const normalize = (list: ToastMessageOptions[]): ToastMessage[] =>
  list.map(message => ({
    ...message,
    id: resolveId(message),
    severity: message.severity ?? DEFAULT_SEVERITY,
  }))

/** 当前队列（受控取 props，未受控取自持副本），并完成 id / severity 适配 */
const sourceMessages = computed<ToastMessage[]>(() =>
  normalize(isControlled.value ? (props.messages ?? []) : innerMessages.value),
)

/** 按 `group` 过滤（官方 `onAdd` 判据：`undefined` 只匹配未指定 group 的消息） */
const visibleMessages = computed<ToastMessage[]>(() =>
  sourceMessages.value.filter(message => message.group === props.group),
)

const rootClasses = computed(() => [
  `si-toast--${props.size}`,
  `si-toast--${props.position}`,
])

/**
 * 提交队列变更：把「变更后的队列」向上派发。
 * ⚠️ 受控时**不改** props，仅派发 `update:messages`（单向数据流）；未受控时自持副本同步更新。
 */
const commit = (next: ToastMessageOptions[]) => {
  if (!isControlled.value) {
    innerMessages.value = next
  }
  emit("update:messages", next)
}

/** 单条消息关闭（关闭按钮 / life 到期）：通报 `close` 后从队列移除 */
const handleMessageClose = (message: ToastMessage, reason: "close" | "life-end") => {
  emit("close", message, reason)
  commit(sourceMessages.value.filter(item => item.id !== message.id))
}

// ==================== 程序化 API（对齐官方 ToastServiceMethods） ====================

/**
 * 入列一条消息：`id` 与默认 `severity` 经 `normalize` 补齐后**随队列一并派发**，
 * 调用方回写时该条已带 `id`，故 `remove()` 可精确定位。
 */
const add = (message: ToastMessageOptions) => {
  const [enriched] = normalize([message])
  commit([...sourceMessages.value, enriched])
}

/** 移除指定消息（按 `id` 匹配；传入的对象须带 `id`，即 `add` 派发队列中的那一份） */
const remove = (message: ToastMessageOptions) => {
  if (message.id === undefined) return
  commit(sourceMessages.value.filter(item => item.id !== message.id))
}

/** 清除指定分组的消息（官方 `removeGroup`） */
const removeGroup = (group: string) => {
  commit(sourceMessages.value.filter(item => item.group !== group))
}

/** 清除全部消息（官方 `removeAllGroups`） */
const removeAll = () => {
  commit([])
}

defineExpose({
  add,
  remove,
  removeGroup,
  removeAll,
})

// ==================== DEV 提示 ====================

/**
 * 无可见标题的浮层必须有可访问名称（同 Toolbar / MegaMenu 的约定）。
 * `ariaLabel` 有中文默认值，故仅在调用方显式传空串时告警。
 */
watch(
  () => props.ariaLabel,
  (value) => {
    if (import.meta.env.DEV && !value)
      console.warn("[Toast] 浮层缺少可访问名称，请提供 ariaLabel。")
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
@use './styles/Toast.scss';
</style>
