<!-- 快捷键面板主组件：搜索、分类筛选、快捷过滤、网格展示、增删改查 -->
<template>
  <div class="shortcut-panel">
    <!-- 顶部操作栏 -->
    <PanelHeader
      v-model:search-keyword="searchKeyword"
      v-model:active-tab="activeTab"
      v-model:active-filter="activeFilter"
      v-model:view-mode="viewMode"
      :placeholder="i18n.searchPlaceholder || '搜索快捷键...'"
      :add-title="i18n.addCustomShortcut || '添加快捷键'"
      :filters="QUICK_FILTERS"
      :tabs="tabs"
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
      @delete="requestDelete"
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

    <!-- 删除确认对话框（全屏 Modal） -->
    <div
      v-if="deleteConfirmId"
      class="delete-confirm-overlay"
      @click="cancelDelete"
    >
      <div
        class="delete-confirm-dialog"
        @click.stop
      >
        <div class="delete-modal-header">
          <div class="delete-modal-title">
            {{ i18n.confirmDelete || '确认删除此快捷键？' }}
          </div>
        </div>
        <div class="delete-modal-body">
          <p>{{ i18n.confirmDeleteMsg || '此操作不可撤销。' }}</p>
        </div>
        <div class="delete-modal-footer">
          <Button
            variant="secondary"
            size="xsmall"
            @click="cancelDelete"
          >
            {{ i18n.cancel || '取消' }}
          </Button>
          <Button
            variant="danger"
            size="xsmall"
            @click="confirmDelete"
          >
            {{ i18n.delete || '删除' }}
          </Button>
        </div>
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
      @error="handleDialogError"
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
  CATEGORY_LABEL_I18N_KEYS,
  TOOL_CATEGORIES,
} from "./types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import { copyToClipboard } from "@/utils/domUtils"
import PanelHeader from "./components/PanelHeader.vue"
import ShortcutDialog from "./components/ShortcutDialog.vue"
import ShortcutGrid from "./components/ShortcutGrid.vue"
import { getShortcutManager } from "./manager"
import {
  SHORTCUTS_ALL_KEY,
  SHORTCUTS_FAVORITES_KEY,
  SHORTCUTS_RECENT_KEY,
  ShortcutStorage,
} from "./types/storage"

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

const QUICK_FILTERS: QuickFilter[] = [
  {
    key: "all",
    label: props.i18n.filterAll || "全部",
  },
  {
    key: "favorite",
    label: props.i18n.filterFavorite || "收藏",
  },
  {
    key: "recent",
    label: props.i18n.filterRecent || "最近使用",
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

const showDialog = ref(false)
const dialogType = ref<DialogType>(null)
const favorites = ref<Set<string>>(new Set())
const recentUsedMap = ref<Map<string, number>>(new Map())

// 表单数据
const formData = ref<ShortcutFormData>({
  id: "",
  name: "",
  description: "",
  keys: "",
  group: "自定义",
})

// 数据存储路径
const STORAGE_KEYS = [SHORTCUTS_ALL_KEY, SHORTCUTS_FAVORITES_KEY, SHORTCUTS_RECENT_KEY]
const storageDir = computed(() => {
  if (props.plugin) {
    return (props.plugin as any).dataDir || "data/storage/petals/siyuan-plugin-vite-vue-sn"
  }
  return "data/storage/petals/siyuan-plugin-vite-vue-sn"
})
const showStoragePath = ref(false)
const deleteConfirmId = ref<string | null>(null)

async function copyStoragePath(path: string) {
  await copyToClipboard(path)
}

// 获取快捷键管理器
const manager = getShortcutManager()
const storage = computed(() => props.plugin ? new ShortcutStorage(props.plugin) : null)

// 统计信息
const totalCount = computed(() => manager.getAllShortcuts().length)

// 初始化
onMounted(async () => {
  if (storage.value) {
    try {
      const [loadedFavorites, loadedRecent] = await Promise.all([
        storage.value.loadFavorites(),
        storage.value.loadRecent(),
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
    result[cat] = props.i18n[i18nKey] || cat
  }
  return result
})

function getCategoryLabel(category: string): string {
  return categoryLabels.value[category] || category
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

  if (storage.value) {
    try {
      await storage.value.saveFavorites(Array.from(favorites.value))
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

  if (storage.value) {
    try {
      const ordered = Array.from(recentUsedMap.value.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([id]) => id)
      await storage.value.saveRecent(ordered)
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
    console.log(props.i18n.copiedSuccess || "Copied to clipboard")
  }
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
  if (storage.value) {
    try {
      await Promise.all([
        storage.value.saveFavorites(Array.from(favorites.value)),
        storage.value.saveRecent(Array.from(recentUsedMap.value.keys())),
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
@use "./styles/DeleteConfirmDialog.scss";
</style>
