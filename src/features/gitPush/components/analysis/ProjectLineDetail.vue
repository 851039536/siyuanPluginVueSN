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
          </div>
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
          <!-- 文件明细 Tab：表头 + 文件行（路径/修改/作者/增删净/占比） -->
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
                <span class="pld-cell pld-cell--share">{{ i18n.lineDetailShare }}</span>
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
  /** 按 projectId 获取该项目原始 numstat（来自 useCommitAnalysis 内存缓存） */
  getNumstat: (projectId: string) => NumstatCommit[]
  /** 扩展名排除过滤（与项目排行一致，保证明细与排行口径统一） */
  extensions: string[]
}>()

const emit = defineEmits<{ close: [] }>()

/** 当前激活 Tab：file=文件明细 / author=作者明细 */
const activeTab = ref<"file" | "author">("file")

/** 该项目的原始 numstat 提交列表（projectId 无数据时为空数组，展示空态） */
const commits = computed(() => props.getNumstat(props.projectId))

/** 文件明细行：按文件聚合增删行 + 修改次数/参与作者，按新增行降序（同增量再按净增降序）；占比条形宽度按最大新增行归一 */
const fileRows = computed<FileLineDetailRow[]>(() => {
  const entries = [...aggregateFileStats(commits.value).entries()]
    .filter(([path]) => shouldIncludeFile(path, props.extensions))
  const totalAdded = entries.reduce((s, [, agg]) => s + agg.added, 0)
  const maxAdded = Math.max(...entries.map(([, agg]) => agg.added), 1)
  return entries
    .map(([path, agg]) => ({
      path,
      added: agg.added,
      deleted: agg.deleted,
      net: agg.added - agg.deleted,
      modCount: agg.modCount,
      authorCount: agg.authors.size,
      pct: `${Math.round((agg.added / maxAdded) * 100)}%`,
      share: totalAdded > 0 ? `${((agg.added / totalAdded) * 100).toFixed(1)}%` : "0%",
    }))
    .sort((a, b) => b.added - a.added || b.net - a.net)
})

/** 作者明细行：按作者聚合增删行，按新增行降序（与全局作者排行同模式；pct/share 由共享 withLineBarPct 预计算） */
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
    .sort((a, b) => b.added - a.added || b.net - a.net)
  return withLineBarPct(raw)
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
