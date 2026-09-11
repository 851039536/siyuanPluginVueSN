<!-- 面板：可折叠的内容容器，头部支持文本/插槽与操作区，折叠用 v-show 保留内容 DOM -->
<template>
  <div :class="rootClasses">
    <!-- 头部：有标题、操作区或开启折叠时渲染 -->
    <div
      v-if="header || $slots.header || $slots.icons || toggleable"
      class="si-panel__header"
    >
      <div
        :id="titleId"
        class="si-panel__title"
      >
        <slot
          name="header"
          :collapsed="isCollapsed"
        >{{ header }}</slot>
      </div>

      <div class="si-panel__header-actions">
        <slot name="icons" />

        <template v-if="toggleable">
          <slot
            name="togglebutton"
            :collapsed="isCollapsed"
            :toggle-callback="toggle"
            :keydown-callback="handleToggleKeydown"
          >
            <!-- 自定义图标时走默认插槽分支；纯图标时不能传默认插槽（会让 Button 的 icon-only 判定失效） -->
            <Button
              v-if="$slots.toggleicon"
              variant="ghost"
              text
              rounded
              :aria-label="toggleLabel"
              :aria-expanded="!isCollapsed"
              :aria-controls="contentId"
              @click="toggle"
            >
              <slot
                name="toggleicon"
                :collapsed="isCollapsed"
              />
            </Button>
            <Button
              v-else
              class="si-panel__toggler"
              variant="ghost"
              text
              rounded
              icon="chevronDown"
              :aria-label="toggleLabel"
              :aria-expanded="!isCollapsed"
              :aria-controls="contentId"
              @click="toggle"
            />
          </slot>
        </template>
      </div>
    </div>

    <!-- 内容：未开启 toggleable 时忽略 collapsed，避免出现「没有切换按钮却已收起」的死锁 -->
    <div
      v-show="!toggleable || !isCollapsed"
      :id="contentId"
      class="si-panel__content"
      role="region"
      :aria-labelledby="header || $slots.header ? titleId : undefined"
    >
      <slot />
    </div>

    <div
      v-if="$slots.footer"
      class="si-panel__footer"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  useId,
} from "vue"
import Button from "./Button.vue"
import "./kit/theme"

/** toggle 事件载荷（与官方 PanelToggleEvent 同形） */
interface PanelToggleEventShape {
  /** 触发切换的原生事件 */
  originalEvent: Event
  /** 切换后的折叠状态 */
  value: boolean
}

export type PanelToggleEvent = PanelToggleEventShape

interface Props {
  /** 面板头部文本（也可用 header 插槽整体替换） */
  header?: string
  /** 内容是否可展开 / 折叠 */
  toggleable?: boolean
  /**
   * 折叠状态：**不传时组件内部自持**（非受控，可独立开合），传入即受控（配合 `v-model:collapsed`）。
   * 刻意不给默认值 —— 用 `undefined` 判定是否受控。
   */
  collapsed?: boolean
  /** 切换按钮的无障碍名称（默认中文，可覆盖为调用方 i18n 文案） */
  toggleLabel?: string
}

interface Emits {
  (e: "update:collapsed", value: boolean): void
  (e: "toggle", event: PanelToggleEventShape): void
}

const props = withDefaults(defineProps<Props>(), {
  toggleable: false,
  toggleLabel: "展开/收起",
})

const emit = defineEmits<Emits>()

const uid = useId()
/** 标题元素 id（内容区的 aria-labelledby 指向它） */
const titleId = `${uid}-title`
/** 内容元素 id（切换按钮的 aria-controls 指向它） */
const contentId = `${uid}-content`

/** 内部兜底状态：仅在非受控（未传 collapsed）时使用 */
const innerCollapsed = ref(false)

/** 折叠状态：受控取 props，非受控取内部状态（沿用 SpeedDial visible 的双模式范式） */
const isCollapsed = computed(() => props.collapsed ?? innerCollapsed.value)

const toggle = (event: Event) => {
  const next = !isCollapsed.value
  if (props.collapsed === undefined) {
    innerCollapsed.value = next
  }
  emit("update:collapsed", next)
  emit("toggle", {
    originalEvent: event,
    value: next,
  })
}

/**
 * 键盘触发：供 `togglebutton` 插槽内的**非 button** 元素使用。
 * 原生 button（含内置的共享 Button）只绑 `toggleCallback` 即可，否则会双触发。
 */
const handleToggleKeydown = (event: Event) => {
  const key = (event as KeyboardEvent).key
  if (key === "Enter" || key === " ") {
    event.preventDefault()
    toggle(event)
  }
}

const rootClasses = computed(() => [
  "si-panel",
  {
    "si-panel--toggleable": props.toggleable,
    "si-panel--collapsed": props.toggleable && isCollapsed.value,
  },
])
</script>

<style scoped lang="scss">
@use './styles/Panel.scss';
</style>
