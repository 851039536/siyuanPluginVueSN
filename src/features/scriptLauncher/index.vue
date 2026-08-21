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
        {{ i18n.addScript || "添加脚本" }}
      </Button>
      <Button
        variant="secondary"
        size="xsmall"
        icon="plus"
        @click="triggerImport"
      >
        {{ i18n.importScript || "导入" }}
      </Button>
      <input
        ref="fileInputRef"
        type="file"
        :accept="importAccept"
        style="display: none"
        @change="handleImportFile"
      >
      <Button
        variant="secondary"
        size="xsmall"
        icon="refresh"
        @click="handleRefresh"
      >
        {{ i18n.refresh || "刷新" }}
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
        :label="i18n.builtinMonitor || '内置监听'"
        :title="i18n.builtinMonitorDesc || ''"
        @change="handleSettingsChange"
      />
      <span class="script-launcher__options-desc">
        {{ i18n.builtinMonitorDesc || "隐藏控制台窗口，在面板内显示启动信息与输出" }}
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
      @rename="handleRename"
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
  ScriptLanguage,
} from "./types"
import type { I18n } from "./types/index"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Switch from "@/components/Switch.vue"
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

const importAccept = computed(() =>
  ".py,.pyw,.sh,.bash,.ps1,.js,.mjs,.bat,.cmd",
)

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
    showMessage(props.i18n.processStopped || "进程已停止", 2000, "info")
  } else if (result.message) {
    showMessage(result.message, 3000, "error")
  }
}

const handleStopAll = () => {
  const count = stopAllProcesses()
  if (count > 0) showMessage(props.i18n.processStopped || "进程已停止", 2000, "info")
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
}

const handleRefresh = async () => {
  try {
    await loadScripts()
  } catch {
    showMessage(props.i18n.loadFailed || "加载脚本失败", 3000, "error")
  }
}

const openScFolder = async () => {
  try {
    const node = (() => {
      try {
        return { cp: require("node:child_process") }
      } catch {
        return null
      }
    })()
    if (!node) {
      showMessage("当前环境不支持", 2000, "error")
      return
    }
    const wsRoot = await storage.getWorkspaceRoot()
    const scPath = wsRoot ? `${wsRoot}/data/storage/sc` : "data/storage/sc"
    node.cp.exec(`start "" "${scPath}"`, { shell: true })
  } catch {
    showMessage("打开失败", 2000, "error")
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
    showMessage("无法找到脚本文件路径", 3000, "error")
    return
  }
  const ok = await launchScript(script, filePath)
  if (ok) {
    await storage.updateLastRun(script.id)
    await loadScripts()
  } else {
    showMessage("启动失败，当前环境不支持", 3000, "error")
  }
}

const handleEdit = async (script: Script) => {
  selectedScript.value = script
  editingContent.value = (await storage.loadContent(script.fileName)) || ""
  showEditor.value = true
}

const handleSave = async (data: {
  name: string
  language: string
  category: string
  description: string
  content: string
}) => {
  try {
    if (selectedScript.value) {
      await updateScript(selectedScript.value.id, {
        name: data.name,
        language: data.language as ScriptLanguage,
        category: data.category,
        description: data.description,
        content: data.content,
      })
      showMessage(props.i18n.updateSuccess || "脚本已更新", 2000, "info")
    } else {
      await addScript({
        name: data.name,
        language: data.language as ScriptLanguage,
        category: data.category,
        description: data.description,
        content: data.content,
      } as CreateScriptDTO)
      showMessage(props.i18n.createSuccess || "脚本已创建", 2000, "info")
    }
    closeEditor()
  } catch (error: unknown) {
    showMessage(
      getErrorMessage(error) || props.i18n.saveFailed || "保存失败",
      3000,
      "error",
    )
  }
}

const handleDelete = async (script: Script) => {
  // eslint-disable-next-line no-alert
  if (!window.confirm(props.i18n.confirmDelete || "确定要删除这个脚本吗？")) {
    return
  }
  try {
    await deleteScript(script.id)
    showMessage(props.i18n.deleteSuccess || "脚本已删除", 2000, "info")
  } catch (error: unknown) {
    showMessage(
      getErrorMessage(error) || props.i18n.deleteFailed || "删除失败",
      3000,
      "error",
    )
  }
}

const triggerImport = () => {
  fileInputRef.value?.click()
}

const handleRename = async (id: string, newName: string) => {
  try {
    await updateScript(id, { name: newName })
    await loadScripts()
  } catch (error: unknown) {
    showMessage(getErrorMessage(error) || "重命名失败", 3000, "error")
  }
}

const handleImportFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const content = await file.text()
    await storage.importFileContent(file.name, content)
    await loadScripts()
    showMessage("脚本已导入", 2000, "info")
  } catch (error: unknown) {
    showMessage(getErrorMessage(error) || "导入失败", 3000, "error")
  } finally {
    input.value = ""
  }
}

onMounted(async () => {
  settings.value = await storage.loadSettings()
  // 恢复上次会话遗留的进程（思源意外退出后仍在后台跑的进程）
  const restored = await restoreProcesses()
  if (restored.length > 0) {
    processes.value = [...restored, ...processes.value.filter((p) => !p.persisted)]
    showMessage(
      props.i18n.restoredProcess || `检测到 ${restored.length} 个上次遗留的进程`,
      3000,
      "info",
    )
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
