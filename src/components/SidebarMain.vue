<!-- 主内容区：与 Sidebar 配对，按侧边栏实际占用宽度自动让位（浮层模式下不让位） -->
<template>
  <main
    class="si-sidebar-main"
    :class="[
      `si-sidebar-main--${size}`,
      {
        'si-sidebar-main--offset': !!context,
        [`si-sidebar-main--offset-${context?.side}`]: !!context,
      },
    ]"
    :style="rootStyle"
  >
    <slot />
  </main>
</template>

<script setup lang="ts">
import type { SidebarSize as SidebarSizeShape } from "./sidebar/types"
import {
  computed,
} from "vue"
import { useSidebarContext } from "./sidebar/context"
import "./kit/theme"

// 公开类型转出（`<script setup>` 不能直接 re-export 导入名）
export type SidebarMainSize = SidebarSizeShape

interface Props {
  /** 尺寸档位：驱动字号 10/12/14/16 与内边距 */
  size?: SidebarSizeShape
  /** 内容四周是否留内边距（默认 `true`；需要内容贴边时关闭） */
  padded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: "small",
  padded: true,
})

/**
 * 侧边栏上下文。
 * ⚠️ 允许为 null —— 本组件也可作为「不与侧边栏联动」的普通主内容容器独立使用
 * （见 sidebar/context.ts 的说明），此时不让位、仅保留基础排版。
 */
const context = useSidebarContext()

/** 让位量取侧边栏的**实际占用宽度**（浮层模式为 0px，故不让位） */
const rootStyle = computed(() => ({
  "--si-main-offset": context?.occupiedWidth ?? "0px",
  padding: props.padded ? undefined : "0",
}))
</script>

<style scoped lang="scss">
@use './styles/SidebarMain.scss';
</style>
