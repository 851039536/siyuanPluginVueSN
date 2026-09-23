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
        :aria-label="i18n.close"
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
        @dragend="externalDrop.onDragEnd"
      >
        <!-- 进度条：传输与批量操作共用一段（共享 ProgressBar） -->
        <div
          v-if="progressInfo"
          class="fm-progress"
        >
          <ProgressBar
            :value="progressInfo.percent"
            size="xsmall"
            :show-value="false"
          />
          <div class="fm-progress-info">
            <span class="fm-progress-label">{{ progressInfo.label }}</span>
            <span
              v-if="progressInfo.currentFile"
              class="fm-progress-file"
            >{{ progressInfo.currentFile }}</span>
            <span class="fm-progress-count">{{ progressInfo.done }} / {{ progressInfo.total }}</span>
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

    <!-- 右键菜单（共享 TieredMenu popup） -->
    <FmContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenuItems"
      :aria-label="i18n.contextMenuLabel"
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
      :request-clear-confirm="requestClearLogsConfirm"
      @close="showLog = false"
    />

    <!-- 通用确认框（删除/清空日志/上传覆盖等危险操作） -->
    <ConfirmDialog
      v-if="confirmState"
      :visible="true"
      :header="confirmState.title"
      :message="confirmState.message"
      :accept-label="confirmState.confirmText"
      :reject-label="confirmState.cancelText"
      :accept-severity="confirmState.danger ? 'danger' : 'primary'"
      @confirm="handleConfirmAccept"
      @cancel="handleConfirmCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import Button from "@/components/Button.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import ProgressBar from "@/components/ProgressBar.vue"
import type { TieredMenuItem } from "@/components/TieredMenu.vue"
import type { S3FileManagerStorage } from "./types/storage"
import type { S3Entry, S3FileManagerI18n } from "./types"
import { useS3FmClient } from "./composables/useS3FmClient"
import { useS3Entries } from "./composables/useS3Entries"
import { useS3Selection } from "./composables/useS3Selection"
import { useS3FileOps } from "./composables/useS3FileOps"
import { useS3Transfer } from "./composables/useS3Transfer"
import { useFileOpLogs } from "./composables/useFileOpLogs"
import { useExternalDrop } from "./composables/useExternalDrop"
import { useFmConfirm } from "./composables/useFmConfirm"
import { useFmPrefs } from "./composables/useFmPrefs"
import FmToolbar from "./components/FmToolbar.vue"
import FmBreadcrumb from "./components/FmBreadcrumb.vue"
import FmEntryList from "./components/FmEntryList.vue"
import FmContextMenu from "./components/FmContextMenu.vue"
import FmConfigDialog from "./components/FmConfigDialog.vue"
import FmNameDialog from "./components/FmNameDialog.vue"
import FmMoveCopyDialog from "./components/FmMoveCopyDialog.vue"
import FmLogPanel from "./components/FmLogPanel.vue"

const props = defineProps<{
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
  navigateToSegment, refresh, invalidateCache, resetCapabilityProbe, loadMore, toggleSort,
} = useS3Entries({ requireClient, getRootPrefix })

const { selectedEntries, selectedCount, isSelected, handleItemClick: selectItemClick, ensureSelected, clearSelection } = useS3Selection({ orderedEntries: sortedEntries })

const { logs, loadLogs, addLog, clearLogs } = useFileOpLogs({ storage })

const { confirmState, requestConfirm, handleConfirmAccept, handleConfirmCancel } = useFmConfirm()

const { prefs, setViewMode, loadPrefs } = useFmPrefs({ storage, sortField, sortAsc })

/** 清空日志确认（与删除共用统一确认框） */
function requestClearLogsConfirm(): void {
  void requestConfirm(
    i18n.clearLogs,
    i18n.confirmClearLogs,
    { confirmText: i18n.clearLogs, danger: true },
  ).then((ok) => {
    if (ok) { void clearLogs() }
  })
}

/** 写操作后：失效缓存 + 刷新 + 清空选中 */
async function afterMutation(): Promise<void> {
  invalidateCache()
  clearSelection()
  await refresh()
}

const { opBusy, opProgress, createNewFolder, renameEntry, copyEntries, moveEntries, deleteEntries } = useS3FileOps({
  requireClient, i18n, addLog, afterMutation,
  isTransferring: () => transferring.value,
})

const { transferring, transferProgress, uploadFiles, uploadDropped, downloadEntries } = useS3Transfer({
  requireClient, i18n,
  currentPrefix,
  getEntries: () => entries.value,
  addLog, afterMutation,
  confirmAction: requestConfirm,
})

// 外部文件/文件夹拖入浏览区 → 上传到当前目录
const externalDrop = useExternalDrop((files) => { void uploadDropped(files) })

// ========== 本地 UI 状态 ==========

const showConfig = ref(false)
const showNewFolder = ref(false)
const showLog = ref(false)
const renameTarget = ref<S3Entry | null>(null)
const moveCopyMode = ref<"move" | "copy" | null>(null)

const contextMenu = ref<{ visible: boolean; x: number; y: number; entry: S3Entry | null }>({
  visible: false, x: 0, y: 0, entry: null,
})

const busy = computed(() => opBusy.value || transferring.value)

/** 统一进度视图模型：传输优先（含当前文件名），否则为批量操作进度 */
const progressInfo = computed(() => {
  const transfer = transferProgress.value
  if (transfer) {
    return {
      label: transfer.label,
      currentFile: transfer.currentFile,
      done: transfer.done,
      total: transfer.total,
      percent: transfer.percent,
    }
  }
  const op = opProgress.value
  if (!op) { return null }
  return {
    label: op.label,
    currentFile: "",
    done: op.done,
    total: op.total,
    percent: Math.round((op.done / Math.max(op.total, 1)) * 100),
  }
})

// 跨目录导航后清空选中，避免残留 key/锚点干扰新目录的选择与计数
watch(currentPrefix, () => clearSelection())

// ========== 右键菜单项（按选中态动态生成） ==========

const contextMenuItems = computed<TieredMenuItem[]>(() => {
  const entry = contextMenu.value.entry
  const items: TieredMenuItem[] = []
  if (entry?.isFolder) {
    items.push({ key: "open", label: i18n.menuOpen, icon: "folder" })
  }
  items.push({ key: "download", label: i18n.download, icon: "download" })
  items.push({ key: "copy", label: i18n.copy, icon: "copy" })
  items.push({ key: "move", label: i18n.move, icon: "folderMove" })
  if (selectedCount.value <= 1) {
    items.push({ key: "rename", label: i18n.rename, icon: "edit" })
  }
  items.push({ key: "delete", label: i18n.delete, icon: "delete", danger: true })
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
  // 名称未变更时直接关闭：同名复制+删源会误删文件
  if (!target || newName.trim() === target.name) { return }
  void renameEntry(target, newName)
}

function handleNewFolderConfirm(name: string): void {
  showNewFolder.value = false
  void createNewFolder(currentPrefix.value, name)
}

function handleDelete(): void {
  if (selectedEntries.value.length === 0) { return }
  // 删除确认："确定删除选中的 N 项？文件夹将递归删除，此操作不可撤销"
  void requestConfirm(
    i18n.delete,
    `${i18n.confirmDelete} (${selectedEntries.value.length})`,
    { confirmText: i18n.delete, danger: true },
  ).then((ok) => {
    if (ok) { void deleteEntries(selectedEntries.value) }
  })
}

// ========== 配置保存回调 ==========

function handleConfigSaved(config: typeof s3Config.value): void {
  applyConfig(config)
  showConfig.value = false
  // 旧连接的目录缓存、delimiter 探测与选中态全部失效，避免切换 bucket/endpoint 后展示脏数据
  invalidateCache()
  resetCapabilityProbe()
  clearSelection()
  void loadDir(getRootPrefix(), true)
}

function handleClose(): void {
  props.onClose?.()
}

// ========== 初始化 ==========

onMounted(async () => {
  await Promise.all([loadConfig(), loadLogs()])
  await loadPrefs()
  if (isConfigured.value) {
    await loadDir(getRootPrefix())
  }
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
