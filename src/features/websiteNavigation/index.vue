<!--
  网站导航主面板 — 网站书签管理，支持分类筛选、搜索与一键打开
-->
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
      @update:searchQuery="searchQuery = $event"
      @update:selected-category="selectedCategory = $event"
      @manage-categories="showCategoryMgr = true"
    />

    <div class="entries-list">
      <WebsiteCard
        v-for="entry in filteredEntries"
        :key="entry.id"
        :entry="entry"
        :i18n="i18n"
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
        <!-- 无匹配/无网站文案 -->
        <p>{{ searchQuery ? i18n.notFound : i18n.noWebsites }}</p>
      </div>
    </div>

    <WebsiteDialog
      :visible="showDialog"
      :i18n="i18n"
      :entry-id="editingId"
      @close="closeDialog"
      @saved="closeDialog"
    />

    <CategoryManager
      :visible="showCategoryMgr"
      :i18n="i18n"
      @close="showCategoryMgr = false"
      @saved="handleCategoriesSaved"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { I18n } from "./types"
import { ALL_CATEGORY_ID } from "./types/constants"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { copyToClipboard } from "@/utils/domUtils"
import CategoryManager from "./components/CategoryManager.vue"
import FilterBar from "./components/FilterBar.vue"
import PanelHeader from "./components/PanelHeader.vue"
import WebsiteCard from "./components/WebsiteCard.vue"
import WebsiteDialog from "./components/WebsiteDialog.vue"
import {
  categories,
  deleteEntry as removeEntry,
  entries,
  loadData,
  useWebsiteNavigation,
} from "./composables/useWebsiteNavigation"

interface Props {
  i18n: I18n
  plugin: Plugin
  onClose?: () => void
}

const props = defineProps<Props>()

useWebsiteNavigation(props.plugin)

const searchQuery = ref("")
const selectedCategory = ref<string>(ALL_CATEGORY_ID)
const showDialog = ref(false)
const editingId = ref<string | null>(null)
const showCategoryMgr = ref(false)

const filteredEntries = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const cat = selectedCategory.value

  return entries.value.filter((entry) => {
    if (cat !== ALL_CATEGORY_ID && entry.category !== cat) return false
    if (!query) return true
    return (
      entry.name.toLowerCase().includes(query)
      || entry.description.toLowerCase().includes(query)
      || entry.url.toLowerCase().includes(query)
    )
  })
})

// 分类被删除后若正处于该分类筛选，自动回到全部
watch(categories, (list) => {
  if (selectedCategory.value !== ALL_CATEGORY_ID && !list.some((c) => c.id === selectedCategory.value)) {
    selectedCategory.value = ALL_CATEGORY_ID
  }
})

const openAddDialog = () => {
  editingId.value = null
  showDialog.value = true
}

const editEntry = (entry: { id: string }) => {
  editingId.value = entry.id
  showDialog.value = true
}

const closeDialog = () => {
  showDialog.value = false
  editingId.value = null
  props.onClose?.()
}

const handleCategoriesSaved = async () => {
  // 分类弹窗自包含保存，父组件仅负责刷新筛选状态
  const ok = await loadData()
  if (!ok) {
    showMessage(props.i18n.loadFailed, 3000, "error")
  }
}

const deleteEntry = async (id: string) => {
  const entry = entries.value.find((e) => e.id === id)
  if (!entry) return

  // eslint-disable-next-line no-alert
  if (!window.confirm(props.i18n.confirmDelete)) {
    return
  }

  try {
    const ok = await removeEntry(id)
    if (ok) {
      showMessage(props.i18n.deleteSuccess, 2000, "info")
    }
  } catch {
    showMessage(props.i18n.deleteFailed, 3000, "error")
  }
}

const openUrl = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer")
}

const copyUrl = async (url: string) => {
  try {
    await copyToClipboard(url)
    showMessage(props.i18n.urlCopied, 2000, "info")
  } catch {
    showMessage(props.i18n.copyUrl, 2000, "error")
  }
}
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
