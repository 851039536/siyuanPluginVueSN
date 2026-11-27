<!-- 提权助手 - Dock 主面板 -->
<template>
  <div class="elevation-assistant">
    <PrivilegeStatusCard
      :result="privilege"
      :loading="privilegeLoading"
      :i18n="i18n"
      @refresh="handleRefreshPrivilege"
    />

    <p
      v-if="!supported"
      class="elevation-assistant__unsupported"
    >
      {{ i18n.envNotSupported }}
    </p>

    <div class="elevation-assistant__body">
      <Tabs
        v-model:value="activeTab"
        size="small"
      >
        <TabList>
          <Tab value="shortcuts">{{ i18n.tabShortcuts }}</Tab>
          <Tab value="diagnostics">{{ i18n.tabDiagnostics }}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="shortcuts">
            <ElevationToolList
              :tools="tools"
              :i18n="i18n"
              :refreshing="refreshing"
              :diagnosis-for="diagnoseFor"
              :is-busy="isBusy"
              @add="handleAdd"
              @refresh="handleRefreshAll"
              @edit="handleEdit"
              @delete="handleDeleteRequest"
              @diagnose="handleDiagnoseTool"
              @create="handleCreateShortcut"
              @run="handleRun"
              @open-folder="handleOpenToolFolder"
            />
          </TabPanel>
          <TabPanel value="diagnostics">
            <DiagnosticsPanel
              :tools="tools"
              :selected-tool="selectedTool"
              :target-path="targetPath"
              :diagnosis="displayedDiagnosis"
              :diagnosing="isDiagnosingTarget"
              :i18n="i18n"
              :shortcut-status-for="shortcutStatusFor"
              :is-busy="isBusy"
              @select-tool="handleSelectTool"
              @diagnose="handleDiagnoseFree"
              @add-tool="handleAddFromPath"
              @create-shortcut="handleCreateShortcut"
              @run="handleRun"
              @open-folder="handleOpenShortcutFolder"
              @delete-shortcut="handleDeleteShortcut"
              @refresh="handleDiagnoseTool"
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>

    <p
      v-if="saveError"
      class="elevation-assistant__save-error"
    >
      {{ saveError }}
    </p>

    <ToolEditorDialog
      v-model:visible="editorVisible"
      :i18n="i18n"
      :initial="editorDraft"
      :editing="!!editingTool"
      :diagnosis="editorDiagnosis"
      :diagnosing="editorDiagnosing"
      :saving="editorSaving"
      :error="editorError"
      @save="handleSaveDraft"
      @diagnose="handleDiagnoseDraft"
    />

    <ConfirmDialog
      v-model:visible="deleteConfirmVisible"
      :header="i18n.deleteTool"
      :message="deleteMessage"
      :accept-label="i18n.delete"
      :reject-label="i18n.cancel"
      :accept-severity="'danger'"
      :accept-loading="deleting"
      @confirm="handleConfirmDelete"
    />

    <ConfirmDialog
      v-model:visible="overwriteConfirmVisible"
      :header="i18n.overwriteTitle"
      :message="i18n.overwriteMessage"
      :accept-label="i18n.overwrite"
      :reject-label="i18n.cancel"
      :accept-loading="overwriteLoading"
      @confirm="handleConfirmOverwrite"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  CreateShortcutOutcome,
  ElevationTool,
  PermissionDiagnosis,
  ToolDraft,
} from "./types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import { showMessage } from "siyuan"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import Tab from "@/components/Tab.vue"
import TabList from "@/components/TabList.vue"
import TabPanel from "@/components/TabPanel.vue"
import TabPanels from "@/components/TabPanels.vue"
import Tabs from "@/components/Tabs.vue"
import { openFolderInExplorer } from "@/utils/electronDialog"
import { diagnoseExecutable } from "./managers/diagnostics"
import type { WindowsShellService } from "./managers/WindowsShell"
import { useElevationAssistant } from "./composables/useElevationAssistant"
import DiagnosticsPanel from "./components/DiagnosticsPanel.vue"
import ElevationToolList from "./components/ElevationToolList.vue"
import PrivilegeStatusCard from "./components/PrivilegeStatusCard.vue"
import ToolEditorDialog from "./components/ToolEditorDialog.vue"
import { suggestToolName } from "./utils/shortcut"
import { defaultWorkingDir, normalizeTargetPath, windowsDirname } from "./utils/validation"

interface Props {
  i18n: Record<string, string>
  plugin: Plugin
  shell: WindowsShellService
}

const props = defineProps<Props>()

const i18n = props.i18n || {}

const {
  tools,
  refreshing,
  privilege,
  privilegeLoading,
  saveError,
  load,
  refreshPrivilege,
  refreshAll,
  refreshTool,
  diagnoseFor,
  shortcutStatusFor,
  isBusy,
  createTool,
  updateTool,
  createShortcutFor,
  runTool,
  deleteTool,
  deleteShortcut,
  makeDraft,
} = useElevationAssistant({
  plugin: props.plugin,
  shell: props.shell,
  i18n,
})

const activeTab = ref("shortcuts")
/** 当前环境是否支持系统操作（非 Windows / 无 Node 时仅展示说明） */
const supported = props.shell.isSupported()
const selectedToolId = ref<string | null>(null)
const freeTargetPath = ref("")
const freeDiagnosis = ref<PermissionDiagnosis | null>(null)
const freeDiagnosing = ref(false)

const editorVisible = ref(false)
const editingTool = ref<ElevationTool | null>(null)
const editorDraft = ref<ToolDraft>(makeDraft())
const editorDiagnosis = ref<PermissionDiagnosis | null>(null)
const editorDiagnosing = ref(false)
const editorSaving = ref(false)
const editorError = ref("")

const deleteConfirmVisible = ref(false)
const deleteTarget = ref<ElevationTool | null>(null)
const deleting = ref(false)
const deleteFailures = ref<{ path: string, error?: string }[]>([])

const overwriteConfirmVisible = ref(false)
const overwriteLoading = ref(false)
const pendingOverwrite = ref<{
  toolId: string
  location: ToolDraft["location"]
  customDir: string
} | null>(null)

const selectedTool = computed(() => {
  if (!selectedToolId.value) return null
  return tools.value.find((tool) => tool.id === selectedToolId.value) ?? null
})

const targetPath = computed(() => selectedTool.value?.path || freeTargetPath.value)
const displayedDiagnosis = computed(() => {
  if (selectedTool.value) return diagnoseFor(selectedTool.value.id) ?? null
  return freeDiagnosis.value
})
const isDiagnosingTarget = computed(() => {
  if (selectedTool.value) return isBusy(selectedTool.value.id)
  return freeDiagnosing.value
})

const deleteMessage = computed(() => {
  if (!deleteTarget.value) return i18n.deleteToolMessage
  return (i18n.deleteToolMessage)
    + ` ${deleteTarget.value.name}`
})

/** 显示 i18n 文案（key 由 i18n:verify 保证存在，不设中文兜底） */
function notifyKeyword(key: string, type: "info" | "error" = "info"): void {
  const text = i18n[key]
  if (!text) return
  showMessage(text, 3000, type)
}

/** 显示运行时动态文案（错误详情等） */
function notifyMessage(text: string, type: "info" | "error" = "info"): void {
  if (!text) return
  showMessage(text, 3000, type)
}

function shortcutErrorText(outcome: CreateShortcutOutcome): string {
  if (outcome.ok) return ""
  if (outcome.kind === "exists") return i18n.shortcutExistsError
  if (outcome.kind === "env") return i18n.envNotSupported
  if (outcome.kind === "timeout") return i18n.operationTimeout
  if (outcome.kind === "location") return i18n.customDirMissing
  return outcome.message || (i18n.createShortcutFailed)
}

async function handleRefreshPrivilege(): Promise<void> {
  await refreshPrivilege()
}

async function handleRefreshAll(): Promise<void> {
  await refreshAll()
}

function handleAdd(): void {
  editingTool.value = null
  editorDraft.value = makeDraft()
  editorDiagnosis.value = null
  editorError.value = ""
  editorVisible.value = true
}

function handleEdit(tool: ElevationTool): void {
  editingTool.value = tool
  editorDraft.value = makeDraft(tool)
  editorDiagnosis.value = diagnoseFor(tool.id) ?? null
  editorError.value = ""
  editorVisible.value = true
}

async function handleDiagnoseDraft(path: string): Promise<void> {
  if (!normalizeTargetPath(path)) return
  editorDiagnosing.value = true
  try {
    editorDiagnosis.value = await diagnoseExecutable(normalizeTargetPath(path))
  } finally {
    editorDiagnosing.value = false
  }
}

async function handleSaveDraft(draft: ToolDraft, createShortcut: boolean): Promise<void> {
  if (editorSaving.value) return
  editorSaving.value = true
  editorError.value = ""
  try {
    if (editingTool.value) {
      const result = await updateTool(editingTool.value.id, draft, createShortcut)
      if (!result.ok) {
        editorError.value = result.error || ""
        return
      }
      const failed = result.shortcutResults?.find((item) => !item.ok)
      if (failed) {
        notifyMessage(shortcutErrorText(failed), "error")
      } else if (createShortcut && editingTool.value.shortcuts.length === 0) {
        const outcome = await createShortcutFor(editingTool.value.id, {
          location: draft.location,
          customDir: draft.customDir,
          overwrite: false,
        })
        if (!outcome.ok) {
          if (outcome.kind === "exists") {
            pendingOverwrite.value = {
              toolId: editingTool.value.id,
              location: draft.location,
              customDir: draft.customDir,
            }
            overwriteConfirmVisible.value = true
            editorVisible.value = false
            return
          }
          notifyMessage(shortcutErrorText(outcome), "error")
        } else {
          notifyKeyword("shortcutCreated")
        }
      } else if (createShortcut) {
        notifyKeyword("shortcutUpdated")
      } else {
        notifyKeyword("toolSaved")
      }
      editorVisible.value = false
      return
    }

    const result = await createTool(draft, createShortcut)
    if (!result.ok) {
      editorError.value = result.error || ""
      return
    }
    editorVisible.value = false
    if (result.shortcut && !result.shortcut.ok) {
      if (result.shortcut.kind === "exists" && result.tool) {
        pendingOverwrite.value = {
          toolId: result.tool.id,
          location: draft.location,
          customDir: draft.customDir,
        }
        overwriteConfirmVisible.value = true
        return
      }
      notifyMessage(shortcutErrorText(result.shortcut), "error")
      return
    }
    notifyKeyword("toolSaved")
  } finally {
    editorSaving.value = false
  }
}

async function handleCreateShortcut(tool: ElevationTool): Promise<void> {
  const first = tool.shortcuts[0]
  const location = first?.location ?? "desktop"
  const customDir = first && first.location === "custom" ? windowsDirname(first.path) : ""
  const outcome = await createShortcutFor(tool.id, {
    location,
    customDir,
    overwrite: false,
  })
  if (outcome.ok) {
    notifyKeyword("shortcutCreated")
    return
  }
  if (outcome.kind === "exists") {
    pendingOverwrite.value = {
      toolId: tool.id,
      location,
      customDir,
    }
    overwriteConfirmVisible.value = true
    return
  }
  notifyMessage(shortcutErrorText(outcome), "error")
}

async function handleConfirmOverwrite(): Promise<void> {
  const pending = pendingOverwrite.value
  if (!pending) return
  overwriteLoading.value = true
  try {
    const outcome = await createShortcutFor(pending.toolId, {
      location: pending.location,
      customDir: pending.customDir,
      overwrite: true,
    })
    if (outcome.ok) {
      notifyKeyword("shortcutCreated")
      overwriteConfirmVisible.value = false
      pendingOverwrite.value = null
    } else {
      notifyMessage(shortcutErrorText(outcome), "error")
    }
  } finally {
    overwriteLoading.value = false
  }
}

async function handleRun(tool: ElevationTool): Promise<void> {
  const result = await runTool(tool.id)
  if (result.ok) {
    notifyKeyword("runStarted")
    return
  }
  if (result.kind === "canceled") {
    notifyKeyword("uacCanceled", "error")
    return
  }
  notifyMessage(result.message || i18n.runFailed, "error")
}

function handleDeleteRequest(tool: ElevationTool): void {
  deleteTarget.value = tool
  deleteFailures.value = []
  deleteConfirmVisible.value = true
}

async function handleConfirmDelete(): Promise<void> {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  try {
    const result = await deleteTool(target.id)
    deleteFailures.value = result.failures
    if (result.failures.length > 0) {
      notifyKeyword("shortcutDeletePartial", "error")
    } else {
      notifyKeyword("toolDeleted")
    }
    if (selectedToolId.value === target.id) selectedToolId.value = null
    deleteConfirmVisible.value = false
  } finally {
    deleting.value = false
  }
}

async function handleDeleteShortcut(toolId: string, path: string): Promise<void> {
  const result = await deleteShortcut(toolId, path)
  if (result.ok) {
    notifyKeyword("shortcutDeleted")
  } else {
    notifyMessage(result.error || i18n.shortcutDeleteFailed, "error")
  }
}

function handleDiagnoseTool(tool: ElevationTool): void {
  activeTab.value = "diagnostics"
  selectedToolId.value = tool.id
  freeTargetPath.value = tool.path
  freeDiagnosis.value = null
  void refreshTool(tool.id)
}

function handleSelectTool(toolId: string | null): void {
  selectedToolId.value = toolId
  if (!toolId) {
    freeTargetPath.value = selectedTool.value?.path || ""
    freeDiagnosis.value = null
  }
}

async function handleDiagnoseFree(path: string): Promise<void> {
  const target = normalizeTargetPath(path)
  if (!target) return
  selectedToolId.value = null
  freeTargetPath.value = target
  freeDiagnosing.value = true
  try {
    freeDiagnosis.value = await diagnoseExecutable(target)
  } finally {
    freeDiagnosing.value = false
  }
}

function handleAddFromPath(path: string): void {
  editingTool.value = null
  const target = normalizeTargetPath(path)
  editorDraft.value = {
    name: suggestToolName(target, i18n.defaultToolName),
    path: target,
    args: "",
    workingDir: defaultWorkingDir(target),
    requireAdmin: freeDiagnosis.value?.recommendedElevate ?? false,
    location: "desktop",
    customDir: "",
  }
  editorDiagnosis.value = freeDiagnosis.value
  editorError.value = ""
  editorVisible.value = true
}

async function handleOpenToolFolder(tool: ElevationTool): Promise<void> {
  const dir = windowsDirname(tool.path)
  if (!dir) return
  const ok = await openFolderInExplorer(dir)
  if (!ok) notifyKeyword("openFolderFailed", "error")
}

async function handleOpenShortcutFolder(path: string): Promise<void> {
  const dir = windowsDirname(path)
  if (!dir) return
  const ok = await openFolderInExplorer(dir)
  if (!ok) notifyKeyword("openFolderFailed", "error")
}

onMounted(() => {
  void load()
})
</script>

<style lang="scss">
@use "./styles/index.scss";
</style>
