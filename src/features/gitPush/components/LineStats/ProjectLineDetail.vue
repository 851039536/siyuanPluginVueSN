<!-- gitPush 项目行数详情弹窗：点击项目行弹出，展示该项目的文件存量行数明细（数据由 getFileLines 提供） -->
<template>
  <Transition name="gp-dialog-fade">
    <!-- 遮罩/层级/基准字号取自共享基座 .gp-mask，本地仅保留弹窗尺寸与进出场缩放 -->
    <div
      ref="rootRef"
      tabindex="-1"
      class="gp-mask"
      @keydown.escape="emit('close')"
      @click.self="emit('close')"
    >
      <div class="pld-dialog">
        <!-- 弹窗头部：项目名 + 刷新 + 关闭 -->
        <div class="pld-header">
          <div class="pld-title-wrap">
            <span class="pld-title">{{ projectName }}</span>
            <span class="pld-title-sub">{{ i18n.lineDetailTitleHint }}</span>
            <!-- 当前总行数 chip："当前总行数" + 存量数值（等宽数字，tooltip 说明口径；旧缓存缺失显示 —） -->
            <span
              class="pld-total"
              :title="i18n.lineStatsTotalHint"
            >
              <span class="pld-total-label">{{ i18n.lineStatsTotalLines }}</span>
              <span class="pld-total-value">{{ totalLines?.toLocaleString() ?? "—" }}</span>
            </span>
          </div>
          <!-- 刷新按钮：重扫该项目存量行数（刷新中转为 loading 占位） -->
          <Button
            icon="refresh"
            size="xsmall"
            variant="ghost"
            :text="true"
            :loading="refreshing"
            :title="i18n.lineDetailRefreshHint"
            @click="refreshProject(projectId)"
          />
          <Button
            icon="close"
            size="xsmall"
            variant="ghost"
            :text="true"
            :title="i18n.close"
            @click="emit('close')"
          />
        </div>

        <!-- 内容区（滚动容器：吸顶表头以本容器为滚动祖先） -->
        <div class="pld-body pld-body--single">
          <EmptyState
            v-if="fileRows.length === 0"
            icon="mdi:file-document-outline"
            :text="i18n.lineDetailFileEmpty"
          />
          <template v-else>
            <!-- 表头：路径 / 行数 / 占比（存量口径，全部来自 getFileLines） -->
            <div class="pld-table-head pld-table-head--simple">
              <span class="pld-cell pld-cell--rank">#</span>
              <span class="pld-cell pld-cell--file">{{ i18n.lineDetailFileColumn }}</span>
              <!-- 表头列："总行数"（该文件当前存量行数，tooltip 说明口径） -->
              <span
                class="pld-cell pld-cell--total"
                :title="i18n.lineStatsTotalHint"
              >{{ i18n.analysisLineTotal }}</span>
              <!-- 表头列："占比"（该文件行数占项目总行数的百分比） -->
              <span
                class="pld-cell pld-cell--share"
                :title="i18n.lineStatsTotalShareHint"
              >{{ i18n.lineDetailShare }}</span>
            </div>
            <!-- 文件行（按存量行数降序；不可读文件行数为 — 并排在末尾） -->
            <div
              v-for="(row, idx) in fileRows"
              :key="row.path"
              class="pld-file-row pld-file-row--simple"
            >
              <span class="pld-cell pld-cell--rank">{{ idx + 1 }}</span>
              <span
                class="pld-cell pld-cell--file"
                :title="row.path"
              >{{ row.path }}</span>
              <span class="pld-cell pld-cell--total">{{ row.totalLines?.toLocaleString() ?? "—" }}</span>
              <span class="pld-cell pld-cell--share">
                <LineShareBar
                  :pct="row.pct"
                  :share="row.share"
                  :net="row.totalLines ?? 0"
                />
              </span>
            </div>
          </template>
        </div>

        <!-- 底部操作栏：关闭 -->
        <div class="pld-footer">
          <Button
            variant="ghost"
            :outlined="true"
            size="small"
            @click="emit('close')"
          >{{ i18n.close }}</Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
// gitPush 项目行数详情弹窗（文件存量行数明细；原「作者明细」Tab 依赖 numstat 增删聚合，已随口径调整移除）
import { computed } from "vue"
import Button from "@/components/Button.vue"
import EmptyState from "../common/EmptyState.vue"
import LineShareBar from "../common/LineShareBar.vue"
import { shouldIncludeFile } from "../../reportMetrics"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"
import { maxOf } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 目标项目 id（按此从 getFileLines 取该项目文件存量） */
  projectId: string
  /** 目标项目名（弹窗标题展示） */
  projectName: string
  /** 当前项目实际总行数（存量；项目已删除或旧缓存缺失时为 undefined） */
  totalLines?: number
  /** 按 projectId 获取该项目已跟踪文件的存量行数 Map（值 null=2MB/二进制/读失败/已删除） */
  getFileLines?: (projectId: string) => Map<string, number | null>
  /** 扩展名排除过滤（与项目排行一致，保证明细与排行口径统一） */
  extensions: string[]
  /** 单项目行数刷新（重扫该项目存量行数，由父级 composable 处理） */
  refreshProject: (projectId: string) => void
  /** 刷新进行中（按钮 loading 占位） */
  refreshing: boolean
}>()

const emit = defineEmits<{ close: [] }>()

/** 文件明细行（已按扩展名过滤 + 按存量行数降序） */
interface FileRow {
  path: string
  /** 该文件存量行数（null = 不可读） */
  totalLines: number | null
  /** 相对最大文件的条形宽度（LineShareBar 填充比例） */
  pct: string
  /** 占项目总行数百分比 */
  share: string
}

/**
 * 文件明细行：直接由存量行数 Map 派生（不再需要 numstat 聚合）。
 *
 * 排序把不可读文件（null）排到末尾：它们既无行数也无占比，
 * 混在降序序列中会让「前 N 个最大文件」失真。
 */
const fileRows = computed<FileRow[]>(() => {
  const map = props.getFileLines?.(props.projectId) ?? new Map<string, number | null>()
  const entries = [...map.entries()].filter(([path]) => shouldIncludeFile(path, props.extensions))
  const maxLines = maxOf(entries.map(([, n]) => n ?? 0), 1)
  const totalLines = entries.reduce((s, [, n]) => s + (n ?? 0), 0) || 1
  return entries
    .map(([path, totalLinesForFile]) => ({
      path,
      totalLines: totalLinesForFile,
      pct: `${Math.round(((totalLinesForFile ?? 0) / maxLines) * 100)}%`,
      share: `${((((totalLinesForFile ?? 0) / totalLines) * 100)).toFixed(1)}%`,
    }))
    .sort((a, b) => (b.totalLines ?? -1) - (a.totalLines ?? -1) || a.path.localeCompare(b.path))
})

// ⚠️ `rootRef` 必须保留为本地绑定：模板 `ref="rootRef"` 依赖它把根节点交给 composable 聚焦。
// TS 看不到「模板里的使用」，故以 void 显式消费，避免 noUnusedLocals 误判（下同各弹窗）。
const { rootRef } = useDialogKeyboard()
void rootRef
</script>

<style lang="scss">
@use "../../styles/ProjectLineDetail.scss";
@use "../../styles/LineShareBar.scss";
@use "../../styles/index.scss";
</style>
