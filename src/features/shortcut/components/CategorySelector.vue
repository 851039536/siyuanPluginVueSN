<template>
  <div class="shortcut-category-selector">
    <div class="selector-header">
      <label>{{ categoryLabel }}</label>
      <div class="selector-control">
        <Input
          v-model="localCategorySearch"
          :placeholder="searchPlaceholder"
          prefix-icon="search"
          size="small"
        />
        <Select
          :model-value="activeTab"
          :options="selectOptions"
          size="small"
          @update:model-value="$emit('update:activeTab', $event)"
        />
      </div>
      <div
        v-if="categorySearch && filteredTabs.length === 0"
        class="search-result-hint"
      >
        {{ noResultHint }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from "@/components/Select.vue"
import {
  computed,
  ref,
  watch,
} from "vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

interface Props {
  activeTab: string
  categorySearch: string
  tabs: string[]
  getCategoryLabel: (category: string) => string
  getTabCount: (category: string) => number
  categoryLabel?: string
  searchPlaceholder?: string
  noResultHint?: string
}

const props = withDefaults(defineProps<Props>(), {
  categoryLabel: "分类:",
  searchPlaceholder: "搜索分类...",
  noResultHint: "未找到匹配的分类",
})

const emit = defineEmits<{
  "update:activeTab": [value: string]
  "update:categorySearch": [value: string]
}>()

const localCategorySearch = ref(props.categorySearch)

watch(localCategorySearch, (val) => {
  emit("update:categorySearch", val)
})

watch(
  () => props.categorySearch,
  (val) => {
    localCategorySearch.value = val
  },
)

const filteredTabs = computed(() => {
  const allTabs = props.tabs
  if (!localCategorySearch.value) {
    return allTabs
  }
  return allTabs.filter((tab) => {
    const label = props.getCategoryLabel(tab).toLowerCase()
    return label.includes(localCategorySearch.value.toLowerCase())
  })
})

const selectOptions = computed((): SelectOption[] => {
  return filteredTabs.value.map((tab) => ({
    value: tab,
    label: `${props.getCategoryLabel(tab)} (${props.getTabCount(tab)})`,
  }))
})
</script>

<style scoped lang="scss">
.shortcut-category-selector {
  padding: 8px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}

.selector-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.selector-header label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  white-space: nowrap;
}

.selector-control {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-result-hint {
  flex-basis: 100%;
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
  font-style: italic;
  margin-top: -4px;
  margin-left: 4px;
}
</style>
