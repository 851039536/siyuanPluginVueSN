<!-- 单词阅读功能 - 分类筛选与搜索 -->
<template>
  <div class="category-filter">
    <div class="filter-left">
      <label>{{ t.category }}:</label>
      <Select
        :modelValue="selectedCategory"
        :options="categoryOptions"
        size="xsmall"
        @update:modelValue="(val) => $emit('update:selectedCategory', val as string)"
      />
    </div>
    <div class="filter-right">
      <Input
        :modelValue="searchQuery"
        :placeholder="t.searchPlaceholder"
        prefixIcon="search"
        size="xsmall"
        @update:modelValue="(val) => $emit('update:searchQuery', val as string)"
      />
      <div class="statistics">
        <span class="tag tag-secondary">{{ t.total }}: {{ totalCards }}</span>
        <span
          v-if="selectedCategory !== 'all' || searchQuery"
          class="tag tag-info"
        >
          {{ selectedCategory !== 'all' ? selectedCategory : t.filtered }}: {{ filteredCount }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { I18n } from "../types"
import type { SelectOption } from "@/components/Select.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { useI18n } from "../composables/useI18n"

const props = defineProps<{
  i18n: I18n
  selectedCategory: string
  searchQuery: string
  categoryOptions: SelectOption[]
  totalCards: number
  filteredCount: number
}>()

defineEmits<{
  "update:selectedCategory": [value: string]
  "update:searchQuery": [value: string]
}>()

const t = useI18n(props.i18n)
</script>
