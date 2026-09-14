<!-- 快捷键面板主组件：工具栏 + 紧凑列表 + 增改 / 删除 / 重置对话框编排 -->
<template>
  <div class="shortcut-panel">
    <PanelHeader
      v-model:search-keyword="searchKeyword"
      v-model:active-category="activeCategory"
      :active-filter="activeFilter"
      :categories="categories"
      :get-category-label="getCategoryLabel"
      :get-category-count="getCategoryCount"
      :total-count="totalCount"
      :visible-count="visibleCount"
      :conflict-count="conflictCount"
      :i18n="i18n"
      @toggle-filter="toggleFilter"
      @add="showAddDialog"
      @import="handleImport"
      @export="exportCustomShortcuts"
      @reset="showResetConfirm = true"
    />

    <ShortcutList
      :shortcuts="filteredShortcuts"
      :recent-ids="recentIdSet"
      :conflict-map="conflictMap"
      :preset-ids="presetIds"
      :get-category-label="getCategoryLabel"
      :i18n="i18n"
      @copy="copyShortcut"
      @edit="editShortcut"
      @delete="requestDelete"
    />

    <!-- 删除确认（仅自定义项可触发） -->
    <ConfirmDialog
      :visible="deleteConfirmId !== null"
      :header="i18n.confirmDelete"
      :message="i18n.confirmDeleteMsg"
      :accept-label="i18n.delete"
      :reject-label="i18n.cancel"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />

    <!-- 重置确认：清空自定义 + 最近使用 -->
    <ConfirmDialog
      :visible="showResetConfirm"
      :header="i18n.scReset"
      :message="i18n.scResetConfirmMsg"
      :accept-label="i18n.confirm"
      :reject-label="i18n.cancel"
      @cancel="showResetConfirm = false"
      @confirm="confirmReset"
    />

    <!-- 添加 / 编辑对话框 -->
    <ShortcutDialog
      :visible="showDialog"
      :initial="editingShortcut"
      :i18n="i18n"
      @close="closeDialog"
      @confirm="handleDialogConfirm"
      @error="handleDialogError"
    />
  </div>
</template>

<script setup lang="ts">
import type { ShortcutInfo } from "./types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import { pushMsg } from "@/api"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import PanelHeader from "./components/PanelHeader.vue"
import ShortcutDialog from "./components/ShortcutDialog.vue"
import ShortcutList from "./components/ShortcutList.vue"
import { useShortcutData } from "./composables/useShortcutData"
import { useShortcutFilter } from "./composables/useShortcutFilter"

interface Props {
  i18n: Record<string, string>
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

// ==================== 数据层（响应式镜像 + 增删改 + 导入导出） ====================
const {
  allShortcuts,
  recentIds,
  presetIds,
  conflictMap,
  conflictIds,
  init,
  copyShortcut,
  saveCustomShortcut,
  deleteCustomShortcut,
  exportCustomShortcuts,
  importCustomShortcuts,
  resetAll,
} = useShortcutData({ plugin: props.plugin, i18n: props.i18n })

// ==================== 筛选管道 ====================
const {
  searchKeyword,
  activeCategory,
  activeFilter,
  categories,
  filteredShortcuts,
  totalCount,
  visibleCount,
  getCategoryLabel,
  getCategoryCount,
  toggleFilter,
} = useShortcutFilter({
  shortcuts: allShortcuts,
  recentIds,
  conflictIds,
  i18n: props.i18n,
})

/** 最近使用镜像为 Set，供列表 O(1) 判定 */
const recentIdSet = computed(() => new Set(recentIds.value))
/** 存在冲突的条目数（筛选按钮角标） */
const conflictCount = computed(() => conflictIds.value.size)

// ==================== 视图状态 ====================
const showDialog = ref(false)
const editingShortcut = ref<ShortcutInfo | null>(null)
const deleteConfirmId = ref<string | null>(null)
const showResetConfirm = ref(false)

onMounted(() => {
  void init()
})

// ==================== 增改 ====================
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

async function handleDialogConfirm(shortcut: ShortcutInfo) {
  await saveCustomShortcut(shortcut)
  closeDialog()
}

/** 表单校验失败：错误提示已在对话框内就地展示，此处仅记录 */
function handleDialogError(message: string) {
  console.warn("[shortcut] 表单校验失败:", message)
}

// ==================== 删除 ====================
function requestDelete(id: string) {
  deleteConfirmId.value = id
}

function cancelDelete() {
  deleteConfirmId.value = null
}

async function confirmDelete() {
  const id = deleteConfirmId.value
  deleteConfirmId.value = null
  if (!id) return
  const removed = await deleteCustomShortcut(id)
  if (!removed) {
    pushMsg(props.i18n.scSaveFailed, 3000, "error")
  }
}

// ==================== 导入 / 导出 / 重置 ====================
async function handleImport(file: File) {
  try {
    const summary = await importCustomShortcuts(await file.text())
    if (!summary) return
    pushMsg(
      `${props.i18n.scImportAdded} ${summary.added} · ${props.i18n.scImportUpdated} ${summary.updated} · ${props.i18n.scImportIgnored} ${summary.ignored}`,
      5000,
    )
  } catch (error) {
    console.error("[shortcut] 读取导入文件失败:", error)
    pushMsg(props.i18n.scImportInvalidJson, 4000, "error")
  }
}

async function confirmReset() {
  showResetConfirm.value = false
  await resetAll()
  pushMsg(props.i18n.scResetDone)
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
