<!-- 输入框组合器容器：将 Input / Select / DatePicker / Button / InputGroupAddon 无缝拼接为一体化控件。
     使用约束：组内成员不得带 label / hint / error（FormField 会撑高错位）；容器禁设 overflow:hidden，否则 Select 下拉被裁剪。 -->
<template>
  <div :class="groupClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

type InputGroupSize = "xsmall" | "small" | "medium" | "large"

interface Props {
  /** 尺寸档位：驱动附加项的内边距 / 字号 / 最小高度，需与组内成员的 size 保持一致 */
  size?: InputGroupSize
}

const props = withDefaults(defineProps<Props>(), {
  size: "small",
})

const groupClasses = computed(() => [
  "si-input-group",
  `si-input-group--${props.size}`,
])
</script>

<style scoped lang="scss">
@use './styles/InputGroup.scss';
</style>
