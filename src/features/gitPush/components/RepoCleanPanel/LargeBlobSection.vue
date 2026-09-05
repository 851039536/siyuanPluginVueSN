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
          <!-- 锚定来源徽章（仅非本地引用锚定时显示："远程引用"/"其他引用"） -->
          <span
            v-if="row.anchor"
            class="grcp-item-anchor"
            :title="row.anchor === 'remote' ? i18n.repoCleanAnchorRemoteTip : i18n.repoCleanAnchorOtherTip"
          >{{ row.anchor === "remote" ? i18n.repoCleanAnchorRemote : i18n.repoCleanAnchorOther }}</span>
          <!-- 路径（超长省略，title 保留全文） -->
          <span
            class="grcp-item-path"
            :title="row.path"
          >{{ row.path }}</span>
        </div>
        <!-- 占 .git 体积百分比条形 -->
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

/** 大文件行视图：预计算占比条形宽度（size / packSize，上限 100%） */
interface BlobRow extends RepoBlobItem {
  pct: number
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

/** 行视图：占比随数据源变化各算一次 */
const pagedRows = computed<BlobRow[]>(() =>
  pagedBlobs.value.map((b) => ({
    ...b,
    pct: props.packSize > 0 ? Math.min(100, (b.size / props.packSize) * 100) : 0,
  })),
)

/** 数据源变化（重新扫描）时重置分页 */
watch(pagedSource, () => {
  pagedReset()
})
</script>

<style lang="scss">
@use "../../styles/RepoCleanPanel.scss";
@use "../../styles/index.scss";
</style>
