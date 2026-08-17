<!-- 快捷键面板头部工具栏：搜索框、分类下拉、添加按钮、收藏/最近筛选、总数统计 -->
<template>
  <div class="shortcut-header">
    <!-- 行1：搜索 + 分类 + 添加 -->
    <div class="toolbar-row">
      <Input
        :model-value="searchKeyword"
        :placeholder="placeholder"
        prefix-icon="search"
        size="xsmall"
        class="toolbar-search"
        @update:model-value="onSearchChange"
      />
      <Select
        :model-value="activeTab"
        :options="selectOptions"
        size="xsmall"
        class="toolbar-category"
        @update:model-value="onTabChange"
      />
      <Button
        variant="primary"
        size="xsmall"
        icon="add"
        :title="addTitle"
        class="toolbar-add"
        @click="$emit('add')"
      />
    </div>
    <!-- 行2：筛选 + 总数 -->
    <div class="toolbar-row-secondary">
      <div class="filter-group">
        <Button
          variant="ghost"
          :class="{ active: activeFilter === 'favorite' }"
          size="xsmall"
          icon="star"
          @click="$emit('update:activeFilter', toggleFilter('favorite'))"
        >
          {{ filterFavoriteLabel }}
        </Button>
        <Button
          variant="ghost"
          :class="{ active: activeFilter === 'recent' }"
          size="xsmall"
          icon="timerOutline"
          @click="$emit('update:activeFilter', toggleFilter('recent'))"
        >
          {{ filterRecentLabel }}
        </Button>
      </div>
      <!-- 快捷键总数 -->
      <span class="total-count">{{ totalCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from "@/components/Select.vue"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

interface Props {
  searchKeyword: string
  placeholder: string
  addTitle: string
  activeTab: string
  activeFilter: string
  filterFavoriteLabel: string
  filterRecentLabel: string
  tabs: string[]
  getCategoryLabel: (category: string) => string
  getTabCount: (category: string) => number
  totalCount: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:searchKeyword": [value: string]
  "update:activeTab": [value: string]
  "update:activeFilter": [value: string]
  "add": []
}>()

const onSearchChange = (value: string | number | null) => {
  emit("update:searchKeyword", String(value ?? ""))
}

const onTabChange = (value: string | number | boolean | null) => {
  emit("update:activeTab", String(value ?? "all"))
}

/**
 * 筛选按钮切换：已选中则回到"全部"，否则选中目标筛选
 */
const toggleFilter = (target: string) => {
  return props.activeFilter === target ? "all" : target
}

const selectOptions = computed((): SelectOption[] => {
  return props.tabs.map((tab) => ({
    value: tab,
    label: `${props.getCategoryLabel(tab)} (${props.getTabCount(tab)})`,
  }))
})
</script>

<style lang="scss" scoped>
@use "../styles/PanelHeader.scss";
</style>
