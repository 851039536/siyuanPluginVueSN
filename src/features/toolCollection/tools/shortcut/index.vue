<!-- 快捷键面板主组件：工具栏 + 分组卡片网格 + 增改 / 删除 / 重置对话框编排 -->
<template>
  <div class="shortcut-panel">
    <PanelHeader
      v-model:search-keyword="searchKeyword"
      v-model:active-category="activeCategory"
      :categories="categories"
      :get-category-label="getCategoryLabel"
      :get-category-count="getCategoryCount"
      :total-count="totalCount"
      :visible-count="visibleCount"
      :i18n="i18n"
      @add="showAddDialog"
      @import="handleImport"
      @export="exportCustomShortcuts"
      @reset="showResetConfirm = true"
    />

    <ShortcutList
      :shortcuts="filteredShortcuts"
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

    <!-- 重置确认：清空自定义快捷键 -->
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
      :groups="groupOptions"
      :i18n="i18n"
      @close="closeDialog"
      @confirm="handleDialogConfirm"
      @error="handleDialogError"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { ShortcutInfo } from "./types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import { pushMsg } from "@/api"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { ensureShortcutData } from "./bootstrap"
import PanelHeader from "./components/PanelHeader.vue"
import ShortcutDialog from "./components/ShortcutDialog.vue"
import ShortcutList from "./components/ShortcutList.vue"
import { useShortcutData } from "./composables/useShortcutData"
import { useShortcutFilter } from "./composables/useShortcutFilter"
import { listGroups } from "./utils"

interface Props {
  /** 全局 i18n 对象（工具合集容器注入，扁平键命名空间） */
  i18n: Record<string, string>
  /** 插件实例：`ensureShortcutData` 构造存储适配器时必需（工具合集容器恒注入） */
  plugin: Plugin
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

// ==================== 数据层（响应式镜像 + 增删改 + 导入导出） ====================
const {
  allShortcuts,
  presetIds,
  init,
  copyShortcut,
  saveCustomShortcut,
  deleteCustomShortcut,
  exportCustomShortcuts,
  importCustomShortcuts,
  resetAll,
} = useShortcutData({ i18n: props.i18n })

// ==================== 筛选管道 ====================
const {
  searchKeyword,
  activeCategory,
  categories,
  filteredShortcuts,
  totalCount,
  visibleCount,
  getCategoryLabel,
  getCategoryCount,
} = useShortcutFilter({
  shortcuts: allShortcuts,
  i18n: props.i18n,
})

/** 现有分组名（新增 / 编辑对话框的「分组」下拉选项来源） */
const groupOptions = computed(() => listGroups(allShortcuts.value))

// ==================== 视图状态 ====================
const showDialog = ref(false)
const editingShortcut = ref<ShortcutInfo | null>(null)
const deleteConfirmId = ref<string | null>(null)
const showResetConfirm = ref(false)

onMounted(async () => {
  // 数据初始化是幂等的（切走再切回不会重复读盘）：先确保预置与自定义段就绪，再取一次响应式镜像
  await ensureShortcutData(props.plugin)
  init()
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
