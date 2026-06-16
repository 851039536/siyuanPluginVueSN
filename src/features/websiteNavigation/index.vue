<template>
  <div class="website-navigation-panel">
    <PanelHeader
      :i18n="i18n"
      :count="filteredEntries.length"
      :total-count="entries.length"
      @add="openAddDialog"
    />

    <FilterBar
      :i18n="i18n"
      :categories="categories"
      :search-query="searchQuery"
      :selected-category="selectedCategory"
      @update:search-query="searchQuery = $event"
      @update:selected-category="selectedCategory = $event"
      @manage-categories="showCategoryMgr = true"
    />

    <div class="entries-list">
      <WebsiteCard
        v-for="entry in filteredEntries"
        :key="entry.id"
        :entry="entry"
        :i18n="i18n"
        :category-color="getCategoryById(entry.category)?.color || '#b0aea5'"
        :category-name="getCategoryById(entry.category)?.name || '未分类'"
        @edit="editEntry"
        @delete="deleteEntry"
        @copy-url="copyUrl"
        @open-url="openUrl"
      />

      <div
        v-if="filteredEntries.length === 0"
        class="empty-state"
      >
        <IconWrapper
          name="browser"
          :size="48"
        />
        <p>{{ searchQuery ? '未找到匹配的网站' : i18n.noWebsites || '暂无网站，点击添加' }}</p>
      </div>
    </div>

    <WebsiteDialog
      :visible="showDialog"
      :i18n="i18n"
      :categories="categories"
      :editing-entry="editingEntry"
      @close="closeDialog"
      @save="saveEntry"
    />

    <CategoryManager
      :visible="showCategoryMgr"
      :i18n="i18n"
      :categories="categories"
      @close="showCategoryMgr = false"
      @add="addCategory"
      @remove="removeCategory"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  I18n,
  WebsiteCategory,
  WebsiteEntry,
} from "./types"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
} from "vue"
import { copyToClipboard } from "@/utils/domUtils"
import IconWrapper from "@/components/IconWrapper.vue"
import CategoryManager from "./components/CategoryManager.vue"
import FilterBar from "./components/FilterBar.vue"
import PanelHeader from "./components/PanelHeader.vue"
import WebsiteCard from "./components/WebsiteCard.vue"
import WebsiteDialog from "./components/WebsiteDialog.vue"
import { useWebsiteNavigation } from "./composables/useWebsiteNavigation"

interface Props {
  i18n: I18n
  plugin: Plugin
}

const props = defineProps<Props>()

const {
  storage,
  entries,
  categories,
  loadData,
} = useWebsiteNavigation(props.plugin)

const searchQuery = ref("")
const selectedCategory = ref<string>("all")
const showDialog = ref(false)
const editingEntry = ref<WebsiteEntry | null>(null)
const showCategoryMgr = ref(false)

const categoriesMap = computed(() => {
  const map = new Map<string, WebsiteCategory>()
  for (const cat of categories.value) {
    map.set(cat.id, cat)
  }
  return map
})

const getCategoryById = (id: string): WebsiteCategory | undefined => {
  return categoriesMap.value.get(id)
}

const filteredEntries = computed(() => {
  let result = entries.value
  const cat = selectedCategory.value
  const query = searchQuery.value.toLowerCase().trim()

  if (cat !== "all") {
    result = result.filter((e) => e.category === cat)
  }

  if (query) {
    result = result.filter(
      (e) =>
        e.name.toLowerCase().includes(query)
        || e.description.toLowerCase().includes(query)
        || e.url.toLowerCase().includes(query),
    )
  }

  return result
})

const reloadAfterMutation = async () => {
  try {
    await loadData()
  } catch {
    showMessage(props.i18n.loadFailed || "加载失败", 3000, "error")
  }
}

const openAddDialog = () => {
  editingEntry.value = null
  showDialog.value = true
}

const editEntry = (entry: WebsiteEntry) => {
  editingEntry.value = entry
  showDialog.value = true
}

const closeDialog = () => {
  showDialog.value = false
  editingEntry.value = null
}

const saveEntry = async (data: { name: string, url: string, category: string, description: string }) => {
  try {
    if (editingEntry.value) {
      await storage.updateEntry(editingEntry.value.id, data)
      showMessage(props.i18n.updateSuccess || "网站已更新", 2000, "info")
    } else {
      await storage.createEntry(data)
      showMessage(props.i18n.createSuccess || "网站已添加", 2000, "info")
    }
    closeDialog()
    await reloadAfterMutation()
  } catch {
    showMessage(props.i18n.saveFailed || "保存失败", 3000, "error")
  }
}

const deleteEntry = async (id: string) => {
  const entry = entries.value.find((e) => e.id === id)
  if (!entry) return

  // eslint-disable-next-line no-alert
  if (!window.confirm(props.i18n.confirmDelete || `确定删除「${entry.name}」吗？`)) {
    return
  }

  try {
    await storage.deleteEntry(id)
    showMessage(props.i18n.deleteSuccess || "网站已删除", 2000, "info")
    await reloadAfterMutation()
  } catch {
    showMessage(props.i18n.deleteFailed || "删除失败", 3000, "error")
  }
}

const openUrl = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer")
}

const copyUrl = async (url: string) => {
  try {
    await copyToClipboard(url)
    showMessage(props.i18n.urlCopied || "网址已复制", 2000, "info")
  } catch {
    showMessage(props.i18n.copyUrl || "复制失败", 2000, "error")
  }
}

const addCategory = async (name: string, color: string) => {
  if (categories.value.some((c) => c.name === name)) {
    showMessage("类别已存在", 2000, "error")
    return
  }

  const cat: WebsiteCategory = {
    id: Date.now().toString(),
    name,
    color,
  }
  categories.value = [...categories.value, cat]
  await storage.saveCategories(categories.value)
}

const removeCategory = async (catId: string) => {
  const hasEntries = entries.value.some((e) => e.category === catId)
  if (hasEntries) {
    showMessage("该类别下有网站，无法删除", 2000, "error")
    return
  }

  categories.value = categories.value.filter((c) => c.id !== catId)
  await storage.saveCategories(categories.value)

  if (selectedCategory.value === catId) {
    selectedCategory.value = "all"
  }
}
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
