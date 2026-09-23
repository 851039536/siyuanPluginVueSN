<!-- gitPush 统计视图待处理项目区块（待处理表格；推送状态概要 chips 已上移至总览区，与汇总卡并列） -->
<template>
  <StatsSection
    :title="i18n.pendingProjects"
    :count="stats.pendingProjects.length"
  >
    <!-- 待处理项目表格 -->
    <div
      v-if="stats.pendingProjects.length > 0"
      class="gps-table-wrap"
    >
      <div class="gps-table-row gps-table-row--head">
        <span class="gps-table-cell gps-table-cell--name">{{ i18n.projectName }}</span>
        <span class="gps-table-cell gps-table-cell--num">{{ i18n.needsPushShort }}</span>
        <!-- 表头："待拉取" -->
        <span class="gps-table-cell gps-table-cell--num">{{ i18n.needsPullShort }}</span>
        <!-- 表头三列：已暂存/未暂存/未跟踪（field 同时作为 i18n 键） -->
        <span
          v-for="col in COUNT_COLUMNS"
          :key="col.field"
          class="gps-table-cell gps-table-cell--num"
        >{{ i18n[col.field] }}</span>
        <span class="gps-table-cell gps-table-cell--act"></span>
      </div>
      <div
        v-for="item in stats.pendingProjects"
        :key="item.project.id"
        class="gps-table-row gps-table-row--clickable"
        @click="emit('viewProject', item.project.id)"
      >
        <span
          class="gps-table-cell gps-table-cell--name"
          :title="item.project.path"
        >
          {{ item.project.name }}
        </span>
        <span class="gps-table-cell gps-table-cell--num">
          <span
            v-for="r in item.aheadByRemote"
            :key="r.key"
            class="gps-badge"
          >↑{{ r.ahead }}</span>
          <span
            v-if="item.aheadByRemote.length === 0"
            class="gps-cell-empty"
          >-</span>
        </span>
        <!-- 待拉取列：各远程落后提交数徽章（0 时显示占位符 -） -->
        <span class="gps-table-cell gps-table-cell--num">
          <span
            v-for="r in item.behindByRemote"
            :key="r.key"
            class="gps-badge gps-badge--warn"
          >↓{{ r.behind }}</span>
          <span
            v-if="item.behindByRemote.length === 0"
            class="gps-cell-empty"
          >-</span>
        </span>
        <!-- 已暂存/未暂存/未跟踪三列计数徽章（列配置驱动，0 时显示占位符 -） -->
        <span
          v-for="col in COUNT_COLUMNS"
          :key="col.field"
          class="gps-table-cell gps-table-cell--num"
        >
          <span
            v-if="item[col.field] > 0"
            class="gps-badge"
            :class="col.badge"
          >{{ item[col.field] }}</span>
          <span
            v-else
            class="gps-cell-empty"
          >-</span>
        </span>
        <span class="gps-table-cell gps-table-cell--act">
          <Icon
            icon="mdi:arrow-right"
            height="12"
          />
        </span>
      </div>
    </div>
    <!-- 空态："所有项目状态正常" -->
    <AllClear
      v-else
      :text="i18n.allClear"
    />
  </StatsSection>
</template>

<script setup lang="ts">
// gitPush 统计视图待处理项目区块（待处理表格）
import type { StatsView } from "../../types"
import { Icon } from "@iconify/vue"
import AllClear from "./common/AllClear.vue"
import StatsSection from "./common/StatsSection.vue"

defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 pendingProjects） */
  stats: StatsView
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

// 变更计数列配置：已暂存/未暂存/未跟踪（field 同时作为表头 i18n 键；badge 为语义色修饰类后缀）
const COUNT_COLUMNS = [
  { field: "staged", badge: "" },
  { field: "unstaged", badge: "gps-badge--warn" },
  { field: "untracked", badge: "gps-badge--untracked" },
] as const
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
