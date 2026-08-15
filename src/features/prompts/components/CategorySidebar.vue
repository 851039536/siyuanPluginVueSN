<!--
  提示词库 — 左侧分类侧边栏，垂直导航分类 + 管理入口
-->
<template>
  <!-- 分类侧边栏 -->
  <aside class="vp-sidebar">
    <nav
      class="vp-sidebar-nav"
      role="navigation"
      aria-label="分类导航"
    >
      <button
        v-for="cat in allCategories"
        :key="cat.id"
        type="button"
        class="vp-sidebar-item"
        :class="{ active: selectedCategory === cat.id }"
        :aria-pressed="selectedCategory === cat.id"
        @click="$emit('selectCategory', cat.id)"
      >
        <!-- "全部"入口用网格图标，其余分类用颜色圆点 -->
        <IconWrapper
          v-if="cat.id === 'all'"
          name="viewGrid"
          :size="16"
          class="vp-sidebar-icon"
        />
        <span
          v-else
          class="vp-sidebar-dot"
          :style="{ backgroundColor: cat.color }"
        />
        <!-- 分类名称 -->
        <span class="vp-sidebar-name">{{ cat.name }}</span>
        <!-- 分类计数徽章（"全部"不显示） -->
        <span
          v-if="cat.id !== 'all'"
          class="vp-sidebar-count"
        >{{ categoryCounts[cat.id] || 0 }}</span>
      </button>
    </nav>

    <!-- 管理分类入口 -->
    <button
      type="button"
      class="vp-sidebar-manage"
      @click="$emit('manageCategories')"
    >
      <IconWrapper
        name="listBulleted"
        :size="16"
        class="vp-sidebar-manage-icon"
      />
      {{ i18n?.manageCategories }}
    </button>
  </aside>
</template>

<script setup lang="ts">
import type { PromptCategory } from "../types"
import IconWrapper from "@/components/IconWrapper.vue"

defineProps<{
  allCategories: PromptCategory[]
  selectedCategory: string
  categoryCounts: Record<string, number>
  i18n?: Record<string, string>
}>()

defineEmits<{
  (e: "selectCategory", id: string): void
  (e: "manageCategories"): void
}>()
</script>

<style lang="scss" scoped>
@use '../styles/CategorySidebar.scss';
</style>
