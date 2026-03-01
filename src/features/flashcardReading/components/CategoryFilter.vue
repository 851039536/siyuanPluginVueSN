<template>
  <div class="category-filter">
    <div class="filter-left">
      <label>{{ i18n.category || '类别' }}:</label>
      <Select
        :modelValue="selectedCategory"
        :options="categoryOptions"
        size="small"
        @update:modelValue="$emit('update:selectedCategory', $event)"
      />
    </div>
    <div class="filter-right">
      <Input
        :modelValue="searchQuery"
        @update:modelValue="$emit('update:searchQuery', $event)"
        :placeholder="i18n.searchPlaceholder || '搜索标题或内容...'"
        prefixIcon="search"
        size="small"
      />
      <div class="statistics">
        <span class="tag tag-secondary">{{ i18n.total || '总计' }}: {{ totalCards }}</span>
        <span v-if="selectedCategory !== 'all' || searchQuery" class="tag tag-info">
          {{ selectedCategory !== 'all' ? selectedCategory : (i18n.filtered || '筛选') }}: {{ filteredCount }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Select from '@/components/Select.vue'
import Input from '@/components/Input.vue'
import type { SelectOption } from '@/components/Select.vue'
import type { I18n } from '../types'

defineProps<{
  i18n: I18n
  selectedCategory: string
  searchQuery: string
  categoryOptions: SelectOption[]
  totalCards: number
  filteredCount: number
}>()

defineEmits<{
  'update:selectedCategory': [value: string]
  'update:searchQuery': [value: string]
}>()
</script>
