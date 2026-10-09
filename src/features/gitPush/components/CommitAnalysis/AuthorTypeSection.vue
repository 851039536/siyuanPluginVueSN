<!-- gitPush 提交分析作者排行 + 提交内容类型双栏区块 -->
<template>
  <!-- 双栏：作者提交排行 | 提交内容类型 -->
  <div class="gpa-pair">
    <!-- 作者提交排行 -->
    <div class="gpa-section">
      <!-- 区块标题："作者提交排行"（数据层按 AUTHOR_RANK_LIMIT 截断，截断时补一行说明） -->
      <div class="gpa-section-title">
        {{ i18n.analysisAuthorRanking }}
        <!-- 截断提示：不加会让各行次数之和小于总提交次数，看起来像统计出错 -->
        <span
          v-if="authorTruncatedHint"
          class="gpa-rank-hint"
          :title="authorTruncatedHint"
        >{{ authorTruncatedHint }}</span>
      </div>
      <div class="gpa-bar-list">
        <div
          v-for="a in authorRows"
          :key="a.author"
          class="gpa-bar-row"
        >
          <span
            class="gpa-bar-label"
            :title="a.author"
          >{{ a.author }}</span>
          <span class="gpa-bar-track">
            <span
              class="gpa-bar-fill"
              :style="{ width: a.pct }"
            />
          </span>
          <span class="gpa-bar-num">{{ a.count }}</span>
        </div>
      </div>
    </div>

    <!-- 提交内容类型 -->
    <div class="gpa-section">
      <!-- 区块标题："提交内容类型" -->
      <div class="gpa-section-title">
        {{ i18n.analysisTypeDistribution }}
      </div>
      <div class="gpa-bar-list">
        <div
          v-for="t in typeRows"
          :key="t.type"
          class="gpa-bar-row"
        >
          <span class="gpa-bar-label">{{ i18n[COMMIT_ANALYSIS_TYPE_META[t.type].labelKey] }}</span>
          <span class="gpa-bar-track">
            <span
              class="gpa-bar-fill"
              :style="{ width: t.pct, background: COMMIT_ANALYSIS_TYPE_META[t.type].color }"
            />
          </span>
          <span class="gpa-bar-num">{{ t.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析作者排行 + 提交内容类型双栏区块（条形相对最大值）
import type { CommitAnalysisStats } from "../../types"
import { computed } from "vue"
import { COMMIT_ANALYSIS_TYPE_META } from "../../types"
import { withBarPct } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 提交分析聚合视图（取 authorRanking + typeDistribution） */
  stats: CommitAnalysisStats
}>()

/** 提交类型行视图 */
const typeRows = computed(() => withBarPct(props.stats.typeDistribution))

/** 作者排行行视图 */
const authorRows = computed(() => withBarPct(props.stats.authorRanking))

/** 作者排行截断提示（未截断时为空串不渲染；与项目排行同一提示口径） */
const authorTruncatedHint = computed(() => {
  const shown = props.stats.authorRanking.length
  const total = props.stats.authorRankingTotal
  if (total <= shown) return ""
  return String(props.i18n.analysisRankTruncated || "")
    .replace("{0}", String(shown))
    .replace("{1}", String(total))
})
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
