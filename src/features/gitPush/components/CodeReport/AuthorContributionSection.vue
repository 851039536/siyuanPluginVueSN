<!-- gitPush 代码统计报告：代码贡献度分区（作者排行表：排名/提交/新增/删除/净增bar/平均大小/频率/文件/活跃天数 + 点击行展开详情） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："代码贡献度" + 行数徽章 -->
    <div class="gpr-section-title">
      {{ i18n.reportAuthorsTitle }}
      <span class="gpr-section-count">{{ authors.length }}</span>
    </div>

    <!-- 空状态：范围内无提交 -->
    <EmptyState
      v-if="authors.length === 0"
      icon="mdi:account-details"
      :text="i18n.reportNoData"
    />

    <!-- 作者排行表（HTML table 布局：跨行列宽强制一致，数字列按内容自适应；展开行 colspan 覆盖全部列） -->
    <div
      v-else
      class="gpr-table-wrap"
    >
      <table class="gpr-author-table">
        <thead>
          <tr>
            <!-- 表头："排名" -->
            <th class="gpr-author-th gpr-author-th--rank">#</th>
            <!-- 表头："作者" -->
            <th class="gpr-author-th">{{ i18n.projectName }}</th>
            <!-- 表头："提交次数" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportCommitsCol }}</th>
            <!-- 表头："新增行数" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportLinesCol }}</th>
            <!-- 表头："删除行数" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportDeletedLinesCol }}</th>
            <!-- 表头："净增行数" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportNetCol }}</th>
            <!-- 表头："平均提交大小" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportAvgSizeCol }}</th>
            <!-- 表头："提交频率" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportFrequencyCol }}</th>
            <!-- 表头："涉及文件数" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportFilesCol }}</th>
            <!-- 表头："活跃天数" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportActiveDaysCol }}</th>
          </tr>
        </thead>
        <tbody>
          <!-- 每作者渲染主行 + 展开行（template 包装使两者可并排） -->
          <template
            v-for="row in rows"
            :key="row.author"
          >
            <tr
              class="gpr-author-row"
              :class="[row.topClass, { 'gpr-author-row--open': expanded === row.author }]"
              :title="i18n.reportExpandHint"
              @click="toggleExpand(row.author)"
            >
              <!-- 排名列：TOP3 金/银/铜徽章，其余纯数字 -->
              <td class="gpr-author-cell gpr-author-cell--rank">
                <span
                  v-if="row.medalClass"
                  class="gpr-medal"
                  :class="row.medalClass"
                >{{ row.rank }}</span>
                <span
                  v-else
                  class="gpr-rank"
                >{{ row.rank }}</span>
              </td>
              <!-- 作者名（超长省略，完整名悬停可见） -->
              <td
                class="gpr-author-cell gpr-author-cell--name"
                :title="row.author"
              >{{ row.author }}</td>
              <!-- 提交次数 -->
              <td class="gpr-author-cell gpr-author-cell--num">{{ row.commits }}</td>
              <!-- 新增行数 -->
              <td class="gpr-author-cell gpr-author-cell--num">{{ row.linesAdded }}</td>
              <!-- 删除行数 -->
              <td class="gpr-author-cell gpr-author-cell--num">{{ row.linesDeleted }}</td>
              <!-- 净增行数：数字正负着色 + mini bar 量级可视化 -->
              <td class="gpr-author-cell gpr-author-cell--num">
                <div class="gpr-net-cell">
                  <span
                    class="gpr-net-value"
                    :class="row.netClass"
                  >{{ row.netText }}</span>
                  <div
                    class="gpr-net-bar"
                    :class="row.netBarClass"
                  >
                    <span
                      class="gpr-net-bar-fill"
                      :style="{ '--gpr-net-fill': row.netBarFill }"
                    />
                  </div>
                </div>
              </td>
              <!-- 平均提交大小 -->
              <td class="gpr-author-cell gpr-author-cell--num">{{ row.avgCommitSize }}</td>
              <!-- 提交频率 -->
              <td class="gpr-author-cell gpr-author-cell--num">{{ row.frequency }}</td>
              <!-- 涉及文件数 -->
              <td class="gpr-author-cell gpr-author-cell--num">{{ row.filesTouched }}</td>
              <!-- 活跃天数 -->
              <td class="gpr-author-cell gpr-author-cell--num">{{ row.activeDays }}</td>
            </tr>
            <!-- 展开详情行：Top3 修改文件 + 活跃时间范围 + 代码流失率 -->
            <tr
              v-if="expanded === row.author"
              class="gpr-author-detail-row"
            >
              <td
                class="gpr-author-detail"
                :colspan="10"
              >
                <div class="gpr-detail-grid">
                  <!-- 详情块：主要修改文件 -->
                  <div class="gpr-detail-block">
                    <div class="gpr-detail-label">{{ i18n.reportTopFilesTitle }}</div>
                    <ul
                      v-if="row.topFiles.length > 0"
                      class="gpr-detail-files"
                    >
                      <li
                        v-for="f in row.topFiles"
                        :key="f.path"
                        class="gpr-detail-file"
                        :title="i18n.reportFileDetailClickHint"
                        @click.stop="openFileDetail(f.path)"
                      >
                        <span
                          class="gpr-detail-file-name"
                          :title="f.path"
                        >{{ f.path }}</span>
                        <span class="gpr-detail-file-count">{{ f.count }}×</span>
                      </li>
                    </ul>
                    <div
                      v-else
                      class="gpr-detail-empty"
                    >—</div>
                  </div>
                  <!-- 详情块：活跃时间范围 -->
                  <div class="gpr-detail-block">
                    <div class="gpr-detail-label">{{ i18n.reportActiveRange }}</div>
                    <div class="gpr-detail-value">{{ formatIsoDate(row.firstCommitAt) }} ~ {{ formatIsoDate(row.lastCommitAt) }}</div>
                    <div class="gpr-detail-sub">{{ i18n.reportActiveDaysCol }}: {{ row.activeDays }}</div>
                  </div>
                  <!-- 详情块：代码流失率 -->
                  <div class="gpr-detail-block">
                    <div class="gpr-detail-label">{{ i18n.reportChurnRate }}</div>
                    <div class="gpr-detail-value">{{ churnText(row.churnRate) }}</div>
                    <div class="gpr-detail-sub">{{ row.linesDeleted }} {{ i18n.reportDeletedLinesShort }}</div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- 文件详情弹窗（点击 Top 修改文件项触发，fileStat 非空即展示；diff 按需懒取） -->
    <FileDetailModal
      :i18n="i18n"
      :file-stat="selectedFile"
      :get-file-patch="getFilePatch"
      @close="selectedFile = null"
    />
  </div>
</template>

<script setup lang="ts">
// 代码贡献度分区：作者排行表（预计算行数据消除模板重复查找/拼接；TOP3 排名徽章 + 净增 mini bar + 点击行展开详情）
import { computed, ref, watch } from "vue"
import type { AuthorReportRow, FileStatRow } from "../../types"
import { formatIsoDate, maxOf, netClass as sharedNetClass } from "../../utils"
import EmptyState from "../common/EmptyState.vue"
import FileDetailModal from "./FileDetailModal.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 作者排行（按提交次数降序） */
  authors: AuthorReportRow[]
  /** 文件详情查找表（路径 → 完整统计行，Top 修改文件点击弹窗数据源） */
  fileDetailsMap: Record<string, FileStatRow>
  /** 按当前项目+范围懒取文件补丁（透传给文件详情弹窗） */
  getFilePatch: (path: string) => Promise<string>
}>()

/** 展开详情的作者名（空串 = 全部收起） */
const expanded = ref("")

/** 弹窗展示的文件详情（null = 隐藏） */
const selectedFile = ref<FileStatRow | null>(null)

// 报告重新生成（切换项目/时间范围）后复位展开行与弹窗，避免残留上一份报告的交互态（authors 引用随重生成更换）
watch(() => props.authors, () => {
  expanded.value = ""
  selectedFile.value = null
})

/** 点击 Top 修改文件项：从查找表取完整统计行弹出详情弹窗 */
function openFileDetail(path: string) {
  selectedFile.value = props.fileDetailsMap[path] ?? null
}

/** TOP3 徽章样式（金/银/铜） */
const MEDAL_CLASSES = ["gpr-medal--gold", "gpr-medal--silver", "gpr-medal--bronze"]

/** 排名行背景强调（前 3 名） */
const TOP_ROW_CLASSES = ["gpr-author-row--top1", "gpr-author-row--top2", "gpr-author-row--top3"]

/** 净增格式化：正数带 + 前缀便于视觉区分 */
function formatNet(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

/** 代码流失率 → 百分比文案 */
function churnText(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

/**
 * 净增正负着色类（复用 index.scss 的 .gpr-cell--pos / --neg）。
 * 净增为 0 时返回空串：项目无 .gpr-cell--zero 样式，挂上去是无意义的死类名。
 */
function netClass(net: number): string {
  return sharedNetClass(net, "gpr-cell", "")
}

/**
 * 行数据（模板渲染源）：预计算颜色/徽章/mini bar 填充比例等派生值，消除模板内重复查找与拼接。
 * netBarFill 为 0~1 的比例（供 CSS scaleX 使用）：按最大净增归一化，至少 0.03 保证可见，
 * 净增 0 恒为 0（不留残段）。用 transform 代替 width 可让填充动画走合成层，不触发布局回流。
 */
const rows = computed(() => {
  // 净增 mini bar 基准：全部作者净增绝对值的最大值（避免单个大数值压缩其余 bar）
  const maxNet = maxOf(props.authors.map((a) => Math.abs(a.netLines)), 0)
  return props.authors.map((a, i) => {
    const medalClass = i < MEDAL_CLASSES.length ? MEDAL_CLASSES[i] : ""
    return {
      ...a,
      rank: i + 1,
      medalClass,
      topClass: i < TOP_ROW_CLASSES.length ? TOP_ROW_CLASSES[i] : "",
      netClass: netClass(a.netLines),
      netText: formatNet(a.netLines),
      netBarFill: a.netLines === 0 || maxNet <= 0 ? 0 : Math.max(0.03, Math.abs(a.netLines) / maxNet),
      netBarClass: a.netLines > 0 ? "gpr-net-bar--pos" : a.netLines < 0 ? "gpr-net-bar--neg" : "",
    }
  })
})

/** 点击行切换展开状态 */
function toggleExpand(author: string) {
  expanded.value = expanded.value === author ? "" : author
}
</script>

<style lang="scss">
@use "../../styles/AuthorContributionSection.scss";
@use "../../styles/index.scss";
</style>
