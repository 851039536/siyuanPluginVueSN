<!-- 进度条：单值进度指示（确定态定长 + 不定态往复扫过），可选数值标签 -->
<template>
  <div
    class="si-progressbar"
    :class="rootClasses"
  >
    <!-- 轨道：进度语义挂在轨道上（标签是旁注、不属于进度条本体） -->
    <div
      class="si-progressbar__track"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="isIndeterminate ? undefined : clampedValue"
      :aria-valuetext="isIndeterminate ? indeterminateLabel : undefined"
    >
      <!-- 确定态：定长条 -->
      <div
        v-if="!isIndeterminate"
        class="si-progressbar__value"
        :style="{ width: `${clampedValue}%` }"
      />
      <!-- 不定态：宽度固定的色块往复扫过 -->
      <div
        v-else
        class="si-progressbar__value si-progressbar__value--indeterminate"
      />
    </div>

    <!--
      数值标签：**作为轨道的兄弟节点**而非嵌在填充条内。
      ⚠️ 官方把标签放在条内部（跟随条移动），条极短时标签会溢出被裁；
         这里改为右侧旁注（`showValue` 且值非 0 且已提供时才渲染，与官方判据一致），
         无论条多短都稳定可读 —— 属**有意的结构差异**。
    -->
    <div
      v-if="shouldShowLabel"
      class="si-progressbar__label"
    >
      <slot>{{ clampedValue }}%</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import "./kit/theme"

/** 模式：`determinate`（默认，按 value 定长）/ `indeterminate`（进度未知，往复动画） */
type ProgressBarMode = "determinate" | "indeterminate"

/** 尺寸档位（与全库控件阶梯一致；官方无 `size` prop，属本项目按库规范扩展） */
type ProgressBarSize = "xsmall" | "small" | "medium" | "large"

interface Props {
  /** 当前进度（0~100）；超出范围会被**钳制**而非溢出容器 */
  value?: number
  /** 模式：`determinate`（默认）/ `indeterminate`（进度未知，忽略 `value`） */
  mode?: ProgressBarMode
  /** 是否显示数值标签（默认 `true`；值为 0 或未提供时不渲染，对齐官方） */
  showValue?: boolean
  /** 尺寸档位：驱动条高、字号与标签间距 */
  size?: ProgressBarSize
  /** 不定态时的可访问文案（进度未知，`aria-valuenow` 缺省，改用它说明状态） */
  indeterminateLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  value: undefined,
  mode: "determinate",
  showValue: true,
  size: "small",
  indeterminateLabel: "进行中",
})

const isIndeterminate = computed(() => props.mode === "indeterminate")

/**
 * 钳制到 0~100 的整数值：用于宽度与标签。
 * ⚠️ 非有限值（`NaN` / `Infinity`，如来自未防御的除法）判为 0 ——
 *    否则会渲染出 `NaN%` 宽度使整条塌陷成 0 宽。
 */
const clampedValue = computed(() => {
  const value = props.value
  if (value === undefined || !Number.isFinite(value)) return 0
  return Math.round(Math.max(0, Math.min(100, value)))
})

/** 标签渲染判据（对齐官方 `value != null && value !== 0 && showValue`） */
const shouldShowLabel = computed(() =>
  props.showValue && props.value !== undefined && clampedValue.value !== 0,
)

const rootClasses = computed(() => [
  `si-progressbar--${props.size}`,
  {
    "si-progressbar--indeterminate": isIndeterminate.value,
    "si-progressbar--with-label": shouldShowLabel.value,
  },
])
</script>

<style scoped lang="scss">
@use './styles/ProgressBar.scss';
</style>
