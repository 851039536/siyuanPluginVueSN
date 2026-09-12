<!-- 就地编辑：只读输出点击后切换为编辑内容（display / content 两态互换，关闭时焦点归还） -->
<template>
  <div
    class="si-inplace"
    :class="rootClasses"
    aria-live="polite"
  >
    <!-- 只读态（display 插槽）：role="button" + tabindex，指针点击与 Enter 都能展开 -->
    <div
      v-if="!isActive"
      ref="displayRef"
      class="si-inplace__display"
      :class="{ 'si-inplace__display--disabled': disabled }"
      :tabindex="disabled ? undefined : 0"
      :role="disabled ? undefined : 'button'"
      :aria-disabled="disabled ? 'true' : undefined"
      @click="handleOpen"
      @keydown.enter.prevent="handleOpen"
    >
      <slot name="display" />
    </div>
    <!-- 编辑态（content 插槽）：作用域给出 closeCallback，由调用方内容自行接线关闭 -->
    <div
      v-else
      class="si-inplace__content"
    >
      <slot
        name="content"
        :close-callback="handleClose"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
} from "vue"
import "./kit/theme"

interface Props {
  /**
   * 是否处于编辑态（**传入即受控**，配合 `v-model:active`；不传时组件自持 = 非受控，
   * 与 `Panel.collapsed` / `Tooltip.visible` 同一范式）。
   */
  active?: boolean
  /** 是否禁用：禁用时 display 不可点击、不可聚焦，也不派发任何开合事件 */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  active: undefined,
  disabled: false,
})

const emit = defineEmits<{
  /** 编辑态变更的新值（受控与非受控两种模式下都会派发） */
  "update:active": [value: boolean]
  /** 展开编辑态：载荷为触发它的原生事件（键盘 Enter 时为 KeyboardEvent） */
  open: [event: Event]
  /** 收起编辑态：载荷为触发它的原生事件，或程序化关闭时的 `null` */
  close: [event: Event | null]
}>()

const displayRef = ref<HTMLElement | null>(null)

/** 非受控内部状态：`active` 未传时由自身开合 */
const innerActive = ref(false)

const isControlled = computed(() => props.active !== undefined)
const isActive = computed(() => (isControlled.value ? props.active === true : innerActive.value))

const rootClasses = computed(() => ({
  "si-inplace--active": isActive.value,
  "si-inplace--disabled": props.disabled,
}))

const handleOpen = (event: Event) => {
  if (props.disabled || isActive.value) return
  if (!isControlled.value) innerActive.value = true
  emit("open", event)
  emit("update:active", true)
}

/**
 * 关闭并把焦点归还 display。
 * ⚠️ 这里用 `event: Event | null` 承载来源（官方 close 事件在程序化关闭时不带事件），
 *    与库内 `Message.close` 用 `MouseEvent | null` 区分来源的既有做法一致。
 */
const handleClose = (event: Event | null = null) => {
  if (!isActive.value) return
  if (!isControlled.value) innerActive.value = false
  emit("close", event)
  emit("update:active", false)
  // 焦点归还：官方语义（关闭后把焦点放回 display），避免键盘用户丢失位置
  void nextTick(() => displayRef.value?.focus())
}

defineExpose({
  /** 展开编辑态（程序化入口，等价于点击 display） */
  open: () => handleOpen(new Event("open")),
  /** 收起编辑态（程序化入口，用于 content 插槽外的自定义关闭按钮） */
  close: () => handleClose(null),
})
</script>

<style scoped lang="scss">
@use './styles/Inplace.scss';
</style>
