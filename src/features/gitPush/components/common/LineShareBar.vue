<!-- gitPush 行数占比迷你条（轨道 + 填充 + 百分比文本） -->
<template>
  <span class="lsb">
    <span class="lsb-track">
      <span
        class="lsb-fill"
        :style="{ width: pct }"
      />
    </span>
    <span class="lsb-text">{{ share }}</span>
  </span>
</template>

<script setup lang="ts">
// gitPush 行数占比迷你条（详情弹窗文件明细表格占比列等场景）
// 注：原实现按「净增正负」给 fill 着色，但本视图已改为**存量口径**
// （净增 = 存量行数 ≥ 0），于是所有非空文件条恒为绿色 —— 纯噪音。
// 故移除 net 语义，fill 统一用主题主色。
const props = defineProps<{
  /** 条形宽度（相对最大值的百分比，调用方预计算） */
  pct: string
  /** 占比文本（占总和的百分比，调用方预计算） */
  share: string
}>()
void props
</script>

<style lang="scss">
@use "../../styles/LineShareBar.scss";
@use "../../styles/index.scss";
</style>
