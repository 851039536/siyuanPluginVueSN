<!-- 通用 SVG 图标渲染组件：消除模板内联 <svg><use> 重复模式，支持尺寸与 class 透传 -->
<template>
  <svg
    :width="size"
    :height="size"
    v-bind="$attrs"
  ><use :xlink:href="name"></use></svg>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

withDefaults(
  defineProps<{
    /** Iconify 图标引用（如 "#iconSparkles"） */
    name: string
    /** 图标尺寸（宽高相同），默认 12px */
    size?: number
  }>(),
  { size: 12 },
)
</script>
