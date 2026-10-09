<!-- gitPush 仓库清理大文件列表区块（Top N 表格 + 体积占比条形 + 分页加载） -->
<template>
  <div class="grcp-section">
    <!-- 区块标题："大文件 Top 50" + 条数徽章 -->
    <div class="grcp-section-title">
      {{ i18n.repoCleanTopBlobs }}
      <span class="grcp-section-count">{{ blobs.length }}</span>
    </div>

    <div class="grcp-list">
      <div
        v-for="row in pagedRows"
        :key="row.hash"
        class="grcp-item"
      >
        <div class="grcp-item-head">
          <!-- 体积（$vp-mono，title 显示精确字节数） -->
          <span
            class="grcp-item-size"
            :title="`${row.size} B`"
          >{{ formatBytes(row.size) }}</span>
          <!-- 占 .git 打包体积百分比（体积已由左侧数字承担，此处补充"占仓库多少"的口径） -->
          <span
            class="grcp-item-share"
            :title="`${i18n.repoCleanOfPackSize}`"
          >{{ row.shareText }}</span>
          <!-- 来源徽章：三态全覆盖（本地可达 / 远程引用 / 其他引用）。
               原实现仅在"非本地"时才渲染，导致最常见的"本地可达"反而无标注，
               用户无法判断某个大文件是否已被本地分支锚定（决定能否清理的关键）。 -->
          <span
            class="grcp-item-anchor"
            :class="`grcp-item-anchor--${row.anchorKind}`"
            :title="row.anchorTip"
          >{{ row.anchorLabel }}</span>
          <!-- 路径（超长省略，title 保留全文） -->
          <span
            class="grcp-item-path"
            :title="row.path"
          >{{ row.path }}</span>
        </div>
        <!-- 量级条形：相对榜首文件归一化（见 pct 注释） -->
        <div class="grcp-item-bar-wrap">
          <div
            class="grcp-item-bar"
            :style="{ width: `${row.pct}%` }"
          />
        </div>
      </div>
    </div>
    <!-- 加载更多 -->
    <LoadMoreButton
      v-if="pagedHasMore"
      :i18n="i18n"
      :visible="pagedVisibleCount"
      :total="pagedSource.length"
      @load-more="pagedLoadMore"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 仓库清理大文件列表区块（本地分页 + 占比条形）
import type { RepoBlobItem } from "../../types"
import { computed, watch } from "vue"
import LoadMoreButton from "../common/LoadMoreButton.vue"
import { formatBytes } from "./format"
import { usePagedList } from "../../composables/usePagedList"

/** 大文件行视图：预计算量级条形宽度与占打包体积比 */
interface BlobRow extends RepoBlobItem {
  /** 量级条形宽度（0~100，相对**榜首文件**归一化） */
  pct: number
  /** 占 .git 打包体积的百分比文案（绝对口径，供右侧标注） */
  shareText: string
  /** 来源样式修饰类后缀（local / remote / other，见 anchorKindOf） */
  anchorKind: string
  /** 来源标签文案（已渲染，缺失时为 "-" 而非 undefined） */
  anchorLabel: string
  /** 来源说明文案（悬停） */
  anchorTip: string
}

const props = defineProps<{
  i18n: Record<string, any>
  /** 最大 blob Top N（降序） */
  blobs: RepoBlobItem[]
  /** .git 打包体积（占比分母，字节） */
  packSize: number
  /** 大文件阈值（MB，仅展示用） */
  thresholdMb: number
}>()

/** 列表分页数据源 */
const pagedSource = computed(() => props.blobs)

/** 本地分页（每页 20，与违规列表同 usePagedList 模式） */
const {
  visibleCount: pagedVisibleCount,
  paged: pagedBlobs,
  hasMore: pagedHasMore,
  loadMore: pagedLoadMore,
  reset: pagedReset,
} = usePagedList(pagedSource, 20)

/**
 * 行视图：量级条形 + 占比文案。
 *
 * 条形宽度相对**榜首文件**归一化（而非 .git 总体积）：单个 blob 占整个仓库通常只有百分之几，
 * 按 packSize 归一化时所有条都短到几乎不可见，条形等于没传递信息。
 * 按榜首归一化后条长表示「该文件相对最大文件的量级」，与绝对体积数字配合才可读
 * （口径与 utils/metrics 的 withBarPct 一致）。
 *
 * shareText 仍报**占打包体积**的绝对口径 —— 条形与文字各承担一个维度，互不重复。
 */
const pagedRows = computed<BlobRow[]>(() => {
  const topSize = pagedBlobs.value.length > 0
    ? Math.max(...pagedBlobs.value.map((b) => b.size))
    : 0
  return pagedBlobs.value.map((b) => {
    const kind = anchorKindOf(b)
    const suffix = kind === "local" ? "Local" : kind === "remote" ? "Remote" : "Other"
    return {
      ...b,
      // 最小值 2%：非零体积一定留可见残段，避免"有文件却看不到条"
      pct: topSize > 0 && b.size > 0 ? Math.max(2, (b.size / topSize) * 100) : 0,
      shareText: props.packSize > 0 ? `${((b.size / props.packSize) * 100).toFixed(1)}%` : "—",
      anchorKind: kind,
      // 在此渲染文案（而非在模板里按 key 查），i18n 缺键时降级为 "-" 而不是渲染出 undefined
      anchorLabel: String(props.i18n[`repoCleanAnchor${suffix}`] ?? "-"),
      anchorTip: String(props.i18n[`repoCleanAnchor${suffix}Tip`] ?? ""),
    }
  })
})

/**
 * 锚定来源分类（与 RepoCleanOps 的赋值口径一一对应）。
 *
 * `anchor` 仅在**本地不可达**时才被赋值，故 `undefined` 本身即代表"本地分支/标签可达"。
 * 这里补全为显式三态，让最常见的正常态也有标注（否则用户无法判断该文件是否已被本地分支锚定）。
 */
function anchorKindOf(b: RepoBlobItem): "local" | "remote" | "other" {
  if (!b.anchor) return "local"
  return b.anchor === "remote" ? "remote" : "other"
}

/** 数据源变化（重新扫描）时重置分页 */
watch(pagedSource, () => {
  pagedReset()
})
</script>

<style lang="scss">
@use "../../styles/RepoCleanPanel.scss";
@use "../../styles/index.scss";
</style>
