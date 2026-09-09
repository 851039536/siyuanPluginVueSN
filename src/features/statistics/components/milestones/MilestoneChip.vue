<!-- 里程碑 chip 子组件：达成/未达成/下一目标三态展示（样式复用 MilestonesCard.scss 的 .milestone-chip） -->
<template>
  <div
    class="milestone-chip"
    :class="[`tier-${milestone.tier}`, stateClass]"
  >
    <IconWrapper
      class="chip-icon"
      :name="iconName"
      :size="14"
    />
    <span class="chip-label">{{ milestone.label }}</span>
    <!-- 达成态：稀有度名徽章 -->
    <span
      v-if="milestone.achieved"
      class="chip-tier"
    >{{ tierLabels[milestone.tier] }}</span>
    <!-- 未达成态：进度条 -->
    <div
      v-if="!milestone.achieved"
      class="chip-progress"
    >
      <div
        class="chip-progress-fill"
        :style="{ width: `${milestone.progress}%` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// 里程碑 chip：按状态渲染稀有度类/图标/进度条（纯展示，状态标志沿用 MilestoneState）
import type { MilestoneState, Tier } from "../../types/milestoneData"
import type { IconKey } from "@/config/icons"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  milestone: MilestoneState
  tierLabels: Record<Tier, string>
}

const props = defineProps<Props>()

/** 状态类：achieved / next / locked（对应 MilestonesCard.scss 中的三态样式） */
const stateClass = computed(() => {
  const m = props.milestone
  if (m.achieved) return "achieved"
  return m.isNext ? "next" : "locked"
})

/** 图标：达成显类型图标，未达成显星标（下一目标）/锁 */
const iconName = computed<IconKey>(() => {
  const m = props.milestone
  if (m.achieved) return m.icon as IconKey
  return (m.isNext ? "star" : "pageLock") as IconKey
})
</script>

<style scoped lang="scss">
@use "../../styles/MilestonesCard.scss";
@use '../../styles/index.scss' as stats;
</style>
