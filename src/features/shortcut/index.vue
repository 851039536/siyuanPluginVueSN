<!-- 快捷键面板主组件：搜索、分类筛选、收藏/最近过滤、网格展示、增删改查 -->
<template>
  <div class="shortcut-panel">
    <!-- 顶部操作栏 -->
    <PanelHeader
      v-model:search-keyword="searchKeyword"
      v-model:active-tab="activeTab"
      v-model:active-filter="activeFilter"
      :placeholder="i18n.searchPlaceholder"
      :add-title="i18n.addCustomShortcut"
      :filter-favorite-label="i18n.filterFavorite"
      :filter-recent-label="i18n.filterRecent"
      :tabs="tabs"
      :total-count="totalCount"
      :get-category-label="getCategoryLabel"
      :get-tab-count="getTabCount"
      @add="showAddDialog"
    />

    <!-- 快捷键列表 -->
    <ShortcutGrid
      :shortcuts="filteredShortcuts"
      :is-favorite="isFavorite"
      :is-recent="isRecent"
      :get-category-label="getCategoryLabel"
      :show-tool-badge="showToolBadge"
      :i18n="i18n"
      @toggle-favorite="toggleFavorite"
      @copy="copyShortcutInfo"
      @edit="editShortcut"
      @delete="requestDelete"
    />

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      :visible="deleteConfirmId !== null"
      :title="i18n.confirmDelete"
      :message="i18n.confirmDeleteMsg"
      :confirm-text="i18n.delete"
      :cancel-text="i18n.cancel"
      @close="cancelDelete"
      @confirm="confirmDelete"
    />

    <!-- 添加/编辑快捷键对话框 -->
    <ShortcutDialog
      :visible="showDialog"
      :is-edit="editingShortcut !== null"
      :initial="editingShortcut"
      :i18n="i18n"
      @close="closeDialog"
      @confirm="addShortcut"
      @error="handleDialogError"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  ShortcutInfo,
} from "./types"
import {
  CATEGORY_LABEL_I18N_KEYS,
  TOOL_CATEGORIES,
} from "./types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import { pushMsg } from "@/api"
import { copyToClipboard } from "@/utils/domUtils"
import ConfirmDialog from "./components/ConfirmDialog.vue"
import PanelHeader from "./components/PanelHeader.vue"
import ShortcutDialog from "./components/ShortcutDialog.vue"
import ShortcutGrid from "./components/ShortcutGrid.vue"
import { getShortcutManager } from "./manager"
import { ShortcutStorage } from "./types/storage"

interface Props {
  i18n: Record<string, string>
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

// 状态
const searchKeyword = ref("")
const activeTab = ref("all")
const activeFilter = ref("all")

const showDialog = ref(false)
const editingShortcut = ref<ShortcutInfo | null>(null)
const favorites = ref<Set<string>>(new Set())
const recentUsedMap = ref<Map<string, number>>(new Map())
const deleteConfirmId = ref<string | null>(null)

// 存储实例（惰性单例，避免每次访问重建）
let storage: ShortcutStorage | null = null
function getStorage(): ShortcutStorage | null {
  if (!props.plugin) return null
  if (!storage) {
    storage = new ShortcutStorage(props.plugin)
  }
  return storage
}

// 获取快捷键管理器
const manager = getShortcutManager()

// 总数统计
const totalCount = computed(() => manager.getAllShortcuts().length)

// 初始化：加载收藏与最近使用
onMounted(async () => {
  const storageInstance = getStorage()
  if (!storageInstance) return
  try {
    const [loadedFavorites, loadedRecent] = await Promise.all([
      storageInstance.loadFavorites(),
      storageInstance.loadRecent(),
    ])
    favorites.value = new Set(loadedFavorites)
    // recentUsed 使用 Map<id, timestamp> 实现 O(1) 查找
    recentUsedMap.value = new Map()
    const now = Date.now()
    loadedRecent.forEach((id, idx) => {
      recentUsedMap.value.set(id, now - (loadedRecent.length - idx) * 1000)
    })
  } catch (error) {
    console.error("初始化数据失败:", error)
    favorites.value = new Set()
    recentUsedMap.value = new Map()
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

const categoryLabels = computed(() => {
  const result: Record<string, string> = {}
  for (const [cat, i18nKey] of Object.entries(CATEGORY_LABEL_I18N_KEYS)) {
    result[cat] = props.i18n[i18nKey]
  }
  return result
})

function getCategoryLabel(category: string): string {
  return categoryLabels.value[category]
}

function showToolBadge(category: string): boolean {
  return (TOOL_CATEGORIES as readonly string[]).includes(category)
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
    shortcuts = shortcuts.filter((s) => recentUsedMap.value.has(s.id))
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

  const storageInstance = getStorage()
  if (storageInstance) {
    try {
      await storageInstance.saveFavorites(Array.from(favorites.value))
    } catch (error) {
      console.error("保存收藏状态失败:", error)
    }
  }
}

function isRecent(id: string): boolean {
  return recentUsedMap.value.has(id)
}

async function addToRecent(id: string) {
  recentUsedMap.value.set(id, Date.now())
  // 保持最多 10 条：超过时清理最旧条目
  if (recentUsedMap.value.size > 10) {
    const sorted = Array.from(recentUsedMap.value.entries())
      .sort(([, a], [, b]) => a - b)
    for (let i = 0; i < sorted.length - 10; i++) {
      recentUsedMap.value.delete(sorted[i][0])
    }
  }

  const storageInstance = getStorage()
  if (storageInstance) {
    try {
      const ordered = Array.from(recentUsedMap.value.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([id]) => id)
      await storageInstance.saveRecent(ordered)
    } catch (error) {
      console.error("保存最近使用失败:", error)
    }
  }
}

async function copyShortcutInfo(shortcut: ShortcutInfo) {
  const text = shortcut.copyContent || shortcut.keys
  const ok = await copyToClipboard(text)
  if (ok) {
    addToRecent(shortcut.id)
    pushMsg(props.i18n.copiedSuccess)
  }
}

// 对话框操作
function showAddDialog() {
  editingShortcut.value = null
  showDialog.value = true
}

function editShortcut(shortcut: ShortcutInfo) {
  editingShortcut.value = shortcut
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  editingShortcut.value = null
}

async function addShortcut(shortcut: ShortcutInfo) {
  await manager.addShortcut(shortcut)
  closeDialog()
}

function handleDialogError(msg: string) {
  console.warn("[ShortcutDialog]", msg)
}

function requestDelete(id: string) {
  deleteConfirmId.value = id
}

function cancelDelete() {
  deleteConfirmId.value = null
}

async function confirmDelete() {
  const id = deleteConfirmId.value
  if (!id) return
  const removed = await manager.removeShortcut(id)
  if (!removed) {
    deleteConfirmId.value = null
    return
  }
  favorites.value.delete(id)
  recentUsedMap.value.delete(id)
  const storageInstance = getStorage()
  if (storageInstance) {
    try {
      await Promise.all([
        storageInstance.saveFavorites(Array.from(favorites.value)),
        storageInstance.saveRecent(Array.from(recentUsedMap.value.keys())),
      ])
    } catch (error) {
      console.error("更新存储数据失败:", error)
    }
  }
  deleteConfirmId.value = null
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
