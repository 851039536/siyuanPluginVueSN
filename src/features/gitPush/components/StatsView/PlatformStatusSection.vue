<!-- gitPush 统计视图平台配置状态区块（每个项目各平台是否已配置的表格） -->
<template>
  <div
    v-if="stats.platformStatusProjects.length > 0"
    class="gp-stats-section"
  >
    <div class="gp-stats-section-title">
      <!-- 区块标题："平台配置状态" -->
      {{ i18n.platformStatus }}
      <span class="gp-stats-section-count">{{ stats.platformStatusProjects.length }}</span>
    </div>
    <div class="gp-table-wrap">
      <!-- 平台表头结构与 RepoLinkAuditSection 重复（第 2 次出现，Rule of Three 暂不提取共享组件） -->
      <div class="gp-table-row gp-table-row--head">
        <span class="gp-table-cell gp-table-cell--name">{{ i18n.projectName }}</span>
        <span
          v-for="pm in PLATFORM_META"
          :key="pm.key"
          class="gp-table-cell gp-table-cell--platform-status"
          :title="pm.label"
        >
          <Icon
            :icon="pm.icon"
            height="12"
          />
        </span>
        <span class="gp-table-cell gp-table-cell--act"></span>
      </div>
      <div
        v-for="row in platformRows"
        :key="row.id"
        class="gp-table-row gp-table-row--clickable"
        @click="emit('viewProject', row.id)"
      >
        <span
          class="gp-table-cell gp-table-cell--name"
          :title="row.path"
        >
          {{ row.name }}
        </span>
        <!-- 悬停提示："已配置"/"未配置"（行视图模型预计算，避免每格 3 次函数调用） -->
        <span
          v-for="cell in row.cells"
          :key="cell.key"
          class="gp-table-cell gp-table-cell--platform-status"
          :title="cell.ok ? i18n.configured : i18n.notConfigured"
        >
          <!-- 已配置/未配置状态图标（单节点三元切换） -->
          <Icon
            :icon="cell.ok ? 'mdi:check-circle' : 'mdi:close-circle-outline'"
            height="12"
            :class="cell.ok ? 'gp-platform-ok' : 'gp-platform-missing'"
          />
        </span>
        <span class="gp-table-cell gp-table-cell--act">
          <Icon
            icon="mdi:arrow-right"
            height="12"
          />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 统计视图平台配置状态区块（平台配置表格）
import type { StatsView } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { PLATFORM_META, getPlatformStatus } from "../../types"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 platformStatusProjects） */
  stats: StatsView
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

// 平台状态行视图模型：预计算每格配置状态，避免模板中每行 12 次 getPlatformStatus 调用
const platformRows = computed(() =>
  props.stats.platformStatusProjects.map((item) => ({
    id: item.project.id,
    name: item.project.name,
    path: item.project.path,
    cells: PLATFORM_META.map((pm) => ({ key: pm.key, ok: getPlatformStatus(item, pm.key) })),
  })),
)
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
