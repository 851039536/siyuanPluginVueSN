<!-- S3 文件管理器主面板 — 编排工具栏/面包屑/列表/右键菜单/各弹窗与传输进度 -->
<template>
  <div class="fm-panel">
    <!-- 头部：标题 + 关闭 -->
    <div class="fm-header">
      <!-- 标题："S3 文件管理" -->
      <span class="fm-header-title">{{ i18n.s3FileManager }}</span>
      <Button
        variant="ghost"
        size="xsmall"
        icon="close"
        :icon-size="14"
        @click="handleClose"
      />
    </div>

    <!-- 未配置引导空态 -->
    <div
      v-if="!isConfigured"
      class="fm-empty-config"
    >
      <IconWrapper
        name="s3FileManager"
        :size="40"
      />
      <!-- 引导："尚未配置 S3 连接，请先完成配置" -->
      <p>{{ i18n.notConfiguredGuide }}</p>
      <Button
        variant="primary"
        size="small"
        icon="settings"
        @click="showConfig = true"
      >
        {{ i18n.configTitle }}
      </Button>
    </div>

    <!-- 已配置：主体 -->
    <template v-else>
      <FmToolbar
        :is-configured="isConfigured"
        :busy="busy"
        :selected-count="selectedCount"
        :view-mode="prefs.viewMode"
        :i18n="i18n"
        @upload="handleUpload"
        @new-folder="showNewFolder = true"
        @download="handleDownload"
        @copy="openMoveCopy('copy')"
        @move="openMoveCopy('move')"
        @rename="openRename"
        @delete="handleDelete"
        @set-view="setViewMode"
        @open-log="showLog = true"
        @open-config="showConfig = true"
      />

      <FmBreadcrumb
        :path-segments="pathSegments"
        :bucket-label="s3Config.bucket"
        :is-at-root="isAtRoot"
        :loading="loading"
        :item-count="sortedEntries.length"
        :i18n="i18n"
        @navigate-up="navigateUp"
        @navigate-segment="navigateToSegment"
        @refresh="refresh"
      />

      <!-- 浏览区：外部文件/文件夹拖入即上传到当前目录 -->
      <div
        class="fm-browse"
        @dragenter="externalDrop.onDragEnter"
        @dragover="externalDrop.onDragOver"
        @dragleave="externalDrop.onDragLeave"
        @drop="externalDrop.onDrop"
      >
        <!-- 传输进度条 -->
        <div
          v-if="transferProgress"
          class="fm-progress"
        >
          <div class="fm-progress-info">
            <span class="fm-progress-label">{{ transferProgress.label }}</span>
            <span class="fm-progress-file">{{ transferProgress.currentFile }}</span>
            <span class="fm-progress-count">{{ transferProgress.done }} / {{ transferProgress.total }}</span>
          </div>
          <div class="fm-progress-bar">
            <div
              class="fm-progress-fill"
              :style="{ width: `${transferProgress.percent}%` }"
            />
          </div>
        </div>

        <!-- 批量操作进度条 -->
        <div
          v-if="opProgress"
          class="fm-progress"
        >
          <div class="fm-progress-info">
            <span class="fm-progress-label">{{ opProgress.label }}</span>
            <span class="fm-progress-count">{{ opProgress.done }} / {{ opProgress.total }}</span>
          </div>
          <div class="fm-progress-bar">
            <div
              class="fm-progress-fill"
              :style="{ width: `${opPercent}%` }"
            />
          </div>
        </div>

        <FmEntryList
          :entries="visibleEntries"
          :view-mode="prefs.viewMode"
          :loading="loading"
          :load-error="loadError"
          :has-more="hasMore"
          :sort-field="sortField"
          :sort-asc="sortAsc"
          :is-selected="isSelected"
          :i18n="i18n"
          @item-click="handleItemClick"
          @item-dblclick="handleItemDblclick"
          @item-contextmenu="handleContextmenu"
          @sort="toggleSort"
          @load-more="loadMore"
          @entry-drag-start="handleEntryDragStart"
          @entry-drop-to-folder="handleEntryDropToFolder"
        />

        <!-- 拖入提示浮层："松开以上传到当前目录" -->
        <div
          v-if="externalDrop.isDragOver.value"
          class="fm-dropzone-overlay"
        >
          {{ i18n.dropToUpload }}
        </div>
      </div>
    </template>

    <!-- 右键菜单 -->
    <FmContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenuItems"
      @select="handleMenuSelect"
      @close="contextMenu.visible = false"
    />

    <!-- 配置弹窗 -->
    <FmConfigDialog
      v-if="showConfig"
      :storage="storage"
      :i18n="i18n"
      @saved="handleConfigSaved"
      @close="showConfig = false"
    />

    <!-- 新建文件夹弹窗 -->
    <FmNameDialog
      v-if="showNewFolder"
      :title="i18n.newFolder"
      :i18n="i18n"
      @confirm="handleNewFolderConfirm"
      @close="showNewFolder = false"
    />

    <!-- 重命名弹窗 -->
    <FmNameDialog
      v-if="renameTarget"
      :title="i18n.rename"
      :initial-name="renameTarget.name"
      :i18n="i18n"
      @confirm="handleRenameConfirm"
      @close="renameTarget = null"
    />

    <!-- 移动/复制目标选择弹窗 -->
    <FmMoveCopyDialog
      v-if="moveCopyMode"
      :title="moveCopyMode === 'move' ? i18n.moveTo : i18n.copyTo"
      :root-prefix="getRootPrefix()"
      :bucket-label="s3Config.bucket"
      :require-client="requireClient"
      :i18n="i18n"
      @confirm="handleMoveCopyConfirm"
      @close="moveCopyMode = null"
    />

    <!-- 操作日志面板 -->
    <FmLogPanel
      v-if="showLog"
      :logs="logs"
      :i18n="i18n"
      @clear="clearLogs"
      @close="showLog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { Plugin, showMessage } from "siyuan"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type { S3FileManagerStorage } from "./types/storage"
import type { FileOpLog, FmPrefs, S3Entry, S3FileManagerI18n, ViewMode } from "./types"
import { DEFAULT_FM_PREFS } from "./types"
import { useS3FmClient } from "./composables/useS3FmClient"
import { useS3Entries } from "./composables/useS3Entries"
import { useS3Selection } from "./composables/useS3Selection"
import { useS3FileOps } from "./composables/useS3FileOps"
import { useS3Transfer } from "./composables/useS3Transfer"
import { useFileOpLogs } from "./composables/useFileOpLogs"
import { useExternalDrop } from "./composables/useExternalDrop"
import FmToolbar from "./components/FmToolbar.vue"
import FmBreadcrumb from "./components/FmBreadcrumb.vue"
import FmEntryList from "./components/FmEntryList.vue"
import FmContextMenu from "./components/FmContextMenu.vue"
import type { FmMenuItem } from "./components/FmContextMenu.vue"
import FmConfigDialog from "./components/FmConfigDialog.vue"
import FmNameDialog from "./components/FmNameDialog.vue"
import FmMoveCopyDialog from "./components/FmMoveCopyDialog.vue"
import FmLogPanel from "./components/FmLogPanel.vue"

const props = defineProps<{
  plugin: Plugin
  storage: S3FileManagerStorage
  i18n: S3FileManagerI18n
  onClose?: () => void
}>()

const { storage, i18n } = props

// ========== composables ==========

const { s3Config, isConfigured, applyConfig, requireClient, loadConfig, getRootPrefix } = useS3FmClient({ storage, i18n })

const {
  currentPrefix, entries, loading, loadError, sortField, sortAsc, sortedEntries, visibleEntries,
  hasMore, pathSegments, isAtRoot, loadDir, navigateTo, navigateUp,
  navigateToSegment, refresh, invalidateCache, loadMore, toggleSort,
} = useS3Entries({ requireClient, getRootPrefix })

const orderedEntries = computed(() => sortedEntries.value)
const { selectedEntries, selectedCount, isSelected, handleItemClick: selectItemClick, ensureSelected, clearSelection } = useS3Selection({ orderedEntries })

const { logs, loadLogs, addLog, clearLogs } = useFileOpLogs({ storage })

/** 写操作后：失效缓存 + 刷新 + 清空选中 */
async function afterMutation(): Promise<void> {
  invalidateCache()
  clearSelection()
  await refresh()
}

const { opBusy, opProgress, createNewFolder, renameEntry, copyEntries, moveEntries, deleteEntries } = useS3FileOps({
  requireClient, i18n, addLog, afterMutation,
})

const { transferring, transferProgress, uploadFiles, uploadDropped, downloadEntries } = useS3Transfer({
  requireClient, i18n,
  currentPrefix,
  getEntries: () => entries.value,
  addLog, afterMutation,
})

// 外部文件/文件夹拖入浏览区 → 上传到当前目录
const externalDrop = useExternalDrop((files) => { void uploadDropped(files) })

// ========== 本地 UI 状态 ==========

const prefs = ref<FmPrefs>({ ...DEFAULT_FM_PREFS })
const showConfig = ref(false)
const showNewFolder = ref(false)
const showLog = ref(false)
const renameTarget = ref<S3Entry | null>(null)
const moveCopyMode = ref<"move" | "copy" | null>(null)

const contextMenu = ref<{ visible: boolean; x: number; y: number; entry: S3Entry | null }>({
  visible: false, x: 0, y: 0, entry: null,
})

const busy = computed(() => opBusy.value || transferring.value)
const opPercent = computed(() => opProgress.value ? Math.round((opProgress.value.done / Math.max(opProgress.value.total, 1)) * 100) : 0)

// ========== 右键菜单项（按选中态动态生成） ==========

const contextMenuItems = computed<FmMenuItem[]>(() => {
  const entry = contextMenu.value.entry
  const items: FmMenuItem[] = []
  if (entry?.isFolder) {
    items.push({ action: "open", label: i18n.menuOpen, icon: "folder" })
  }
  items.push({ action: "download", label: i18n.download, icon: "download" })
  items.push({ action: "copy", label: i18n.copy, icon: "copy" })
  items.push({ action: "move", label: i18n.move, icon: "folderMove" })
  if (selectedCount.value <= 1) {
    items.push({ action: "rename", label: i18n.rename, icon: "edit" })
  }
  items.push({ action: "delete", label: i18n.delete, icon: "delete", danger: true })
  return items
})

// ========== 列表交互 ==========

function handleItemClick(entry: S3Entry, ev: MouseEvent): void {
  selectItemClick(entry, ev)
}

function handleItemDblclick(entry: S3Entry): void {
  if (entry.isFolder) {
    void navigateTo(entry.key)
  }
}

function handleContextmenu(entry: S3Entry, ev: MouseEvent): void {
  ensureSelected(entry)
  contextMenu.value = { visible: true, x: ev.clientX, y: ev.clientY, entry }
}

// ========== 内部拖拽移动 ==========

function handleEntryDragStart(entry: S3Entry): void {
  // 拖动未选中条目时改为单选它；已在选中集则保持多选整批拖动
  ensureSelected(entry)
}

function handleEntryDropToFolder(folder: S3Entry): void {
  // 排除目标文件夹自身（moveEntries 内部另有 destInsideSelf 守卫）
  const targets = selectedEntries.value.filter((e) => e.key !== folder.key)
  if (targets.length > 0) { void moveEntries(targets, folder.key) }
}

function handleMenuSelect(action: string): void {
  const entry = contextMenu.value.entry
  switch (action) {
    case "open":
      if (entry?.isFolder) { void navigateTo(entry.key) }
      break
    case "download": handleDownload(); break
    case "copy": openMoveCopy("copy"); break
    case "move": openMoveCopy("move"); break
    case "rename":
      if (entry) { renameTarget.value = entry }
      break
    case "delete": handleDelete(); break
  }
}

// ========== 操作 ==========

function handleUpload(): void {
  void uploadFiles()
}

function handleDownload(): void {
  if (selectedEntries.value.length === 0) { return }
  void downloadEntries(selectedEntries.value)
}

function openMoveCopy(mode: "move" | "copy"): void {
  if (selectedEntries.value.length === 0) { return }
  moveCopyMode.value = mode
}

function handleMoveCopyConfirm(destPrefix: string): void {
  const mode = moveCopyMode.value
  const entries = selectedEntries.value
  moveCopyMode.value = null
  if (mode === "copy") {
    void copyEntries(entries, destPrefix)
  } else if (mode === "move") {
    void moveEntries(entries, destPrefix)
  }
}

function openRename(): void {
  if (selectedEntries.value.length === 1) {
    renameTarget.value = selectedEntries.value[0]
  }
}

function handleRenameConfirm(newName: string): void {
  const target = renameTarget.value
  renameTarget.value = null
  if (target) { void renameEntry(target, newName) }
}

function handleNewFolderConfirm(name: string): void {
  showNewFolder.value = false
  void createNewFolder(currentPrefix.value, name)
}

function handleDelete(): void {
  if (selectedEntries.value.length === 0) { return }
  // 删除确认："确定删除选中的 N 项？文件夹将递归删除，此操作不可撤销"
  if (!confirm(`${i18n.confirmDelete} (${selectedEntries.value.length})`)) { return }
  void deleteEntries(selectedEntries.value)
}

// ========== 视图偏好 ==========

async function setViewMode(mode: ViewMode): Promise<void> {
  prefs.value.viewMode = mode
  await savePrefs()
}

async function savePrefs(): Promise<void> {
  prefs.value.sortField = sortField.value
  prefs.value.sortAsc = sortAsc.value
  await storage.prefs.save({ ...prefs.value })
}

// ========== 配置保存回调 ==========

function handleConfigSaved(config: typeof s3Config.value): void {
  applyConfig(config)
  showConfig.value = false
  void loadDir(getRootPrefix(), true)
}

function handleClose(): void {
  props.onClose?.()
}

// ========== 初始化 ==========

onMounted(async () => {
  await Promise.all([loadConfig(), loadLogs()])
  try {
    prefs.value = await storage.prefs.loadOrDefault()
    sortField.value = prefs.value.sortField
    sortAsc.value = prefs.value.sortAsc
  } catch {
    // 偏好加载失败用默认值
  }
  if (isConfigured.value) {
    await loadDir(getRootPrefix())
  }
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
