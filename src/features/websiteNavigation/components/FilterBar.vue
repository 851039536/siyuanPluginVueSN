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
      <Input
        :model-value="searchQuery"
        type="text"
        :placeholder="i18n.searchPlaceholder"
        size="xsmall"
        @update:model-value="emit('update:searchQuery', $event)"
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
        {{ cat.name }}
      </button>
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
import type {
  I18n,
  WebsiteCategory,
} from "../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"

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
    id: "all",
    name: props.i18n.allCategories,
    color: "#b0aea5",
  },
  ...props.categories,
])
</script>
