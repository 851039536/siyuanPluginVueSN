<template>
  <div class="shortcut-panel">
    <!-- 顶部操作栏 -->
    <PanelHeader
      v-model:search-keyword="searchKeyword"
      :placeholder="i18n.searchPlaceholder || '搜索快捷键...'"
      :add-title="i18n.addCustomShortcut || '添加快捷键'"
      @add="showAddDialog"
    />

    <!-- 统计 + 筛选 + 视图切换 -->
    <FilterBar
      v-model:active-filter="activeFilter"
      v-model:view-mode="viewMode"
      :filters="QUICK_FILTERS"
      :total-count="totalCount"
      :favorite-count="favoriteCount"
      :custom-count="customCount"
      :total-label="i18n.total || '总计'"
      :favorite-label="i18n.favorite || '收藏'"
      :custom-label="i18n.custom || '自定义'"
    />

    <!-- 分类选择器 -->
    <CategorySelector
      v-model:active-tab="activeTab"
      v-model:category-search="categorySearch"
      :tabs="tabs"
      :get-category-label="getCategoryLabel"
      :get-tab-count="getTabCount"
      :category-label="i18n.category || '分类:'"
      :search-placeholder="i18n.searchCategory || '搜索分类...'"
      :no-result-hint="i18n.noCategoryFound || '未找到匹配的分类'"
    />

    <!-- 快捷键列表 -->
    <ShortcutGrid
      :shortcuts="filteredShortcuts"
      :view-mode="viewMode"
      :is-favorite="isFavorite"
      :is-recent="isRecent"
      :get-category-label="getCategoryLabel"
      :show-tool-badge="showToolBadge"
      :empty-text="i18n.noResults || '未找到快捷键'"
      :favorite-title="i18n.favorite || '收藏'"
      :un-favorite-title="i18n.unFavorite || '取消收藏'"
      :copy-title="i18n.copy || '复制'"
      :edit-title="i18n.edit || '编辑'"
      :delete-title="i18n.delete || '删除'"
      :other-group-label="i18n.other || '其他'"
      @toggle-favorite="toggleFavorite"
      @copy="copyShortcutInfo"
      @edit="editShortcut"
      @delete="deleteShortcut"
    />

    <!-- 数据存储路径（底部折叠） -->
    <div
      class="storage-path-footer"
      :class="{ expanded: showStoragePath }"
    >
      <button
        class="storage-path-toggle"
        @click="showStoragePath = !showStoragePath"
      >
        <svg
          class="toggle-arrow"
          viewBox="0 0 12 12"
          fill="currentColor"
        ><path d="M2 4l4 4 4-4" /></svg>
        <span>{{ i18n.dataPath || '数据路径' }}</span>
      </button>
      <div
        v-if="showStoragePath"
        class="storage-path-content"
      >
        <code
          v-for="key in STORAGE_KEYS"
          :key="key"
          class="storage-file"
          :title="`${storageDir}/${key}.json`"
          @click="copyStoragePath(`${storageDir}/${key}.json`)"
        >{{ storageDir }}/<wbr>{{ key }}.json</code>
      </div>
    </div>

    <!-- 添加/编辑快捷键对话框 -->
    <ShortcutDialog
      :visible="showDialog && (dialogType === 'add' || dialogType === 'edit')"
      :is-edit="dialogType === 'edit'"
      :form-data="formData"
      :title-label="i18n.addCustomShortcut || '添加快捷键'"
      :edit-title-label="i18n.editShortcut || '编辑快捷键'"
      :name-label="i18n.shortcutName || '快捷键名称'"
      :name-placeholder="i18n.enterName || '输入快捷键名称'"
      :desc-label="i18n.description || '描述'"
      :desc-placeholder="i18n.enterDescription || '输入功能描述'"
      :keys-label="i18n.shortcutKeys || '快捷键'"
      :keys-placeholder="i18n.keysPlaceholder || '例如: Ctrl+K'"
      :group-label="i18n.group || '分组'"
      :group-placeholder="i18n.enterGroup || '输入分组名称'"
      :cancel-text="i18n.cancel || '取消'"
      :confirm-text="i18n.confirm || '确认'"
      :fill-required-text="i18n.fillRequired || '请填写必填项'"
      @close="closeDialog"
      @confirm="addShortcut"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  DialogType,
  QuickFilter,
  ShortcutFormData,
  ShortcutInfo,
  ViewMode,
} from "./types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import CategorySelector from "./components/CategorySelector.vue"
import FilterBar from "./components/FilterBar.vue"
import PanelHeader from "./components/PanelHeader.vue"
import ShortcutDialog from "./components/ShortcutDialog.vue"
import ShortcutGrid from "./components/ShortcutGrid.vue"
import { getShortcutManager } from "./manager"
import {
  SHORTCUTS_FAVORITES_KEY,
  SHORTCUTS_RECENT_KEY,
  SHORTCUTS_STORAGE_KEY,
  ShortcutStorage,
} from "./types/storage"

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

const QUICK_FILTERS: QuickFilter[] = [
  {
    key: "all",
    label: "全部",
  },
  {
    key: "favorite",
    label: "收藏",
  },
  {
    key: "recent",
    label: "最近使用",
  },
]

interface Props {
  i18n?: Record<string, any>
  plugin?: any
}

// 状态
const searchKeyword = ref("")
const activeTab = ref("all")
const activeFilter = ref("all")
const viewMode = ref<ViewMode>("grid")
const categorySearch = ref("")
const showDialog = ref(false)
const dialogType = ref<DialogType>(null)
const favorites = ref<Set<string>>(new Set())
const recentUsed = ref<string[]>([])

// 表单数据
const formData = ref<ShortcutFormData>({
  id: "",
  name: "",
  description: "",
  keys: "",
  group: "自定义",
})

// 数据存储路径
const STORAGE_KEYS = [SHORTCUTS_STORAGE_KEY, SHORTCUTS_FAVORITES_KEY, SHORTCUTS_RECENT_KEY]
const storageDir = "data/storage/petals/siyuan-plugin-vite-vue-sn"
const showStoragePath = ref(false)

function copyStoragePath(path: string) {
  navigator.clipboard.writeText(path).catch(() => {})
}

// 获取快捷键管理器
const manager = getShortcutManager()
const storage = computed(() => props.plugin ? new ShortcutStorage(props.plugin) : null)

// 统计信息
const totalCount = computed(() => manager.getAllShortcuts().length)
const favoriteCount = computed(() => favorites.value.size)
const customCount = computed(() => manager.getByCategory("custom").length)

// 初始化
onMounted(async () => {
  if (storage.value) {
    try {
      const [loadedFavorites, loadedRecent] = await Promise.all([
        storage.value.loadFavorites(),
        storage.value.loadRecent(),
      ])
      favorites.value = new Set(loadedFavorites)
      recentUsed.value = loadedRecent
    } catch (error) {
      console.error("初始化数据失败:", error)
      favorites.value = new Set()
      recentUsed.value = []
    }
  }
})

// 获取所有分类
const tabs = computed(() => {
  const allShortcuts = manager.getAllShortcuts()
  const categories = new Set(allShortcuts.map((s) => s.category))
  return ["all", ...Array.from(categories).sort()]
})

function getTabCount(category: string): number {
  if (category === "all") return totalCount.value
  return manager.getByCategory(category).length
}

const categoryLabels = computed(() => ({
  "all": props.i18n.allShortcuts || "全部",
  "siyuan": props.i18n.siyuanShortcuts || "思源笔记",
  "plugin": props.i18n.pluginShortcuts || "插件快捷键",
  "claude": props.i18n.claudeShortcuts || "Claude Code",
  "openspec": props.i18n.openspecShortcuts || "OpenSpec",
  "npm": props.i18n.npmShortcuts || "NPM",
  "nvm": props.i18n.nvmShortcuts || "NVM",
  "cmd": props.i18n.cmdShortcuts || "Windows CMD",
  "vscode": props.i18n.vscodeShortcuts || "VS Code",
  "visual-studio": props.i18n.visualStudioShortcuts || "Visual Studio",
  "custom": props.i18n.customShortcuts || "自定义",
}))

function getCategoryLabel(category: string): string {
  return categoryLabels.value[category] || category
}

function showToolBadge(category: string): boolean {
  return ["npm", "nvm", "cmd", "vscode", "visual-studio"].includes(category)
}

// 过滤快捷键
const filteredShortcuts = computed(() => {
  let shortcuts = searchKeyword.value
    ? manager.search(searchKeyword.value)
    : manager.getAllShortcuts()

  if (activeTab.value !== "all") {
    shortcuts = shortcuts.filter((s) => s.category === activeTab.value)
  }

  if (activeFilter.value === "favorite") {
    shortcuts = shortcuts.filter((s) => favorites.value.has(s.id))
  } else if (activeFilter.value === "recent") {
    shortcuts = shortcuts.filter((s) => recentUsed.value.includes(s.id))
  }

  return shortcuts
})

function isFavorite(id: string): boolean {
  return favorites.value.has(id)
}

async function toggleFavorite(id: string) {
  if (favorites.value.has(id)) {
    favorites.value.delete(id)
  } else {
    favorites.value.add(id)
  }

  if (storage.value) {
    try {
      await storage.value.saveFavorites(Array.from(favorites.value))
    } catch (error) {
      console.error("保存收藏状态失败:", error)
    }
  }
}

function isRecent(id: string): boolean {
  return recentUsed.value.includes(id)
}

async function addToRecent(id: string) {
  const index = recentUsed.value.indexOf(id)
  if (index > -1) recentUsed.value.splice(index, 1)
  recentUsed.value.unshift(id)
  if (recentUsed.value.length > 10) recentUsed.value.pop()

  if (storage.value) {
    try {
      await storage.value.saveRecent(recentUsed.value)
    } catch (error) {
      console.error("保存最近使用失败:", error)
    }
  }
}

function copyShortcutInfo(shortcut: ShortcutInfo) {
  const text = shortcut.copyContent || shortcut.keys
  navigator.clipboard
    .writeText(text)
    .then(() => {
      addToRecent(shortcut.id)
    })
    .catch((err) => {
      console.error("复制失败:", err)
    })
}

// 对话框操作
function showAddDialog() {
  dialogType.value = "add"
  formData.value = {
    id: "",
    name: "",
    description: "",
    keys: "",
    group: "自定义",
  }
  showDialog.value = true
}

function editShortcut(shortcut: ShortcutInfo) {
  dialogType.value = "edit"
  formData.value = {
    id: shortcut.id,
    name: shortcut.name,
    description: shortcut.description,
    keys: shortcut.keys,
    group: shortcut.group || "自定义",
  }
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  dialogType.value = null
}

async function addShortcut(shortcut: ShortcutInfo) {
  await manager.addShortcut(shortcut)
  closeDialog()
}

async function deleteShortcut(id: string) {
  if (confirm(props.i18n.confirmDelete || "确认删除此快捷键？")) {
    await manager.removeShortcut(id)
    favorites.value.delete(id)
    const index = recentUsed.value.indexOf(id)
    if (index > -1) recentUsed.value.splice(index, 1)

    if (storage.value) {
      try {
        await storage.value.saveFavorites(Array.from(favorites.value))
      } catch (error) {
        console.error("更新收藏数据失败:", error)
      }
    }
  }
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
