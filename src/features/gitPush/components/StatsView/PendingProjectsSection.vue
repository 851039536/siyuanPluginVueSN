<!-- gitPush 统计视图待处理项目区块（全站唯一的待处理清单：表格含推送/拉取/变更三组计数 + 远程明细徽章） -->
<template>
  <StatsSection
    :title="i18n.pendingProjects"
    :count="rows.length"
  >
    <!-- 待处理项目表格（骨架走共享 StatsTable，本区块只提供计数列） -->
    <StatsTable
      v-if="rows.length > 0"
      :i18n="i18n"
      :rows="rows"
      @view-project="emit('viewProject', $event)"
    >
      <template #head>
        <span class="gps-table-cell gps-table-cell--num">{{ i18n.needsPushShort }}</span>
        <!-- 表头："待拉取" -->
        <span class="gps-table-cell gps-table-cell--num">{{ i18n.needsPullShort }}</span>
        <!-- 表头三列：已暂存/未暂存/未跟踪（field 同时作为 i18n 键） -->
        <span
          v-for="col in COUNT_COLUMNS"
          :key="col.field"
          class="gps-table-cell gps-table-cell--num"
        >{{ i18n[col.field] }}</span>
      </template>

      <template #row="{ row }">
        <!-- 待推送列：各远程 ahead 计数徽章（hover 显示该远程合计；空则占位符 -） -->
        <span class="gps-table-cell gps-table-cell--num">
          <span
            v-if="row.totalAhead > 0"
            class="gps-badge"
            :title="remoteTitle(row.aheadByRemote, 'ahead')"
          >{{ row.totalAhead }}</span>
          <span
            v-else
            class="gps-cell-empty"
          >-</span>
        </span>
        <!-- 待拉取列：各远程 behind 计数徽章（0 时显示占位符 -） -->
        <span class="gps-table-cell gps-table-cell--num">
          <span
            v-if="row.totalBehind > 0"
            class="gps-badge gps-badge--warn"
            :title="remoteTitle(row.behindByRemote, 'behind')"
          >{{ row.totalBehind }}</span>
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
            v-if="row[col.field] > 0"
            class="gps-badge"
            :class="col.badge"
          >{{ row[col.field] }}</span>
          <span
            v-else
            class="gps-cell-empty"
          >-</span>
        </span>
      </template>
    </StatsTable>
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
// 表格骨架（表头/可点击行/项目名/操作箭头）已收敛至共享 StatsTable，本区块只负责计数列。
import type { StatsView } from "../../types"
import { computed } from "vue"
import { platformLabel } from "../../utils"
import AllClear from "./common/AllClear.vue"
import StatsSection from "./common/StatsSection.vue"
import StatsTable from "./common/StatsTable.vue"

const props = defineProps<{
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

/** 表格行视图：把 PendingProjectItem 的嵌套 project 展平为 StatsTable 需要的 id/name/path，
 * 其余计数字段原样带出（row 插槽按 field 取用）。 */
const rows = computed(() => props.stats.pendingProjects.map((item) => ({
  id: item.project.id,
  name: item.project.name,
  path: item.project.path,
  aheadByRemote: item.aheadByRemote,
  totalAhead: item.totalAhead,
  behindByRemote: item.behindByRemote,
  totalBehind: item.totalBehind,
  staged: item.staged,
  unstaged: item.unstaged,
  untracked: item.untracked,
})))

/** 逐远程明细 tooltip："GitHub ↑3 · Gitee ↑1"（平台名取统一 platformLabel，缺失时回落 key） */
function remoteTitle(byRemote: { key: string, ahead?: number, behind?: number }[], dir: "ahead" | "behind"): string {
  return byRemote
    .map((r) => {
      const arrow = dir === "ahead" ? "↑" : "↓"
      return `${platformLabel(r.key)} ${arrow}${r[dir] ?? 0}`
    })
    .join(" · ")
}
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
