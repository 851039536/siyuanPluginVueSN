<!-- 里程碑分类列表：按分类展示里程碑 chip（展开态全部 / 折叠态预览），纯展示组件 -->
<template>
  <div class="categories-section">
    <div class="section-label">
      里程碑分类
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
      <div
        v-if="category.expanded"
        class="category-body"
      >
        <div class="milestone-grid">
          <div
            v-for="m in category.allItems"
            :key="m.id"
            class="milestone-chip"
            :class="[`tier-${m.tier}`, {
              achieved: m.achieved,
              locked: !m.achieved && !m.isNext,
              next: !m.achieved && m.isNext,
            }]"
          >
            <IconWrapper
              class="chip-icon"
              :name="(m.achieved ? m.icon : (m.isNext ? 'star' : 'pageLock')) as any"
              :size="14"
            />
            <span class="chip-label">{{ m.label }}</span>
            <span
              v-if="m.achieved"
              class="chip-tier"
            >{{ tierLabels[m.tier] }}</span>
            <div
              v-if="!m.achieved"
              class="chip-progress"
            >
              <div
                class="chip-progress-fill"
                :style="{ width: `${m.progress}%` }"
              />
            </div>
          </div>
        </div>
      </div>
      <!-- collapsed preview: show last 3 achieved + 1 next -->
      <div
        v-else
        class="category-preview"
      >
        <div
          v-for="m in category.previewItems"
          :key="m.id"
          class="milestone-chip"
          :class="[`tier-${m.tier}`, {
            achieved: m.achieved,
            locked: !m.achieved && !m.isNext,
            next: !m.achieved && m.isNext,
          }]"
        >
          <IconWrapper
            class="chip-icon"
            :name="(m.achieved ? m.icon : (m.isNext ? 'star' : 'pageLock')) as any"
            :size="14"
          />
          <span class="chip-label">{{ m.label }}</span>
          <span
            v-if="m.achieved"
            class="chip-tier"
          >{{ tierLabels[m.tier] }}</span>
          <div
            v-if="!m.achieved"
            class="chip-progress"
          >
            <div
              class="chip-progress-fill"
              :style="{ width: `${m.progress}%` }"
            />
          </div>
        </div>
        <span
          v-if="category.hiddenCount > 0"
          class="more-hint"
        >+{{ category.hiddenCount }} 更多</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CategoryView, Tier } from "../types/milestoneData"
import type { IconKey } from "@/config/icons"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  categoryViews: CategoryView[]
  tierLabels: Record<Tier, string>
}

defineProps<Props>()
const emit = defineEmits<{
  toggle: [catId: string]
}>()
</script>

<style scoped lang="scss">
@use "../styles/MilestonesCard.scss";
</style>
