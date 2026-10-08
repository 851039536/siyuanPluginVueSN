<!-- gitPush 统计视图表格骨架（吸顶表头 + 可点击行 + 项目名单元格 + 尾部操作箭头，两个区块共用） -->
<template>
  <div class="gps-table-wrap">
    <!-- 表头行：项目名列始终在首位，其后为调用方自定义列，末位预留操作列 -->
    <div class="gps-table-row gps-table-row--head">
      <span class="gps-table-cell gps-table-cell--name">{{ i18n.projectName }}</span>
      <slot name="head" />
      <span class="gps-table-cell gps-table-cell--act"></span>
    </div>
    <!-- 数据行：整行点击跳转项目详情；项目名与操作箭头由本组件统一渲染，中间列由调用方填充 -->
    <div
      v-for="row in rows"
      :key="row.id"
      class="gps-table-row gps-table-row--clickable"
      @click="emit('viewProject', row.id)"
    >
      <span
        class="gps-table-cell gps-table-cell--name"
        :title="row.path"
      >
        {{ row.name }}
        <span
          v-if="row.nameSuffix"
          class="gps-error-text"
        >{{ row.nameSuffix }}</span>
      </span>
      <slot
        name="row"
        :row="row"
      />
      <span class="gps-table-cell gps-table-cell--act">
        <Icon
          icon="mdi:arrow-right"
          height="12"
        />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends StatsTableRow">
// 统计视图表格骨架：收敛「待处理项目」与「平台矩阵」两份逐字相同的表格 markup
// （表头 / 可点击行 / 项目名 title=path / 尾部 mdi:arrow-right 操作箭头）。
// 差异部分（计数列 vs 平台状态列）由 head / row 两个插槽注入，样式仍共用 .gps-table-*。
//
// 泛型 `<T extends StatsTableRow>`：row 插槽把调用方传入的完整行类型透出，
// 使插槽内可用 totalAhead / cells 等派生字段（非泛型时会被拓宽为基类型而报 TS2339）。
import { Icon } from "@iconify/vue"

/** 行最小形状：本组件只负责 id/name/path 与可选错误后缀，其余列由调用方经 row 插槽渲染 */
export interface StatsTableRow {
  id: string
  name: string
  path: string
  /** 名称后缀标注（如审计「路径无效或检测失败」；空串不渲染） */
  nameSuffix?: string
}

defineProps<{
  i18n: Record<string, any>
  /** 行集合（须含 id/name/path） */
  rows: T[]
}>()

const emit = defineEmits<{ viewProject: [projectId: string] }>()
</script>

<style lang="scss">
@use "../../../styles/StatsPanel.scss";
@use "../../../styles/index.scss";
</style>
