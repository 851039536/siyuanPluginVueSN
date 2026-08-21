<!-- gitPush 提交分析作者排行 + 提交内容类型双栏区块 -->
<template>
  <!-- 双栏：作者提交排行 | 提交内容类型 -->
  <div class="gpa-pair">
    <!-- 作者提交排行 -->
    <div class="gpa-section">
      <!-- 区块标题："作者提交排行" -->
      <div class="gpa-section-title">
        {{ i18n.analysisAuthorRanking }}
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
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
