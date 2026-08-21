<!-- 脚本启动器 - 主面板 -->
<template>
  <div class="script-launcher-panel">
    <div class="script-launcher__toolbar">
      <Button
        variant="primary"
        size="xsmall"
        icon="add"
        @click="openCreateDialog"
      >
        {{ i18n.addScript }}
      </Button>
      <Button
        variant="secondary"
        size="xsmall"
        icon="plus"
        @click="triggerImport"
      >
        {{ i18n.importScript }}
      </Button>
      <input
        ref="fileInputRef"
        type="file"
        :accept="IMPORT_ACCEPT"
        style="display: none"
        @change="handleImportFile"
      >
      <Button
        variant="secondary"
        size="xsmall"
        icon="refresh"
        @click="handleRefresh"
      >
        {{ i18n.refresh }}
      </Button>
      <Button
        variant="ghost"
        size="xsmall"
        icon="folder"
        title="打开 data/storage/sc/"
        @click="openScFolder"
      />
    </div>

    <div class="script-launcher__options">
      <Switch
        v-model="settings.builtinMonitor"
        size="xsmall"
        :label="i18n.builtinMonitor"
        :title="i18n.builtinMonitorDesc"
        @change="handleSettingsChange"
      />
      <span class="script-launcher__options-desc">
        {{ i18n.builtinMonitorDesc }}
      </span>
    </div>

    <RunningMonitor
      :processes="processes"
      :expanded="settings.monitorExpanded"
      :settings-enabled="settings.builtinMonitor"
      :i18n="i18n"
      @toggle="toggleMonitor"
      @stop="handleStop"
      @stop-all="handleStopAll"
      @clear-all="clearOutputs"
      @dismiss="dismissProcess"
    />

    <ScriptList
      :scripts="scripts"
      :i18n="i18n"
      @add="openCreateDialog"
      @edit="handleEdit"
      @delete="handleDelete"
      @run="handleRun"
    />

    <ScriptEditor
      :visible="showEditor"
      :plugin="plugin"
      :i18n="i18n"
      :script="selectedScript"
      :content="editingContent"
      @close="closeEditor"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  CreateScriptDTO,
  RunningProcess,
  Script,
} from "./types"
import type { I18n } from "./types/index"
import { showMessage } from "siyuan"
import {
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Switch from "@/components/Switch.vue"
import { getNodeProcessModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import RunningMonitor from "./components/RunningMonitor.vue"
import ScriptEditor from "./components/ScriptEditor.vue"
import ScriptList from "./components/ScriptList.vue"
import { useScriptLauncher } from "./composables/useScriptRunner"
import { useScriptStorage } from "./composables/useScriptStorage"
import {
  DEFAULT_SCRIPT_LAUNCHER_SETTINGS,
} from "./types"

interface Props {
  i18n: I18n
  plugin: Plugin
}

const props = defineProps<Props>()

const {
  storage,
  scripts,
  loadScripts,
  addScript,
  updateScript,
  deleteScript,
} = useScriptStorage(props.plugin)

const settings = ref({ ...DEFAULT_SCRIPT_LAUNCHER_SETTINGS })
const processes = ref<RunningProcess[]>([])
const showEditor = ref(false)
const selectedScript = ref<Script | null>(null)
const editingContent = ref("")
const fileInputRef = ref<HTMLInputElement>()

const {
  launchScript,
  stopProcess,
  stopAllProcesses,
  cleanupOnDestroy,
  restoreProcesses,
} = useScriptLauncher({
  settings,
  processes,
  // 输出写入的是数组内对象字段，必须重新赋值数组（浅拷贝）才能触发 Vue 响应式更新
  onProcessUpdated: () => {
    processes.value = [...processes.value]
  },
  persist: {
    load: () => storage.loadRunningProcesses(),
    save: (list) => storage.saveRunningProcesses(list),
    clear: () => storage.clearRunningProcesses(),
  },
})

/** 导入文件接受的扩展名 */
const IMPORT_ACCEPT = ".py,.pyw,.sh,.bash,.ps1,.js,.mjs,.bat,.cmd"

const handleSettingsChange = async () => {
  await storage.saveSettings({ ...settings.value })
}

const toggleMonitor = async () => {
  settings.value.monitorExpanded = !settings.value.monitorExpanded
  await storage.saveSettings({ ...settings.value })
}

const handleStop = (id: string) => {
  const result = stopProcess(id)
  if (result.ok) {
    showMessage(props.i18n.processStopped || "", 2000, "info")
  } else if (result.message) {
    showMessage(result.message, 3000, "error")
  }
}

const handleStopAll = () => {
  const count = stopAllProcesses()
  if (count > 0) showMessage(props.i18n.processStopped || "", 2000, "info")
}

const clearOutputs = () => {
  for (const p of processes.value) {
    p.stdout = ""
    p.stderr = ""
  }
  processes.value = [...processes.value]
}

const dismissProcess = (id: string) => {
  const target = processes.value.find((p) => p.id === id)
  // 运行中的条目点“关闭”= 先停止进程，再从列表移除，防止误关留下孤儿进程
  if (target && target.status === "running") {
    stopProcess(id)
  }
  processes.value = processes.value.filter((p) => p.id !== id)
  // 移除后同步落盘，避免重启后残留“幽灵进程”
  void storage.saveRunningProcesses(processes.value).catch(() => { /* 落盘失败不影响主流程 */ })
}

const handleRefresh = async () => {
  try {
    await loadScripts()
  } catch {
    showMessage(props.i18n.loadFailed || "", 3000, "error")
  }
}

const openScFolder = async () => {
  try {
    const node = getNodeProcessModules()
    if (!node) {
      showMessage(props.i18n.envNotSupported || "", 2000, "error")
      return
    }
    const wsRoot = await storage.getWorkspaceRoot()
    const scPath = wsRoot ? `${wsRoot}/data/storage/sc` : "data/storage/sc"
    // exec 默认经 shell 执行，无需显式 shell: true
    node.child_process.exec(`start "" "${scPath}"`)
  } catch {
    showMessage(props.i18n.openFailed || "", 2000, "error")
  }
}

const openCreateDialog = () => {
  selectedScript.value = null
  editingContent.value = ""
  showEditor.value = true
}

const closeEditor = () => {
  showEditor.value = false
  selectedScript.value = null
  editingContent.value = ""
}

const handleRun = async (script: Script) => {
  const filePath = await storage.getScriptPath(script.fileName)
  if (!filePath) {
    showMessage(props.i18n.scriptPathNotFound || "", 3000, "error")
    return
  }
  const ok = await launchScript(script, filePath)
  if (ok) {
    await storage.updateLastRun(script.id)
    await loadScripts()
  } else {
    showMessage(props.i18n.launchFailedEnvNotSupported || "", 3000, "error")
  }
}

const handleEdit = async (script: Script) => {
  selectedScript.value = script
  editingContent.value = (await storage.loadContent(script.fileName)) || ""
  showEditor.value = true
}

const handleSave = async (data: CreateScriptDTO) => {
  try {
    if (selectedScript.value) {
      await updateScript(selectedScript.value.id, data)
      showMessage(props.i18n.updateSuccess || "", 2000, "info")
    } else {
      await addScript(data)
      showMessage(props.i18n.createSuccess || "", 2000, "info")
    }
    closeEditor()
  } catch (error: unknown) {
    showMessage(
      getErrorMessage(error) || props.i18n.saveFailed || "",
      3000,
      "error",
    )
  }
}

const handleDelete = async (script: Script) => {
  // eslint-disable-next-line no-alert
  if (!window.confirm(props.i18n.confirmDelete || "")) {
    return
  }
  try {
    await deleteScript(script.id)
    showMessage(props.i18n.deleteSuccess || "", 2000, "info")
  } catch (error: unknown) {
    showMessage(
      getErrorMessage(error) || props.i18n.deleteFailed || "",
      3000,
      "error",
    )
  }
}

const triggerImport = () => {
  fileInputRef.value?.click()
}

const handleImportFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const content = await file.text()
    await storage.importFileContent(file.name, content)
    await loadScripts()
    showMessage(props.i18n.importSuccess || "", 2000, "info")
  } catch (error: unknown) {
    showMessage(getErrorMessage(error) || props.i18n.importFailed || "", 3000, "error")
  } finally {
    input.value = ""
  }
}

onMounted(async () => {
  settings.value = await storage.loadSettings()
  // 恢复上次会话遗留的进程（思源意外退出后仍在后台跑的进程）
  const restored = await restoreProcesses()
  if (restored.length > 0) {
    processes.value = restored
    // 恢复后立即落盘（统一 persisted 标记），与内存状态保持一致
    void storage.saveRunningProcesses(processes.value).catch(() => { /* 落盘失败不影响主流程 */ })
    const restoredMsg = props.i18n.restoredProcess?.replace("{count}", String(restored.length))
    if (restoredMsg) showMessage(restoredMsg, 3000, "info")
  }
  // 插件卸载：仅落盘进程记录（不再杀进程，让它们继续跑），供下次重启查看
  ;(props.plugin as any).__scriptLauncher?.setOnDestroy?.(() => {
    cleanupOnDestroy()
  })
})

onUnmounted(() => {
  // 面板关闭时同步落盘当前进程状态（停止/移除后不残留旧记录）
  storage.saveRunningProcesses(processes.value)
  ;(props.plugin as any).__scriptLauncher?.setOnDestroy?.(null)
})
</script>

<style lang="scss">
@use "./styles/index.scss";
</style>
