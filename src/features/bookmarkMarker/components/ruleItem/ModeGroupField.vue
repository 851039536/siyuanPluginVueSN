<!-- 单选分段组字段：一行标签 + 共享 Button 分组（选中态以主色 text 外观表达） -->
<template>
  <div class="rule-row">
    <Label
      size="small"
      width="70px"
    >{{ label }}</Label>
    <div class="mode-group">
      <Button
        v-for="opt in options"
        :key="opt.value"
        :variant="modelValue === opt.value ? 'primary' : 'ghost'"
        text
        size="xsmall"
        :icon="opt.icon"
        :aria-pressed="modelValue === opt.value"
        @click="$emit('select', opt.value)"
      >
        {{ opt.label }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import Button from "@/components/Button.vue"
import Label from "@/components/Label.vue"

defineProps<{
  /** 行标签文案 */
  label: string
  /** 当前选中值 */
  modelValue: string
  /** 选项表（icon 可选，仅显示模式档位带图标） */
  options: Array<{ value: string, label: string, icon?: IconKey }>
}>()

defineEmits<{
  select: [value: string]
}>()
</script>

<style scoped lang="scss">
@use "../../styles/fieldRow.scss" as *;
@use "../../styles/RuleItemModeGroup.scss" as *;
</style>
