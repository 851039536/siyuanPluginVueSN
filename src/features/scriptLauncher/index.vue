<template>
  <div class="script-launcher-panel">
    <div class="script-launcher__toolbar">
      <Button
        variant="primary"
        size="small"
        icon="add"
        @click="openCreateDialog"
      >
        {{ i18n.addScript || "添加脚本" }}
      </Button>
      <Button
        variant="secondary"
        size="small"
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
        size="small"
        icon="refresh"
        @click="handleRefresh"
      >
        {{ i18n.refresh || "刷新" }}
      </Button>
    </div>

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
import type { Script } from "./types"
import type { I18n } from "./types/index"
import { computed, ref } from "vue"
import { showMessage } from "siyuan"
import Button from "@/components/Button.vue"
import ScriptEditor from "./components/ScriptEditor.vue"
import ScriptList from "./components/ScriptList.vue"
import { useScriptLauncher } from "./composables/useScriptRunner"
import { useScriptStorage } from "./composables/useScriptStorage"

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

const { launchScript } = useScriptLauncher()

const showEditor = ref(false)
const selectedScript = ref<Script | null>(null)
const editingContent = ref("")
const fileInputRef = ref<HTMLInputElement>()

const importAccept = computed(() =>
  ".py,.pyw,.sh,.bash,.ps1,.js,.mjs,.bat,.cmd",
)

const handleRefresh = async () => {
  try {
    await loadScripts()
  } catch {
    showMessage(props.i18n.loadFailed || "加载脚本失败", 3000, "error")
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
  const ok = launchScript(script, filePath)
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
        language: data.language as any,
        category: data.category,
        description: data.description,
        content: data.content,
      })
      showMessage(props.i18n.updateSuccess || "脚本已更新", 2000, "info")
    } else {
      await addScript(data)
      showMessage(props.i18n.createSuccess || "脚本已创建", 2000, "info")
    }
    closeEditor()
  } catch (error: any) {
    showMessage(
      error.message || props.i18n.saveFailed || "保存失败",
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
  } catch (error: any) {
    showMessage(
      error.message || props.i18n.deleteFailed || "删除失败",
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
    showMessage("脚本已导入", 2000, "info")
  } catch (error: any) {
    showMessage(error.message || "导入失败", 3000, "error")
  } finally {
    input.value = ""
  }
}
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
