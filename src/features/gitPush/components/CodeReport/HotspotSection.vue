<!-- gitPush 代码统计报告：代码热点分区（第一行热点表格 + 第二行统计摘要） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："代码热点分析" + 文件数徽章（悬浮说明统计口径） -->
    <div class="gpr-section-title">
      {{ i18n.reportHeatTitle }}
      <!-- 文件数徽章 -->
      <span
        class="gpr-section-count"
        :title="i18n.reportAnalyzedFilesTip"
      >{{ report.analyzedFiles }}</span>
    </div>

    <!-- 空状态：范围内无文件 -->
    <EmptyState
      v-if="report.hotspots.length === 0"
      icon="mdi:fire"
      :text="i18n.reportNoData"
    />

    <!-- 纵向两行布局：第一行热点表格（全宽），第二行热度分布汇总 + 优化建议 -->
    <div
      v-else
      class="gpr-hot-grid"
    >
      <!-- 第一行：热点表格 + 截断提示 -->
      <div class="gpr-hot-main">
        <table class="gpr-hot-table">
          <thead>
            <tr>
              <th class="gpr-hot-th gpr-hot-th--level">{{ i18n.reportLevelCol }}</th>
              <th class="gpr-hot-th gpr-hot-th--path">{{ i18n.reportFilePathCol }}</th>
              <th class="gpr-hot-th gpr-hot-th--num">{{ i18n.reportModsCol }}</th>
              <th class="gpr-hot-th gpr-hot-th--num">{{ i18n.reportAuthorsCol }}</th>
              <th class="gpr-hot-th gpr-hot-th--num">{{ i18n.reportLinesCol }}</th>
              <th class="gpr-hot-th gpr-hot-th--time">{{ i18n.reportLastModifiedCol }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="h in preparedHotspots"
              :key="h.path"
              class="gpr-hot-row"
            >
              <!-- 热度徽章 -->
              <td class="gpr-hot-cell gpr-hot-cell--level">
                <span
                  class="gpr-heat-chip"
                  :class="`gpr-heat-chip--${h.level}`"
                  :title="i18n[HOTSPOT_LEVEL_META[h.level].labelKey]"
                >{{ h.heat }}</span>
              </td>
              <!-- 文件路径（可点击打开文件管理器） -->
              <td class="gpr-hot-cell gpr-hot-cell--path">
                <span
                  class="gpr-hot-path"
                  :title="i18n.reportOpenFileTitle.replace('{0}', h.path)"
                  role="button"
                  tabindex="0"
                  @click="openFile(h.path)"
                  @keydown.enter="openFile(h.path)"
                  @keydown.space.prevent="openFile(h.path)"
                >
                  <span class="gpr-path-dir">{{ h.dir }}</span>
                  <span class="gpr-path-base">{{ h.base }}</span>
                </span>
              </td>
              <!-- 修改次数 -->
              <td class="gpr-hot-cell gpr-hot-cell--num">{{ h.modCount }}</td>
              <!-- 参与人数 -->
              <td class="gpr-hot-cell gpr-hot-cell--num">{{ h.authorCount }}</td>
              <!-- 代码行数 -->
              <td class="gpr-hot-cell gpr-hot-cell--num">{{ h.loc ?? "-" }}</td>
              <!-- 最后修改时间（相对时间预计算，完整 ISO 悬停可见） -->
              <td
                class="gpr-hot-cell gpr-hot-cell--time"
                :title="h.lastModified"
              >{{ h.lastModifiedText }}</td>
            </tr>
          </tbody>
        </table>

        <!-- 截断提示 -->
        <div
          v-if="truncatedText"
          class="gpr-hot-truncated"
        >
          <Icon
            icon="mdi:information-outline"
            height="12"
          />
          <span>{{ truncatedText }}</span>
        </div>
      </div>

      <!-- 第二行：统计摘要面板（全宽，汇总表 + 优化建议） -->
      <div class="gpr-hot-summary">
        <!-- 热度分布汇总表 -->
        <div class="gpr-subsection">
          <div class="gpr-section-title">
            {{ i18n.reportHeatSummaryTitle }}
          </div>
          <div class="gpr-table-wrap">
            <!-- 表头：类别 / 文件数 / 占比 -->
            <div class="gpr-row gpr-row--head">
              <span class="gpr-cell gpr-cell--name">{{ i18n.reportCategoryCol }}</span>
              <span class="gpr-cell gpr-cell--num">{{ i18n.reportFilesCol }}</span>
              <span class="gpr-cell gpr-cell--pct">{{ i18n.reportPctCol }}</span>
            </div>
            <!-- 表体：四类热度等级行 -->
            <div
              v-for="s in report.hotspotSummary"
              :key="s.level"
              class="gpr-row"
            >
              <span class="gpr-cell gpr-cell--name">
                <span
                  class="gpr-heat-dot"
                  :style="{ background: HOTSPOT_LEVEL_META[s.level].color }"
                />
                {{ i18n[HOTSPOT_LEVEL_META[s.level].labelKey] }}
              </span>
              <span class="gpr-cell gpr-cell--num">{{ s.count }}</span>
              <span class="gpr-cell gpr-cell--pct">{{ s.pct }}%</span>
            </div>
          </div>
        </div>

        <!-- 优化建议 -->
        <div
          v-if="report.suggestionKey"
          class="gpr-suggestion"
        >
          <Icon
            icon="mdi:lightbulb-outline"
            height="12"
          />
          <span>{{ i18n[report.suggestionKey] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 代码热点分区：热点文件列表（热度/指标/建议）+ 四类汇总表 + 优化建议
import type { CodeReportData, GitProject } from "../../types"
import { computed } from "vue"
import { Icon } from "@iconify/vue"
import { HOTSPOT_LEVEL_META } from "../../types"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { openLocalPath, relativeTime, resolveValidPath } from "../../utils"
import EmptyState from "../common/EmptyState.vue"

/** 拆分文件路径为目录 + 文件名（dirname 弱化 / basename 强调，便于快速扫描定位文件） */
function splitPath(path: string): { dir: string, base: string } {
  const idx = path.lastIndexOf("/")
  if (idx < 0) {
    return { dir: "", base: path }
  }
  return { dir: path.slice(0, idx + 1), base: path.slice(idx + 1) }
}

const props = defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 hotspots / hotspotSummary / suggestionKey / analyzedFiles） */
  report: CodeReportData
  /** 当前项目实例（点击路径打开文件需要解析根目录；可为 null 表示无项目） */
  project: GitProject | null
}>()

/** 热点行预映射：预先拆分路径为 dir/base 并算好相对时间，避免模板中每行重复求值 */
const preparedHotspots = computed(() =>
  props.report.hotspots.map((h) => {
    const { dir, base } = splitPath(h.path)
    return {
      ...h,
      dir,
      base,
      lastModifiedText: h.lastModified ? relativeTime(h.lastModified, props.i18n) : "-",
    }
  }),
)

/** 截断提示文案（热点榜仅展示前 12 个；分析文件数不超过榜单上限时返回空串，隐藏提示） */
const truncatedText = computed(() => {
  if (props.report.analyzedFiles <= props.report.hotspots.length) return ""
  return props.i18n.reportHotspotTruncated
    .replace("{0}", String(props.report.hotspots.length))
    .replace("{1}", String(props.report.analyzedFiles))
})

/** 点击文件路径：拼接项目根目录后经 shell.openPath 以默认应用打开（浏览器环境无能力打开本地文件，静默忽略） */
async function openFile(path: string) {
  if (!props.project) return
  const nodePath = getNodeFsPathOs()?.path
  const root = resolveValidPath(props.project)
  if (!nodePath || !root) return
  await openLocalPath(nodePath.join(root, path))
}
</script>

<style lang="scss">
@use "../../styles/HotspotSection.scss";
@use "../../styles/index.scss";
</style>
