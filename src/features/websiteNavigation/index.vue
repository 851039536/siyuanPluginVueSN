<template>
  <div class="website-navigation-panel">
    <div class="panel-header">
      <div class="header-title">
        <IconWrapper
          name="link"
          :size="20"
        />
        <h2>{{ i18n.panelTitle || '网站导航' }}</h2>
        <span class="entry-count">{{ filteredEntries.length }}/{{ entries.length }}</span>
      </div>
      <div class="header-actions">
        <Button
          icon="add"
          variant="primary"
          size="small"
          @click="openAddDialog"
        >
          {{ i18n.addWebsite || '添加网站' }}
        </Button>
      </div>
    </div>

    <div class="filter-bar">
      <IconWrapper
        name="search"
        :size="14"
        class="search-icon"
      />
      <Input
        v-model="searchQuery"
        type="text"
        :placeholder="i18n.searchPlaceholder || '搜索网站名称或描述...'"
        size="small"
      />
    </div>

    <div class="category-filter">
      <button
        v-for="cat in [{
          id: 'all',
          name: i18n.allCategories || '全部',
          color: '#b0aea5',
        }, ...categories]"
        :key="cat.id"
        class="category-chip"
        :class="{ active: selectedCategory === cat.id }"
        :style="{ '--cat-color': cat.color }"
        @click="selectedCategory = cat.id"
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
        size="small"
        :title="i18n.manageCategories || '管理类别'"
        @click="showCategoryMgr = true"
      />
    </div>

    <div class="entries-list">
      <div
        v-for="entry in filteredEntries"
        :key="entry.id"
        class="entry-card"
      >
        <div class="entry-main">
          <div class="entry-info">
            <div class="entry-name-row">
              <IconWrapper
                name="link"
                :size="16"
                class="entry-icon"
              />
              <span class="entry-name">{{ entry.name }}</span>
              <span
                class="entry-category-tag"
                :style="{
                  backgroundColor: `${getCategoryById(entry.category)?.color || '#b0aea5'}20`,
                  color: getCategoryById(entry.category)?.color || '#b0aea5',
                }"
              >
                {{ getCategoryById(entry.category)?.name || '未分类' }}
              </span>
            </div>
            <div
              class="entry-url"
              @click="openUrl(entry.url)"
            >
              <IconWrapper
                name="link"
                :size="12"
              />
              <span class="url-text">{{ entry.url }}</span>
            </div>
            <div
              v-if="entry.description"
              class="entry-desc"
            >
              {{ entry.description }}
            </div>
          </div>
          <div class="entry-actions">
            <Button
              icon="copy"
              variant="ghost"
              size="small"
              :title="i18n.copyUrl || '复制网址'"
              @click="copyUrl(entry.url)"
            />
            <Button
              variant="ghost"
              size="small"
              @click="editEntry(entry)"
            >
              {{ i18n.editWebsite || '编辑' }}
            </Button>
            <Button
              icon="delete"
              variant="ghost"
              size="small"
              :title="i18n.deleteWebsite || '删除'"
              @click="deleteEntry(entry.id)"
            />
          </div>
        </div>
      </div>

      <div
        v-if="filteredEntries.length === 0"
        class="empty-state"
      >
        <IconWrapper
          name="link"
          :size="48"
        />
        <p>{{ searchQuery ? '未找到匹配的网站' : i18n.noWebsites || '暂无网站，点击添加' }}</p>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showDialog"
          class="website-dialog-overlay"
          @click.self="closeDialog"
        >
          <Transition name="scale">
            <div
              v-if="showDialog"
              class="website-dialog"
              @click.stop
            >
              <div class="dialog-header">
                <h3>{{ editingEntry ? i18n.editWebsite || '编辑网站' : i18n.addWebsite || '添加网站' }}</h3>
                <Button
                  icon="close"
                  variant="ghost"
                  size="small"
                  @click="closeDialog"
                />
              </div>
              <div class="dialog-body">
                <div class="form-group">
                  <label>{{ i18n.name || '名称' }}</label>
                  <Input
                    v-model="form.name"
                    type="text"
                    :placeholder="i18n.namePlaceholder || '网站名称'"
                    required
                  />
                </div>
                <div class="form-group">
                  <label>{{ i18n.url || '网址' }}</label>
                  <Input
                    v-model="form.url"
                    type="text"
                    :placeholder="i18n.urlPlaceholder || 'https://example.com'"
                    required
                  />
                </div>
                <div class="form-group">
                  <label>{{ i18n.category || '类别' }}</label>
                  <Select
                    v-model="form.category"
                    :options="categories.map(c => ({
                      value: c.id,
                      label: c.name,
                    }))"
                  />
                </div>
                <div class="form-group">
                  <label>{{ i18n.description || '描述' }}</label>
                  <Input
                    v-model="form.description"
                    type="text"
                    :placeholder="i18n.descriptionPlaceholder || '备注描述'"
                  />
                </div>
              </div>
              <div class="dialog-footer">
                <Button
                  variant="ghost"
                  @click="closeDialog"
                >
                  {{ i18n.cancel || '取消' }}
                </Button>
                <Button
                  variant="primary"
                  :disabled="!form.name.trim() || !form.url.trim()"
                  @click="saveEntry"
                >
                  {{ i18n.save || '保存' }}
                </Button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showCategoryMgr"
          class="website-dialog-overlay"
          @click.self="closeCategoryMgr"
        >
          <Transition name="scale">
            <div
              v-if="showCategoryMgr"
              class="website-dialog category-manager"
              @click.stop
            >
              <div class="dialog-header">
                <h3>{{ i18n.manageCategories || '管理类别' }}</h3>
                <Button
                  icon="close"
                  variant="ghost"
                  size="small"
                  @click="closeCategoryMgr"
                />
              </div>
              <div class="dialog-body">
                <div class="add-category-row">
                  <Input
                    v-model="newCatName"
                    type="text"
                    :placeholder="i18n.categoryName || '类别名称'"
                    size="small"
                  />
                  <div class="color-picker">
                    <button
                      v-for="color in presetColors"
                      :key="color"
                      class="color-option"
                      :class="{ selected: newCatColor === color }"
                      :style="{ backgroundColor: color }"
                      @click="newCatColor = color"
                    />
                  </div>
                  <Button
                    icon="add"
                    variant="primary"
                    size="small"
                    :disabled="!newCatName.trim()"
                    @click="addCategory"
                  >
                    {{ i18n.add || '添加' }}
                  </Button>
                </div>
                <div class="category-list">
                  <div
                    v-for="cat in categories"
                    :key="cat.id"
                    class="category-row"
                  >
                    <span
                      class="cat-dot"
                      :style="{ backgroundColor: cat.color }"
                    ></span>
                    <span class="cat-name">{{ cat.name }}</span>
                    <Button
                      v-if="cat.id !== 'default'"
                      icon="delete"
                      variant="ghost"
                      size="small"
                      @click="removeCategory(cat.id)"
                    />
                    <span
                      v-else
                      class="default-badge"
                    >默认</span>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
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
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
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
const form = ref({
  name: "",
  url: "",
  category: "default",
  description: "",
})

const showCategoryMgr = ref(false)
const newCatName = ref("")
const newCatColor = ref("#3b82f6")

const presetColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#b0aea5",
]

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
  form.value = {
    name: "",
    url: "",
    category: "default",
    description: "",
  }
  showDialog.value = true
}

const editEntry = (entry: WebsiteEntry) => {
  editingEntry.value = entry
  form.value = {
    name: entry.name,
    url: entry.url,
    category: entry.category,
    description: entry.description,
  }
  showDialog.value = true
}

const closeDialog = () => {
  showDialog.value = false
  editingEntry.value = null
}

const saveEntry = async () => {
  if (!form.value.name.trim() || !form.value.url.trim()) return

  try {
    if (editingEntry.value) {
      await storage.updateEntry(editingEntry.value.id, form.value)
      showMessage(props.i18n.updateSuccess || "网站已更新", 2000, "info")
    } else {
      await storage.createEntry(form.value)
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
  window.open(url, "_blank")
}

const copyUrl = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url)
    showMessage(props.i18n.urlCopied || "网址已复制", 2000, "info")
  } catch {
    showMessage(props.i18n.copyUrl || "复制失败", 2000, "error")
  }
}

const addCategory = async () => {
  if (!newCatName.value.trim()) return
  if (categories.value.some((c) => c.name === newCatName.value.trim())) {
    showMessage("类别已存在", 2000, "error")
    return
  }

  const cat: WebsiteCategory = {
    id: Date.now().toString(),
    name: newCatName.value.trim(),
    color: newCatColor.value,
  }
  categories.value = [...categories.value, cat]
  await storage.saveCategories(categories.value)
  newCatName.value = ""
  newCatColor.value = "#3b82f6"
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

const closeCategoryMgr = () => {
  showCategoryMgr.value = false
  newCatName.value = ""
  newCatColor.value = "#3b82f6"
}
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
