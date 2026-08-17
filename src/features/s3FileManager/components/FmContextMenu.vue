<!-- 右键菜单 — fixed 定位浮层，按选中态动态生成菜单项，点击外部/Esc 关闭 -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fm-context-menu-mask"
      @click="$emit('close')"
      @contextmenu.prevent="$emit('close')"
    >
      <div
        class="fm-context-menu"
        :style="menuStyle"
        @click.stop
      >
        <button
          v-for="item in items"
          :key="item.action"
          class="fm-context-menu-item"
          :class="{ danger: item.danger }"
          @click="onItemClick(item.action)"
        >
          <IconWrapper
            :name="item.icon"
            :size="13"
          />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import type { IconKey } from "@/config/icons"
import IconWrapper from "@/components/IconWrapper.vue"
import { useEscClose } from "../composables/useEscClose"

/** 菜单项：动作标识 + 文案 + 图标 + 是否危险色 */
export interface FmMenuItem {
  action: string
  label: string
  icon: IconKey
  danger?: boolean
}

interface Props {
  visible: boolean
  x: number
  y: number
  items: FmMenuItem[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  select: [action: string]
}>()

// Esc 关闭菜单（组件常驻挂载，按可见性守卫）
useEscClose(() => emit("close"), () => props.visible)

const menuRef = ref<HTMLElement | null>(null)
const menuSize = ref({ width: 160, height: 0 })

// 可见时等待 DOM 渲染后测量真实尺寸，避免右下角菜单溢出视口
watch(
  () => props.visible,
  async (visible) => {
    if (!visible) { return }
    await nextTick()
    const el = menuRef.value
    if (el) {
      menuSize.value = { width: el.offsetWidth, height: el.offsetHeight }
    }
  },
)

// 定位：限制在视口内，避免右下角溢出（未测量时用兜底尺寸）
const menuStyle = computed(() => {
  const maxX = window.innerWidth - menuSize.value.width - 10
  const maxY = window.innerHeight - menuSize.value.height - 8
  return {
    left: `${Math.min(props.x, maxX)}px`,
    top: `${Math.min(props.y, Math.max(8, maxY))}px`,
  }
})

function onItemClick(action: string): void {
  emit("select", action)
  emit("close")
}
</script>

<style scoped lang="scss">
@use "../styles/FmContextMenu.scss";
@use "../styles/index.scss";
</style>
