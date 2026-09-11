<!-- gitPush 行数排行行（排名/名称/条形/增删净/占比/可选总行数；clickable 时根为原生 button 可键盘激活） -->
<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="lrr-row"
    :class="rowClasses"
    :title="clickable ? i18n.lineDetailClickHint : undefined"
    @click="onClick"
  >
    <!-- 排名序号 -->
    <span class="lrr-rank">{{ rank }}</span>
    <!-- 名称：完整内容走行内 title -->
    <span
      class="lrr-label"
      :title="label"
    >{{ label }}</span>
    <!-- 条形轨道：宽度按 pct；fill 默认主题色，barNetColored 时随净增正负着色 -->
    <span class="lrr-track">
      <span
        class="lrr-fill"
        :class="barNetColored ? netClass(net) : undefined"
        :style="{ width: pct }"
      />
    </span>
    <!-- 数字列：+新增 / −删除 / 净增（千位分隔，正绿负红） -->
    <span class="lrr-nums">
      <span
        class="lrr-num lrr-num--add"
        :title="`${i18n.analysisLineAdded} ${added}`"
      >+{{ added.toLocaleString() }}</span>
      <span
        class="lrr-num lrr-num--del"
        :title="`${i18n.analysisLineDeleted} ${deleted}`"
      >−{{ deleted.toLocaleString() }}</span>
      <span
        class="lrr-num lrr-num--net"
        :class="netClass(net)"
        :title="`${i18n.analysisLineNet} ${net}`"
      >{{ net.toLocaleString() }}</span>
    </span>
    <!-- 占比列 -->
    <span class="lrr-share">{{ share }}</span>
    <!-- 总行数列（存量口径；undefined = 不渲染该列（作者明细场景），null = 旧缓存缺失显示 —） -->
    <span
      v-if="totalLines !== undefined"
      class="lrr-total"
    >{{ totalLines?.toLocaleString() ?? "—" }}</span>
  </component>
</template>

<script setup lang="ts">
// gitPush 行数排行行（项目排行 + 详情弹窗作者排行共用；列模板与表头共用见 styles/LineRankRow.scss）
import { computed } from "vue"
import { netClass as sharedNetClass } from "../../utils"

const props = withDefaults(defineProps<{
  /** 排名序号（从 1 开始，由调用方传入） */
  rank: number
  /** 名称（项目名 / 作者名，完整内容走 title） */
  label: string
  /** 条形宽度（相对最大值的百分比，withLineBarPct 预计算） */
  pct: string
  /** 占比文本（占总和的百分比，withLineBarPct 预计算） */
  share: string
  /** 新增行数 */
  added: number
  /** 删除行数 */
  deleted: number
  /** 净增行数（数字列与可选 fill 着色共用） */
  net: number
  /** 总行数（存量口径；undefined = 不渲染该列（作者明细场景），null = 旧缓存缺失显示 —） */
  totalLines?: number | null
  /** 可点击（根元素渲染原生 button，Tab 聚焦 + Enter/Space 激活并 emit select） */
  clickable?: boolean
  /** 条形 fill 是否随净增正负着色（作者排行/占比语义用；项目排行按存量口径恒主题色） */
  barNetColored?: boolean
  /** i18n 文案表（仅用于列 tooltip，零 i18n 分片改动） */
  i18n: Record<string, any>
}>(), {
  clickable: false,
  barNetColored: false,
})

const emit = defineEmits<{
  select: []
}>()

/** 净增语义色（统一前缀 lrr-net，与样式文件单点对应） */
function netClass(net: number): string {
  return sharedNetClass(net, "lrr-net")
}

const rowClasses = computed(() => ({
  "lrr-row--clickable": props.clickable,
  "lrr-row--no-total": props.totalLines === undefined,
}))

function onClick() {
  if (props.clickable) emit("select")
}
</script>

<style lang="scss">
@use "../../styles/LineRankRow.scss";
@use "../../styles/index.scss";
</style>
