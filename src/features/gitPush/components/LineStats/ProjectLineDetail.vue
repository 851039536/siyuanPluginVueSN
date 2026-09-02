<!-- gitPush 项目行数详情弹窗：点击项目行弹出，双 Tab（文件明细表格 + 作者行数排行），数据由 getNumstat 即时聚合 -->
<template>
  <Transition name="gp-dialog-fade">
    <div
      ref="rootRef"
      tabindex="-1"
      class="pld-mask"
      @keydown.escape="emit('close')"
      @click.self="emit('close')"
    >
      <div class="pld-dialog">
        <!-- 弹窗头部：项目名 + 关闭按钮 -->
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
          <!-- 刷新按钮：重抓该项目行数数据（刷新中旋转禁用） -->
          <button
            class="pld-refresh"
            :title="i18n.lineDetailRefreshHint"
            :disabled="refreshing"
            @click="refreshProject(projectId)"
          >
            <Icon
              icon="mdi:refresh"
              :class="{ 'gp-spin': refreshing }"
            />
          </button>
          <button
            class="pld-close"
            :title="i18n.close"
            @click="emit('close')"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>

        <!-- Tab 切换：文件明细 / 作者明细 -->
        <div class="pld-tabs">
          <button
            class="pld-tab"
            :class="{ 'pld-tab--active': activeTab === 'file' }"
            @click="activeTab = 'file'"
          >
            <Icon icon="mdi:file-document-outline" />
            {{ i18n.lineDetailFileTab }}
            <span class="pld-tab-count">{{ fileRows.length }}</span>
          </button>
          <button
            class="pld-tab"
            :class="{ 'pld-tab--active': activeTab === 'author' }"
            @click="activeTab = 'author'"
          >
            <Icon icon="mdi:account-group-outline" />
            {{ i18n.lineDetailAuthorTab }}
            <span class="pld-tab-count">{{ authorRows.length }}</span>
          </button>
        </div>

        <!-- 内容区 -->
        <div class="pld-body">
          <!-- 文件明细 Tab：表头 + 文件行（路径/修改/作者/增删净/占比/总行数） -->
          <template v-if="activeTab === 'file'">
            <EmptyState
              v-if="fileRows.length === 0"
              icon="mdi:file-document-outline"
              :text="i18n.lineDetailFileEmpty"
            />
            <template v-else>
              <!-- 表头 -->
              <div class="pld-table-head">
                <span class="pld-cell pld-cell--rank">#</span>
                <span class="pld-cell pld-cell--file">{{ i18n.lineDetailFileColumn }}</span>
                <span class="pld-cell pld-cell--num">{{ i18n.lineDetailMods }}</span>
                <span class="pld-cell pld-cell--num">{{ i18n.lineDetailAuthors }}</span>
                <span class="pld-cell pld-cell--num">{{ i18n.analysisLineAdded }}</span>
                <span class="pld-cell pld-cell--num">{{ i18n.analysisLineDeleted }}</span>
                <span class="pld-cell pld-cell--net">{{ i18n.analysisLineNet }}</span>
                <!-- 表头列："占比"（净增绝对值占比，tooltip 说明口径） -->
                <span
                  class="pld-cell pld-cell--share"
                  :title="i18n.lineStatsShareHint"
                >{{ i18n.lineDetailShare }}</span>
                <!-- 表头列："总行数"（存量，等宽右对齐，tooltip 说明口径） -->
                <span
                  class="pld-cell pld-cell--total"
                  :title="i18n.lineStatsTotalHint"
                >{{ i18n.analysisLineTotal }}</span>
              </div>
              <!-- 文件行 -->
              <div
                v-for="(row, idx) in fileRows"
                :key="row.path"
                class="pld-file-row"
              >
                <span class="pld-cell pld-cell--rank">{{ idx + 1 }}</span>
                <span
                  class="pld-cell pld-cell--file"
                  :title="`${row.path}\n${i18n.lineDetailModsCount.replace('{0}', String(row.modCount))} · ${i18n.lineDetailAuthorCount.replace('{0}', String(row.authorCount))}`"
                >{{ row.path }}</span>
                <span class="pld-cell pld-cell--num">{{ row.modCount }}</span>
                <span class="pld-cell pld-cell--num">{{ row.authorCount }}</span>
                <span class="pld-cell pld-cell--num pld-num--add">{{ row.added.toLocaleString() }}</span>
                <span class="pld-cell pld-cell--num pld-num--del">{{ row.deleted.toLocaleString() }}</span>
                <span
                  class="pld-cell pld-cell--net"
                  :class="netClass(row.net)"
                >{{ row.net.toLocaleString() }}</span>
                <span class="pld-cell pld-cell--share">
                  <span class="pld-share-track">
                    <span
                      class="pld-share-fill"
                      :class="netClass(row.net)"
                      :style="{ width: row.pct }"
                    />
                  </span>
                  <span class="pld-share-text">{{ row.share }}</span>
                </span>
                <!-- 总行数列：该文件当前存量行数（等宽右对齐中性色；2MB/二进制/已删除或旧数据缺失显示 —） -->
                <span
                  class="pld-cell pld-cell--total"
                  :title="`${i18n.analysisLineTotal} ${row.totalLines?.toLocaleString() ?? '—'}`"
                >{{ row.totalLines?.toLocaleString() ?? "—" }}</span>
              </div>
            </template>
          </template>

          <!-- 作者明细 Tab：与全局作者排行同模式（rank + 作者 + 轨道 + 增删净 + 占比） -->
          <template v-else>
            <EmptyState
              v-if="authorRows.length === 0"
              icon="mdi:account-group-outline"
              :text="i18n.lineDetailAuthorEmpty"
            />
            <div
              v-else
              class="pld-bar-list"
            >
              <div
                v-for="(row, idx) in authorRows"
                :key="row.author"
                class="pld-bar-row"
              >
                <span class="pld-bar-rank">{{ idx + 1 }}</span>
                <span
                  class="pld-bar-label"
                  :title="row.author"
                >{{ row.author }}</span>
                <span class="pld-bar-track">
                  <span
                    class="pld-bar-fill"
                    :class="netClass(row.net)"
                    :style="{ width: row.pct }"
                  />
                </span>
                <span class="pld-line-nums">
                  <span
                    class="pld-line-num pld-num--add"
                    :title="`${i18n.analysisLineAdded} ${row.added}`"
                  >+{{ row.added.toLocaleString() }}</span>
                  <span
                    class="pld-line-num pld-num--del"
                    :title="`${i18n.analysisLineDeleted} ${row.deleted}`"
                  >−{{ row.deleted.toLocaleString() }}</span>
                  <span
                    class="pld-line-num pld-num--net"
                    :class="netClass(row.net)"
                    :title="`${i18n.analysisLineNet} ${row.net}`"
                  >{{ row.net.toLocaleString() }}</span>
                </span>
                <span class="pld-bar-share">{{ row.share }}</span>
              </div>
            </div>
          </template>
        </div>

        <!-- 底部操作栏：关闭 -->
        <div class="pld-footer">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            @click="emit('close')"
          >{{ i18n.close }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { NumstatCommit } from "../../reportMetrics"
import type { FileLineDetailRow } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import { aggregateFileStats, shouldIncludeFile, sumAuthorLines } from "../../reportMetrics"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"
import { netClass as sharedNetClass, withLineBarPct } from "../../utils"
import EmptyState from "../common/EmptyState.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 目标项目 id（按此从 getNumstat 取该项目 numstat） */
  projectId: string
  /** 目标项目名（弹窗标题展示） */
  projectName: string
  /** 当前项目实际总行数（存量，git ls-files 统计；项目已删除或旧缓存缺失时为 undefined） */
  totalLines?: number
  /** 按 projectId 获取该项目原始 numstat（来自 useCommitAnalysis 内存缓存） */
  getNumstat: (projectId: string) => NumstatCommit[]
  /** 按 projectId 获取该项目已跟踪文件的存量行数 Map（来自 useCommitAnalysis 内存缓存，值 null=不可读；未传时文件行总行数列降级 —） */
  getFileLines?: (projectId: string) => Map<string, number | null>
  /** 扩展名排除过滤（与项目排行一致，保证明细与排行口径统一） */
  extensions: string[]
  /** 单项目行数刷新（重抓该项目 numstat + 存量行数，由父级 composable 处理） */
  refreshProject: (projectId: string) => void
  /** 刷新进行中（按钮禁用 + 图标旋转） */
  refreshing: boolean
}>()

const emit = defineEmits<{ close: [] }>()

/** 当前激活 Tab：file=文件明细 / author=作者明细 */
const activeTab = ref<"file" | "author">("file")

/** 该项目的原始 numstat 提交列表（projectId 无数据时为空数组，展示空态） */
const commits = computed(() => props.getNumstat(props.projectId))

/** 该项目已跟踪文件的存量行数 Map（路径→行数|null，null=2MB/二进制/读失败/已删除；未提供 getFileLines 时为空 Map） */
const fileLinesMap = computed(() => props.getFileLines?.(props.projectId) ?? new Map<string, number | null>())

/** 文件明细行：按文件聚合增删行 + 修改次数/参与作者，按净增降序（同净增量再按新增降序，与全局排行同口径）；pct/share 由共享 withLineBarPct 按净增绝对值预计算；totalLines 为该文件存量行数 */
const fileRows = computed<FileLineDetailRow[]>(() => {
  const raw = [...aggregateFileStats(commits.value).entries()]
    .filter(([path]) => shouldIncludeFile(path, props.extensions))
    .map(([path, agg]) => ({
      path,
      added: agg.added,
      deleted: agg.deleted,
      net: agg.added - agg.deleted,
      modCount: agg.modCount,
      authorCount: agg.authors.size,
      totalLines: fileLinesMap.value.get(path) ?? null,
    }))
    .sort((a, b) => b.net - a.net || b.added - a.added)
  return withLineBarPct(raw, (r) => r.net)
})

/** 作者明细行：按作者聚合增删行，按净增降序（与全局作者排行同模式；pct/share 由共享 withLineBarPct 预计算） */
const authorRows = computed(() => {
  const lines = sumAuthorLines(commits.value, props.extensions)
  const raw = [...lines.entries()]
    .filter(([, agg]) => agg.added + agg.deleted > 0)
    .map(([author, agg]) => ({
      author,
      added: agg.added,
      deleted: agg.deleted,
      net: agg.added - agg.deleted,
    }))
    .sort((a, b) => b.net - a.net || b.added - a.added)
  return withLineBarPct(raw, (r) => r.net)
})

/** 净增行语义色（薄委托共享 netClass，前缀 pld-net，保持模板调用点零改动） */
function netClass(net: number): string {
  return sharedNetClass(net, "pld-net")
}

const { rootRef } = useDialogKeyboard()
</script>

<style lang="scss">
@use "../../styles/ProjectLineDetail.scss";
@use "../../styles/index.scss";
</style>
