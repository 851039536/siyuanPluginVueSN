<!-- gitPush 行数占比迷你条（轨道 + 填充 + 百分比文本；fill 随净增正负着色） -->
<template>
  <span class="lsb">
    <span class="lsb-track">
      <span
        class="lsb-fill"
        :class="netClass(net)"
        :style="{ width: pct }"
      />
    </span>
    <span class="lsb-text">{{ share }}</span>
  </span>
</template>

<script setup lang="ts">
// gitPush 行数占比迷你条（详情弹窗文件明细表格占比列等场景）
import { netClass as sharedNetClass } from "../../utils"

const props = defineProps<{
  /** 条形宽度（相对最大值的百分比，withLineBarPct 预计算） */
  pct: string
  /** 占比文本（占总和的百分比，withLineBarPct 预计算） */
  share: string
  /** 净增行数（fill 按正负着色：正绿 / 负红） */
  net: number
}>()

/** 净增语义色（与 LineRankRow 统一前缀 lrr-net） */
function netClass(net: number): string {
  return sharedNetClass(net, "lrr-net")
}
</script>

<style lang="scss">
@use "../../styles/LineShareBar.scss";
@use "../../styles/index.scss";
</style>
