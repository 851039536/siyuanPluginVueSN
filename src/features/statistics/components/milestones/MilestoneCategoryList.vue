<!-- 里程碑分类列表：按分类展示里程碑 chip（展开态全部 / 折叠态预览），纯展示组件 -->
<template>
  <div class="categories-section">
    <!-- 区块标题："里程碑分类" -->
    <div class="section-label">
      {{ i18n.milestonesCategoryLabel }}
    </div>
    <div
      v-for="category in categoryViews"
      :key="category.id"
      class="category-card"
    >
      <button
        class="category-header"
        @click="emit('toggle', category.id)"
      >
        <IconWrapper
          class="category-icon"
          :name="category.icon as IconKey"
        />
        <span class="category-name">{{ category.name }}</span>
        <span class="category-count">{{ category.achievedCount }}/{{ category.totalCount }}</span>
        <span
          class="category-toggle"
          :class="{ expanded: category.expanded }"
        >
          <IconWrapper
            name="chevronRight"
            :size="12"
          />
        </span>
      </button>
      <!-- 展开态：全部里程碑 -->
      <div
        v-if="category.expanded"
        class="category-body"
      >
        <div class="milestone-grid">
          <MilestoneChip
            v-for="m in category.allItems"
            :key="m.id"
            :milestone="m"
            :tier-labels="tierLabels"
          />
        </div>
      </div>
      <!-- 折叠态：最近 3 个达成 + 1 个下一目标预览 -->
      <div
        v-else
        class="category-preview"
      >
        <MilestoneChip
          v-for="m in category.previewItems"
          :key="m.id"
          :milestone="m"
          :tier-labels="tierLabels"
        />
        <!-- 更多提示，如："+5 个更多" -->
        <span
          v-if="category.hiddenCount > 0"
          class="more-hint"
        >{{ moreHintText(category.hiddenCount) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 里程碑分类列表：折叠/展开两类 chip 渲染（复用 MilestoneChip 子组件），标题与更多提示走 i18n
import type { CategoryView, Tier } from "../../types/milestoneData"
import type { IconKey } from "@/config/icons"
import IconWrapper from "@/components/IconWrapper.vue"
import MilestoneChip from "./MilestoneChip.vue"

interface Props {
  categoryViews: CategoryView[]
  tierLabels: Record<Tier, string>
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})
const emit = defineEmits<{
  toggle: [catId: string]
}>()

/** 更多提示文案：{n} 占位符替换 */
function moreHintText(count: number): string {
  return String(props.i18n.moreMilestonesHint ?? "").replace("{n}", String(count))
}
</script>

<style scoped lang="scss">
@use "../../styles/MilestonesCard.scss";
@use '../../styles/index.scss' as stats;
</style>
