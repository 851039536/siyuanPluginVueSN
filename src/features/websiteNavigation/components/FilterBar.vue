<!--
  网站导航分类筛选行 — 分类标签切换 + 管理入口
-->
<template>
  <div class="wn-category-filter">
    <button
      v-for="cat in allCategories"
      :key="cat.id"
      class="wn-category-chip"
      :class="{ active: selectedCategory === cat.id }"
      :style="{ '--cat-color': cat.color }"
      @click="emit('update:selectedCategory', cat.id)"
    >
      <span
        class="chip-dot"
        :style="{ backgroundColor: cat.color }"
      ></span>
      <!-- 全部/分类名称 -->
      {{ cat.name }}
    </button>
    <!-- 管理类别 -->
    <Button
      icon="settings"
      variant="ghost"
      size="xsmall"
      :title="i18n.manageCategories"
      @click="emit('manageCategories')"
    />
  </div>
</template>

<script setup lang="ts">
import type { I18n } from "../types"
import type { WebsiteCategory } from "@/utils/sharedStorage/websiteStorage"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import {
  ALL_CATEGORY_ID,
  DEFAULT_CATEGORY_COLOR,
} from "@/utils/sharedStorage/websiteStorage"

const props = defineProps<{
  i18n: I18n
  selectedCategory: string
  categories: WebsiteCategory[]
}>()

const emit = defineEmits<{
  (e: "update:selectedCategory", value: string): void
  (e: "manageCategories"): void
}>()

const allCategories = computed(() => [
  {
    id: ALL_CATEGORY_ID,
    name: props.i18n.allCategories,
    color: DEFAULT_CATEGORY_COLOR,
  },
  ...props.categories,
])
</script>

<style lang="scss">
@use "../styles/FilterBar.scss";
@use "../styles/index.scss";
</style>
