<!-- gitPush 统计视图平台区块（覆盖率汇总条 + 每项目平台配置矩阵合并展示） -->
<template>
  <StatsSection :title="i18n.platformStatus">
    <!-- 覆盖率汇总：四个平台 + 多远程合计（配置驱动渲染条形，hover 显示项目数明细） -->
    <div class="gp-coverage-list">
      <div
        v-for="c in coverageItems"
        :key="c.key"
        class="gp-coverage-item"
        :title="c.counts"
      >
        <div class="gp-coverage-head">
          <Icon
            :icon="c.icon"
            height="12"
          />
          <span>{{ c.label }}</span>
          <span class="gp-coverage-num">{{ c.pct }}</span>
        </div>
        <div class="gp-coverage-bar">
          <div
            class="gp-coverage-fill"
            :class="`gp-coverage-fill--${c.key}`"
            :style="{ width: c.pct }"
          />
        </div>
      </div>
    </div>

    <!-- 每项目平台配置矩阵（单元格图标与 tooltip 经视图模型预计算） -->
    <PlatformTable
      v-if="platformRows.length > 0"
      :i18n="i18n"
      :rows="platformRows"
      @view-project="emit('viewProject', $event)"
    />
  </StatsSection>
</template>

<script setup lang="ts">
// gitPush 统计视图平台区块：把原本「远程覆盖率」与「平台配置状态」两个独立区块合并为一个——
// 二者是同一份 PLATFORM_META 上的两种切面（汇总占比 vs 逐项目明细），分列两个卡片会让同一批数据
// 在屏幕上出现两次标题与两层边框；合并后汇总条在上、明细矩阵在下，读作一个区块。
import type { PlatformTableRowView, StatsView } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { PLATFORM_META, getPlatformStatus } from "../../types"
import { ratioPct } from "../../utils"
import PlatformTable from "./common/PlatformTable.vue"
import StatsSection from "./common/StatsSection.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 remoteCoverage + projectCount + platformStatusProjects） */
  stats: StatsView
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

/** 覆盖率条目：四个平台（PLATFORM_META 投影）+ 多远程合计（预计算占比与计数明细；key 同时作为 gp-coverage-fill 修饰类后缀） */
const coverageItems = computed(() => {
  const total = props.stats.projectCount
  const platformItems = PLATFORM_META.map((pm) => {
    const count = props.stats.remoteCoverage[pm.key]
    return {
      key: pm.key,
      icon: pm.icon,
      label: pm.label,
      count,
      pct: ratioPct(count, total),
      counts: `${count} / ${total}`,
    }
  })
  const multiple = props.stats.remoteCoverage.multiple
  return [
    ...platformItems,
    // 多远程项目条目："多远程项目"
    {
      key: "multi",
      icon: "mdi:layers",
      label: props.i18n.multipleRemotes,
      count: multiple,
      pct: ratioPct(multiple, total),
      counts: `${multiple} / ${total}`,
    },
  ]
})

// 平台状态行视图模型：预计算每格图标与"已配置"/"未配置"提示，避免模板中每行 12 次 getPlatformStatus 调用
const platformRows = computed<PlatformTableRowView[]>(() =>
  props.stats.platformStatusProjects.map((item) => ({
    id: item.project.id,
    name: item.project.name,
    path: item.project.path,
    cells: PLATFORM_META.map((pm) => {
      const ok = getPlatformStatus(item, pm.key)
      return {
        key: pm.key,
        title: ok ? props.i18n.configured : props.i18n.notConfigured,
        icon: ok ? "mdi:check-circle" : "mdi:close-circle-outline",
        iconCls: ok ? "gp-platform-ok" : "gp-platform-missing",
      }
    }),
  })),
)
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
