<!--
  网站导航筛选栏 — 搜索输入 + 分类标签切换
-->
<template>
  <div>
    <div class="filter-bar">
      <IconWrapper
        name="search"
        :size="14"
        class="search-icon"
      />
      <!-- 搜索网站名称、网址或描述... -->
      <Input
        :model-value="searchQuery"
        type="text"
        :placeholder="i18n.searchPlaceholder"
        size="xsmall"
        @update:modelValue="emit('update:searchQuery', $event)"
      />
    </div>

    <div class="category-filter">
      <button
        v-for="cat in allCategories"
        :key="cat.id"
        class="category-chip"
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
  </div>
</template>

<script setup lang="ts">
import type { I18n } from "../types"
import type { WebsiteCategory } from "@/utils/sharedStorage/websiteStorage"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import {
  ALL_CATEGORY_ID,
  DEFAULT_CATEGORY_COLOR,
} from "@/utils/sharedStorage/websiteStorage"

const props = defineProps<{
  i18n: I18n
  searchQuery: string
  selectedCategory: string
  categories: WebsiteCategory[]
}>()

const emit = defineEmits<{
  (e: "update:searchQuery", value: string): void
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
