<!-- gitPush 统计视图待处理项目区块（全站唯一的待处理清单：表格含推送/拉取/变更三组计数 + 远程明细徽章） -->
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
        <!-- 待推送列：各远程 ahead 计数徽章（hover 显示该远程合计；空则占位符 -） -->
        <span class="gps-table-cell gps-table-cell--num">
          <span
            v-if="item.totalAhead > 0"
            class="gps-badge"
            :title="remoteTitle(item.aheadByRemote, 'ahead')"
          >{{ item.totalAhead }}</span>
          <span
            v-else
            class="gps-cell-empty"
          >-</span>
        </span>
        <!-- 待拉取列：各远程 behind 计数徽章（0 时显示占位符 -） -->
        <span class="gps-table-cell gps-table-cell--num">
          <span
            v-if="item.totalBehind > 0"
            class="gps-badge gps-badge--warn"
            :title="remoteTitle(item.behindByRemote, 'behind')"
          >{{ item.totalBehind }}</span>
          <span
            v-else
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
// 待处理项目区块：全站唯一的待处理清单（原「条形排行 + 明细表格」两份同标题同数据渲染已合并为一份）。
// 计数列展示每组的远程合计（原来每远程一个徽章会把 40px 列宽挤爆），逐远程明细下沉到 tooltip，
// 既保留了「哪个远程落后几笔」的排错信息，又让窄 Dock 下的表格保持可读。
import type { StatsView } from "../../types"
import { Icon } from "@iconify/vue"
import { PLATFORM_META } from "../../types"
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

/** 平台 key → 展示名（PLATFORM_META 是跨模块唯一真源，此处只做一次投影） */
const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORM_META.map((pm) => [pm.key, pm.label]),
)

/** 逐远程明细 tooltip："GitHub ↑3 · Gitee ↑1"（平台名取 PLATFORM_META 标签，缺失时回落到 key） */
function remoteTitle(byRemote: { key: string, ahead?: number, behind?: number }[], dir: "ahead" | "behind"): string {
  return byRemote
    .map((r) => {
      const label = PLATFORM_LABELS[r.key] ?? r.key
      const arrow = dir === "ahead" ? "↑" : "↓"
      return `${label} ${arrow}${r[dir] ?? 0}`
    })
    .join(" · ")
}
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
