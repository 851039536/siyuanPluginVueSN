<!-- 快捷键面板头部工具栏：搜索框、分类下拉、添加按钮、筛选按钮组、视图切换 -->
<template>
  <div class="shortcut-header">
    <!-- Row 1: Search + Category + Add -->
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
        @update:model-value="$emit('update:activeTab', $event)"
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
    <!-- Row 2: Filters + View toggle -->
    <div class="toolbar-row-secondary">
      <div class="filter-group">
        <Button
          v-for="filter in filters"
          :key="filter.key"
          :variant="activeFilter === filter.key ? 'primary' : 'ghost'"
          size="xsmall"
          @click="$emit('update:activeFilter', filter.key)"
        >
          {{ filter.label }}
        </Button>
      </div>
      <div class="view-toggle">
        <Button
          :variant="viewMode === 'grid' ? 'primary' : 'ghost'"
          size="xsmall"
          title="网格视图"
          @click="$emit('update:viewMode', 'grid')"
        >
          <span class="grid-icon">
            <span class="square"></span>
            <span class="square"></span>
          </span>
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from "@/components/Select.vue"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

interface FilterItem {
  key: string
  label: string
}

interface Props {
  searchKeyword: string
  placeholder: string
  addTitle: string
  activeTab: string
  activeFilter: string
  viewMode: string
  filters: FilterItem[]
  tabs: string[]
  getCategoryLabel: (category: string) => string
  getTabCount: (category: string) => number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:searchKeyword": [value: string]
  "update:activeTab": [value: string]
  "update:activeFilter": [value: string]
  "update:viewMode": [value: string]
  "add": []
}>()

const onSearchChange = (value: string | number | null) => {
  emit("update:searchKeyword", String(value ?? ""))
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
