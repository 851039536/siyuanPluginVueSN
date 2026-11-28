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
          <Tab value="shortcuts">
            {{ i18n.tabShortcuts }}
          </Tab>
          <Tab value="diagnostics">
            {{ i18n.tabDiagnostics }}
          </Tab>
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
              @scan="handleOpenScan"
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
              :is-diagnosing="isDiagnosing"
              @select-tool="handleSelectTool"
              @update:path="handleFreePathChange"
              @diagnose="handleDiagnoseFree"
              @add-tool="handleAddFromPath"
              @create-shortcut="handleCreateShortcut"
              @run="handleRun"
              @open-folder="handleOpenShortcutFolder"
              @delete-shortcut="handleDeleteShortcutRequest"
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

    <Card
      v-if="deleteFailures.length > 0"
      variant="bordered"
      size="xsmall"
      class="elevation-assistant__failures"
    >
      <template #header>
        <span class="elevation-assistant__failures-title">{{ i18n.deletePartialTitle }}</span>
      </template>
      <ul class="elevation-assistant__failure-list">
        <li
          v-for="failure in deleteFailures"
          :key="failure.path"
          :title="failure.error"
        >
          {{ failure.path }}
        </li>
      </ul>
      <div class="elevation-assistant__failure-actions">
        <Button
          variant="secondary"
          size="xsmall"
          icon="refresh"
          @click="handleRetryDeleteFailures"
        >
          {{ i18n.retryDelete }}
        </Button>
        <Button
          variant="ghost"
          size="xsmall"
          @click="handleDismissDeleteFailures"
        >
          {{ i18n.cancel }}
        </Button>
      </div>
    </Card>

    <ToolEditorDialog
      v-model:visible="editorVisible"
      :i18n="i18n"
      :initial="editorDraft"
      :editing="!!editingTool"
      :diagnosis="editorDiagnosis"
      :diagnosis-path="editorDiagnosisPath"
      :diagnosing="editorDiagnosing"
      :saving="editorSaving"
      :error="editorError"
      @save="handleSaveDraft"
      @diagnose="handleDiagnoseDraft"
      @path-change="handleEditorPathChange"
    />

    <ProgramScanDialog
      v-model:visible="scanVisible"
      :i18n="i18n"
      :outcome="scanOutcome"
      :scanning="scanning"
      :adding="addingPrograms"
      :existing-paths="existingToolPaths"
      :error="scanError"
      @scan="handleScan"
      @add="handleAddPrograms"
    />

    <ConfirmDialog
      v-model:visible="deleteConfirmVisible"
      :header="i18n.deleteTool"
      :message="deleteMessage"
      :accept-label="i18n.delete"
      :reject-label="i18n.cancel"
      accept-severity="danger"
      :accept-loading="deleting"
      @confirm="handleConfirmDelete"
    />

    <ConfirmDialog
      v-model:visible="shortcutDeleteVisible"
      :header="i18n.deleteShortcutTitle"
      :message="shortcutDeleteMessage"
      :accept-label="i18n.delete"
      :reject-label="i18n.cancel"
      accept-severity="danger"
      :accept-loading="shortcutDeleting"
      @confirm="handleConfirmDeleteShortcut"
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
import type { WindowsShellService } from "./managers/WindowsShell"
import type {
  CreateShortcutOutcome,
  ElevationTool,
  PermissionDiagnosis,
  ProgramScanOutcome,
  ToolDraft,
} from "./types"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Card from "@/components/Card.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import Tab from "@/components/Tab.vue"
import TabList from "@/components/TabList.vue"
import TabPanel from "@/components/TabPanel.vue"
import TabPanels from "@/components/TabPanels.vue"
import Tabs from "@/components/Tabs.vue"
import { openFolderInExplorer } from "@/utils/electronDialog"
import DiagnosticsPanel from "./components/DiagnosticsPanel.vue"
import ElevationToolList from "./components/ElevationToolList.vue"
import PrivilegeStatusCard from "./components/PrivilegeStatusCard.vue"
import ProgramScanDialog from "./components/ProgramScanDialog.vue"
import ToolEditorDialog from "./components/ToolEditorDialog.vue"
import { useElevationAssistant } from "./composables/useElevationAssistant"
import { suggestToolName } from "./utils/shortcut"
import {
  defaultWorkingDir,
  normalizeTargetPath,
  windowsDirname,
} from "./utils/validation"

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
  scanning,
  addingPrograms,
  privilege,
  privilegeLoading,
  saveError,
  load,
  refreshPrivilege,
  refreshAll,
  refreshTool,
  diagnosePath,
  diagnoseFor,
  shortcutStatusFor,
  isBusy,
  isDiagnosing,
  createTool,
  updateTool,
  createShortcutFor,
  runTool,
  deleteTool,
  deleteShortcut,
  scanPrograms,
  addPrograms,
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
/** 临时检测请求序号：只接受最后一次请求的结果 */
let freeDiagnoseToken = 0

const editorVisible = ref(false)
const editingTool = ref<ElevationTool | null>(null)
const editorDraft = ref<ToolDraft>(makeDraft())
const editorDiagnosis = ref<PermissionDiagnosis | null>(null)
const editorDiagnosisPath = ref("")
const editorDiagnosing = ref(false)
const editorSaving = ref(false)
const editorError = ref("")
/** 编辑器内检测请求序号：路径变化或再次检测时作废旧请求 */
let editorDiagnoseToken = 0

const deleteConfirmVisible = ref(false)
const deleteTarget = ref<ElevationTool | null>(null)
const deleting = ref(false)
const deleteFailures = ref<{ path: string, error?: string }[]>([])
const deleteFailureToolId = ref<string | null>(null)

const shortcutDeleteVisible = ref(false)
const shortcutDeleting = ref(false)
const pendingShortcutDelete = ref<{ toolId: string, path: string } | null>(null)

const overwriteConfirmVisible = ref(false)
const overwriteLoading = ref(false)
const pendingOverwrite = ref<{
  toolId: string
  location: ToolDraft["location"]
  customDir: string
} | null>(null)

const scanVisible = ref(false)
const scanOutcome = ref<ProgramScanOutcome | null>(null)
const scanError = ref("")

const selectedTool = computed(() => {
  if (!selectedToolId.value) return null
  return tools.value.find((tool) => tool.id === selectedToolId.value) ?? null
})

const existingToolPaths = computed(() => tools.value.map((tool) => tool.path))

const targetPath = computed(() => selectedTool.value?.path || freeTargetPath.value)
const displayedDiagnosis = computed(() => {
  if (selectedTool.value) return diagnoseFor(selectedTool.value.id) ?? null
  return freeDiagnosis.value
})
const isDiagnosingTarget = computed(() => {
  if (selectedTool.value) return isDiagnosing(selectedTool.value.id) || isBusy(selectedTool.value.id)
  return freeDiagnosing.value
})

const deleteMessage = computed(() => {
  if (!deleteTarget.value) return i18n.deleteToolMessage
  return `${i18n.deleteToolMessage
  } ${deleteTarget.value.name}`
})

const shortcutDeleteMessage = computed(() => {
  const path = pendingShortcutDelete.value?.path || ""
  return `${i18n.deleteShortcutMessage} ${path}`
})

watch(shortcutDeleteVisible, (visible) => {
  if (!visible) pendingShortcutDelete.value = null
})

watch(overwriteConfirmVisible, (visible) => {
  // 对话框关闭后不再持有待覆盖参数，避免下次误用旧目标
  if (!visible) pendingOverwrite.value = null
})

watch(deleteConfirmVisible, (visible) => {
  if (!visible) deleteTarget.value = null
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
  if (outcome.kind === "limit") return outcome.message || i18n.shortcutLimitReached
  if (outcome.kind === "invalid") return i18n.createShortcutFailed
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
  editorDiagnosisPath.value = ""
  editorError.value = ""
  editorVisible.value = true
}

function handleEdit(tool: ElevationTool): void {
  editingTool.value = tool
  editorDraft.value = makeDraft(tool)
  editorDiagnosis.value = diagnoseFor(tool.id) ?? null
  editorDiagnosisPath.value = editorDiagnosis.value ? tool.path : ""
  editorError.value = ""
  editorVisible.value = true
}

async function handleDiagnoseDraft(path: string): Promise<void> {
  const target = normalizeTargetPath(path)
  if (!target) return
  const token = ++editorDiagnoseToken
  editorDiagnosing.value = true
  try {
    const diagnosis = await diagnosePath(target)
    if (token !== editorDiagnoseToken) return
    editorDiagnosis.value = diagnosis
    // 记录诊断对应的路径：编辑器据此判断是否还能套用推荐值
    editorDiagnosisPath.value = target
  } finally {
    if (token === editorDiagnoseToken) editorDiagnosing.value = false
  }
}

function handleEditorPathChange(): void {
  // 用户改路径：作废在途检测并清空旧诊断，避免旧结论写进表单
  editorDiagnoseToken += 1
  editorDiagnosing.value = false
  editorDiagnosis.value = null
  editorDiagnosisPath.value = ""
}

async function handleSaveDraft(draft: ToolDraft, createShortcut: boolean): Promise<void> {
  if (editorSaving.value) return
  editorSaving.value = true
  editorError.value = ""
  try {
    const editing = editingTool.value
    if (editing) {
      const result = await updateTool(editing.id, draft, createShortcut)
      if (!result.ok) {
        editorError.value = result.error || ""
        return
      }
      const failed = result.shortcutResults?.find((item) => !item.ok)
      const live = tools.value.find((item) => item.id === editing.id)
      if (failed) {
        notifyMessage(shortcutErrorText(failed), "error")
      } else if (createShortcut && (live?.shortcuts.length ?? 0) === 0) {
        const outcome = await createShortcutFor(editing.id, {
          location: draft.location,
          customDir: draft.customDir,
          overwrite: false,
        })
        if (!outcome.ok) {
          if (outcome.kind === "exists") {
            pendingOverwrite.value = {
              toolId: editing.id,
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
  deleteFailureToolId.value = null
  deleteConfirmVisible.value = true
}

async function handleConfirmDelete(): Promise<void> {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  try {
    const result = await deleteTool(target.id)
    deleteFailures.value = result.failures
    deleteFailureToolId.value = result.retained ? target.id : null
    if (result.failures.length > 0) {
      notifyKeyword("shortcutDeletePartial", "error")
    } else if (!result.ok) {
      notifyMessage(result.error || i18n.saveFailed, "error")
    } else {
      notifyKeyword("toolDeleted")
    }
    if (selectedToolId.value === target.id) selectedToolId.value = null
    deleteConfirmVisible.value = false
    deleteTarget.value = null
  } finally {
    deleting.value = false
  }
}

async function handleRetryDeleteFailures(): Promise<void> {
  const toolId = deleteFailureToolId.value
  if (!toolId) return
  const result = await deleteTool(toolId)
  deleteFailures.value = result.failures
  if (result.ok) {
    deleteFailureToolId.value = null
    notifyKeyword("toolDeleted")
    return
  }
  if (result.failures.length === 0) {
    notifyMessage(result.error || i18n.saveFailed, "error")
    return
  }
  notifyKeyword("shortcutDeletePartial", "error")
}

function handleDismissDeleteFailures(): void {
  deleteFailures.value = []
  deleteFailureToolId.value = null
}

function handleDeleteShortcutRequest(toolId: string, path: string): void {
  pendingShortcutDelete.value = {
    toolId,
    path,
  }
  shortcutDeleteVisible.value = true
}

async function handleConfirmDeleteShortcut(): Promise<void> {
  const pending = pendingShortcutDelete.value
  if (!pending) return
  shortcutDeleting.value = true
  try {
    const result = await deleteShortcut(pending.toolId, pending.path)
    if (result.ok) {
      notifyKeyword("shortcutDeleted")
    } else {
      notifyMessage(result.error || i18n.shortcutDeleteFailed, "error")
    }
    shortcutDeleteVisible.value = false
    pendingShortcutDelete.value = null
  } finally {
    shortcutDeleting.value = false
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

/** 临时检测路径变化：立即清空旧诊断并作废在途请求 */
function handleFreePathChange(value: string): void {
  freeTargetPath.value = value
  freeDiagnosis.value = null
  freeDiagnoseToken += 1
  freeDiagnosing.value = false
}

async function handleDiagnoseFree(path: string): Promise<void> {
  const target = normalizeTargetPath(path)
  if (!target) return
  const token = ++freeDiagnoseToken
  selectedToolId.value = null
  freeTargetPath.value = target
  freeDiagnosing.value = true
  try {
    const diagnosis = await diagnosePath(target)
    if (token !== freeDiagnoseToken) return
    freeDiagnosis.value = diagnosis
  } finally {
    if (token === freeDiagnoseToken) freeDiagnosing.value = false
  }
}

function handleAddFromPath(path: string): void {
  editingTool.value = null
  const target = normalizeTargetPath(path)
  // 只有诊断确实对应当前路径时才复用推荐值，否则重新检测
  const cached = normalizeTargetPath(freeTargetPath.value) === target ? freeDiagnosis.value : null
  editorDraft.value = {
    name: suggestToolName(target, i18n.defaultToolName),
    path: target,
    args: "",
    workingDir: defaultWorkingDir(target),
    requireAdmin: cached?.recommendedElevate ?? false,
    location: "desktop",
    customDir: "",
  }
  editorDiagnosis.value = cached
  editorDiagnosisPath.value = cached ? target : ""
  editorError.value = ""
  editorVisible.value = true
  if (!cached) void handleDiagnoseDraft(target)
}

async function handleOpenScan(): Promise<void> {
  scanVisible.value = true
  await handleScan()
}

async function handleScan(): Promise<void> {
  scanError.value = ""
  const outcome = await scanPrograms()
  scanOutcome.value = outcome
  if (outcome.ok) return
  if (outcome.kind === "timeout") {
    scanError.value = i18n.scanTimeout
  } else if (outcome.kind === "env") {
    scanError.value = i18n.envNotSupported
  } else {
    scanError.value = outcome.message || i18n.scanFailed
  }
}

async function handleAddPrograms(paths: string[]): Promise<void> {
  const all = scanOutcome.value?.ok ? scanOutcome.value.programs : []
  const candidates = all.filter((program) => paths.includes(program.path))
  const result = await addPrograms(candidates)
  if (!result.ok) {
    notifyMessage(result.error || i18n.saveFailed, "error")
    return
  }
  if (result.overflow > 0) {
    notifyKeyword("scanOverflow", "error")
  } else if (result.added > 0) {
    notifyKeyword("scanAdded")
  } else {
    notifyKeyword("scanSkipped")
  }
  scanVisible.value = false
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
