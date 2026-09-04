<!-- gitPush 统计视图平台配置状态区块（每个项目各平台是否已配置的表格） -->
<template>
  <StatsSection
    v-if="stats.platformStatusProjects.length > 0"
    :title="i18n.platformStatus"
    :count="stats.platformStatusProjects.length"
  >
    <!-- 区块标题："平台配置状态" -->
    <!-- 平台矩阵表格（表头与行骨架由共享组件渲染） -->
    <PlatformTable
      :i18n="i18n"
      :rows="platformRows"
      @view-project="emit('viewProject', $event)"
    />
  </StatsSection>
</template>

<script setup lang="ts">
// gitPush 统计视图平台配置状态区块（平台配置表格）
import type { PlatformTableRowView, StatsView } from "../../types"
import { computed } from "vue"
import { PLATFORM_META, getPlatformStatus } from "../../types"
import PlatformTable from "./common/PlatformTable.vue"
import StatsSection from "./common/StatsSection.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 platformStatusProjects） */
  stats: StatsView
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

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
