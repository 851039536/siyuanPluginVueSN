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
import { computed } from "vue"
import type { IconKey } from "@/config/icons"
import IconWrapper from "@/components/IconWrapper.vue"

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

// 定位：限制在视口内，避免右下角溢出（菜单预估宽 180 / 每项高 30）
const menuStyle = computed(() => {
  const maxX = window.innerWidth - 190
  const maxY = window.innerHeight - (props.items.length * 32 + 12)
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
