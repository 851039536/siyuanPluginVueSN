<!-- 多段进度条：把一组数值按区间换算为百分比并排成一条（可选标签列表，横向/纵向） -->
<template>
  <div
    class="si-metergroup"
    :class="rootClasses"
    role="meter"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="totalPercent"
  >
    <!-- 标签在 start 侧：label → start → 条 → end -->
    <template v-if="labelPosition === 'start'">
      <slot
        name="label"
        :value="value"
        :total-percent="totalPercent"
        :percentages="percentages"
      >
        <MeterGroupLabel
          :value="value"
          :min="min"
          :max="max"
          :label-orientation="labelOrientation"
        />
      </slot>
    </template>

    <slot
      name="start"
      :value="value"
      :total-percent="totalPercent"
      :percentages="percentages"
    />

    <!-- 条本体：每项一段，宽度/高度为各自的区间百分比 -->
    <div class="si-metergroup__meters">
      <template
        v-for="(item, index) in value"
        :key="index"
      >
        <slot
          name="meter"
          :value="item"
          :index="index"
          :orientation="orientation"
          :size="`${toPercent(item.value, min, max)}%`"
          :total-percent="totalPercent"
        >
          <!-- 百分比为 0 的段不渲染（否则会留下 0 宽/高的空 div，且影响 flex 间隙） -->
          <span
            v-if="toPercent(item.value, min, max) > 0"
            class="si-metergroup__meter"
            :style="meterStyle(item)"
          />
        </slot>
      </template>
    </div>

    <slot
      name="end"
      :value="value"
      :total-percent="totalPercent"
      :percentages="percentages"
    />

    <!-- 标签在 end 侧（默认） -->
    <template v-if="labelPosition === 'end'">
      <slot
        name="label"
        :value="value"
        :total-percent="totalPercent"
        :percentages="percentages"
      >
        <MeterGroupLabel
          :value="value"
          :min="min"
          :max="max"
          :label-orientation="labelOrientation"
        />
      </slot>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  MeterGroupLabelOrientation,
  MeterGroupLabelPosition,
  MeterGroupOrientation,
  MeterItem,
} from "./metergroup/types"
import { computed } from "vue"
import "./kit/theme"
import MeterGroupLabel from "./metergroup/MeterGroupLabel.vue"
import {
  toCumulativePercents,
  toPercent,
  toTotalPercent,
} from "./metergroup/types"

// 公开类型转出（沿用 Tooltip / Dialog 的别名转出写法：`<script setup>` 不能直接 re-export 导入名）
export type MeterItemPublic = MeterItem
export type MeterGroupOrientationPublic = MeterGroupOrientation
export type MeterGroupLabelPositionPublic = MeterGroupLabelPosition
export type MeterGroupLabelOrientationPublic = MeterGroupLabelOrientation

interface Props {
  /**
   * 数据项集合（每项 `{ label, value, color?, icon? }`）。
   * 各段的长度 = `(value - min) / (max - min)`，即**每项各自映射到整个区间**，
   * 而非「各项之和占区间」—— 与官方一致（典型用法是各项之和等于 `max`）。
   */
  value?: MeterItem[]
  /** 区间下限（默认 0） */
  min?: number
  /** 区间上限（默认 100） */
  max?: number
  /** 布局方向：`horizontal`（默认，条从左往右）/ `vertical`（条从下往上） */
  orientation?: MeterGroupOrientation
  /** 标签位置：`start`（条之前）/ `end`（默认，条之后） */
  labelPosition?: MeterGroupLabelPosition
  /** 标签排列方向：`horizontal`（默认，一行）/ `vertical`（一列） */
  labelOrientation?: MeterGroupLabelOrientation
}

const props = withDefaults(defineProps<Props>(), {
  value: () => [],
  min: 0,
  max: 100,
  orientation: "horizontal",
  labelPosition: "end",
  labelOrientation: "horizontal",
})

const rootClasses = computed(() => [
  `si-metergroup--${props.orientation}`,
  `si-metergroup--label-${props.labelPosition}`,
  `si-metergroup--label-${props.labelOrientation}`,
])

/** 总值百分比（根的 `aria-valuenow`） */
const totalPercent = computed(() => toTotalPercent(props.value, props.min, props.max))

/** 各项累计百分比（插槽作用域参数，供自定义标签展示累计进度） */
const percentages = computed(() => toCumulativePercents(props.value, props.min, props.max))

/** 单段的样式：颜色 + 主轴方向的百分比尺寸（交叉轴恒铺满） */
const meterStyle = (item: MeterItem) => {
  const size = `${toPercent(item.value, props.min, props.max)}%`
  return {
    backgroundColor: item.color,
    width: props.orientation === "horizontal" ? size : undefined,
    height: props.orientation === "vertical" ? size : undefined,
  }
}
</script>

<style scoped lang="scss">
@use './styles/MeterGroup.scss';
</style>
