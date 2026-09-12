<!-- MeterGroup 标签列表（私有子部件）：色块/图标 + 「标签 (百分比)」 -->
<template>
  <ol
    class="si-metergroup__label-list"
    :class="listClasses"
  >
    <li
      v-for="(item, index) in value"
      :key="`${index}_label`"
      class="si-metergroup__label"
    >
      <!--
        标记：icon 插槽优先（作用域 { value, class }），其次 item.icon，都没有时退化为纯色块。
        ⚠️ 颜色用内联 style 而非类名 —— 颜色来自数据（每项可不同），无法预生成类。
      -->
      <slot
        name="icon"
        :value="item"
        :class="'si-metergroup__label-icon'"
      >
        <IconWrapper
          v-if="item.icon"
          :name="item.icon"
          :size="12"
          class="si-metergroup__label-icon"
          :style="item.color ? { color: item.color } : undefined"
        />
        <span
          v-else
          class="si-metergroup__label-marker"
          :style="item.color ? { backgroundColor: item.color } : undefined"
        />
      </slot>
      <span class="si-metergroup__label-text">{{ item.label }} ({{ toPercent(item.value, min, max) }}%)</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import type {
  MeterGroupLabelOrientation,
  MeterItem,
} from "./types"
import { computed } from "vue"
import IconWrapper from "../IconWrapper.vue"
import { toPercent } from "./types"

interface Props {
  /** 数据项集合 */
  value: MeterItem[]
  /** 区间下限（换算百分比用） */
  min: number
  /** 区间上限（换算百分比用） */
  max: number
  /** 标签排列方向：`horizontal`（一行）/ `vertical`（一列） */
  labelOrientation: MeterGroupLabelOrientation
}

const props = defineProps<Props>()

const listClasses = computed(() => `si-metergroup__label-list--${props.labelOrientation}`)
</script>

<style scoped lang="scss">
@use '../styles/MeterGroupLabel.scss';
</style>
