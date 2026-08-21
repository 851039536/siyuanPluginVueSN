<!-- gitPush 提交规则检查违规类型分布区块（条形相对最大值） -->
<template>
  <div
    v-if="stats.byReason.length > 0"
    class="grc-section"
  >
    <!-- 区块标题："违规类型分布" -->
    <div class="grc-section-title">{{ i18n.ruleCheckReasonTitle }}</div>
    <div class="grc-bar-list">
      <div
        v-for="row in reasonRows"
        :key="row.reason"
        class="grc-bar-row"
      >
        <span class="grc-bar-label">{{ i18n[COMMIT_RULE_REASON_META[row.reason].labelKey] }}</span>
        <span class="grc-bar-track">
          <span
            class="grc-bar-fill"
            :style="{ width: row.pct }"
          />
        </span>
        <span class="grc-bar-num">{{ row.count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交规则检查违规类型分布区块（条形相对最大值）
import type { CommitRuleCheckStats } from "../../types"
import { computed } from "vue"
import { COMMIT_RULE_REASON_META } from "../../types"
import { withBarPct } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 规则检查聚合视图（取 byReason） */
  stats: CommitRuleCheckStats
}>()

/** 违规类型分布行（复用 withBarPct 计算条形宽度） */
const reasonRows = computed(() => withBarPct(props.stats.byReason))
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
