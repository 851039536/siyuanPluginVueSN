<!-- 数据管理 - 备份与还原：全量备份 / 备份列表 / 上传还原 / 按模块导出导入 -->
<template>
  <div class="sm-backup">
    <Panel toggleable :header="t.transfer?.backupTitle">
      <p class="sm-desc">{{ t.transfer?.backupDesc }}</p>
      <!-- 备份路径：绝对路径，点击可打开 / 复制 -->
      <PathBar
        class="sm-pathbar-gap"
        :label="t.transfer?.backupPath"
        :path="backupDir"
        :empty-text="t.unavailable"
        :open-label="t.openFolder"
        :copy-label="t.copyPath"
        :open-failed-text="t.openFailed"
        :copied-text="t.copied"
        :copy-failed-text="t.copyFailed"
        @notify="(severity, text) => emit('notify', severity, text)"
      />
      <div class="sm-row">
        <!-- 立即备份："立即备份" -->
        <Button
          variant="primary"
          size="small"
          icon="archiveOutline"
          :loading="busy === 'backup'"
          @click="handleCreate"
        >
          {{ t.transfer?.backupNow }}
        </Button>
      </div>

      <div class="sm-backup-list">
        <!-- 备份数量："已有备份" -->
        <div class="sm-subtitle">
          {{ t.transfer?.backupList }} ({{ backups.length }})
        </div>
        <BackupListItem
          v-for="item in backups"
          :key="item.fileName"
          :item="item"
          :t="t"
          @restore="handleRestorePath"
          @delete="handleDelete"
        />
        <!-- 空态："暂无备份" -->
        <p v-if="!backups.length" class="sm-empty">{{ t.transfer?.backupEmpty }}</p>
      </div>
    </Panel>

    <Panel toggleable :header="t.transfer?.restoreUpload">
      <p class="sm-desc">{{ t.transfer?.restoreUploadDesc }}</p>
      <!-- 上传还原按钮："还原" -->
      <FileUpload
        ref="uploadRef"
        mode="basic"
        accept=".zip"
        size="small"
        :choose-label="t.transfer?.restore"
        :show-upload-button="false"
        :show-cancel-button="false"
        @select="handleUpload"
      />
    </Panel>

    <ModuleTransfer
      :manager="manager"
      :inventory="inventory"
      :t="t"
      @notify="(severity, text) => emit('notify', severity, text)"
      @done="emit('done')"
    />
  </div>
</template>

<script setup lang="ts">
import type { PluginBackupListItem } from "@/utils/settingsBackup"
import type { StorageInventory } from "../types/model"
import type { StorageManager } from "../types"
import {
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import FileUpload from "@/components/FileUpload.vue"
import Panel from "@/components/Panel.vue"
import { getNodeModules } from "@/utils/nodeModules"
import BackupListItem from "./BackupListItem.vue"
import ModuleTransfer from "./ModuleTransfer.vue"
import PathBar from "./PathBar.vue"

interface Props {
  manager: StorageManager
  inventory: StorageInventory | null
  t: Record<string, any>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  notify: [severity: "success" | "error" | "info", text: string]
  done: []
}>()

const backups = ref<PluginBackupListItem[]>([])
const backupDir = ref("")
const busy = ref<"" | "backup" | "restore">("")
const uploadRef = ref<{ clear: () => void } | null>(null)

function fill(template: string | undefined, ...args: (string | number)[]): string {
  return (template || "").replace(/\{(\d+)\}/g, (_match, index) => String(args[Number(index)] ?? ""))
}

function errorText(code: string | undefined): string {
  if (!code) return ""
  return props.t.errors?.[code] || code
}

async function loadBackups(): Promise<void> {
  try {
    backups.value = await props.manager.listBackups()
    backupDir.value = await props.manager.getBackupDir()
  } catch (error) {
    console.error("[storageManager] 读取备份列表失败:", error)
  }
}

async function handleCreate(): Promise<void> {
  if (busy.value) return
  busy.value = "backup"
  try {
    const result = await props.manager.createFullBackup()
    emit("notify", "success", fill(props.t.transfer?.backupDone, result.fileName))
    await loadBackups()
  } catch (error) {
    emit("notify", "error", fill(
      props.t.transfer?.backupFailed,
      error instanceof Error ? error.message : String(error),
    ))
  } finally {
    busy.value = ""
  }
}

async function handleDelete(fileName: string): Promise<void> {
  const ok = await props.manager.deleteBackup(fileName)
  emit("notify", ok ? "success" : "error", ok ? (props.t.transfer?.deleted || "") : (props.t.transfer?.deleteFailed || ""))
  if (ok) await loadBackups()
}

async function runRestore(file: File): Promise<void> {
  if (busy.value) return
  busy.value = "restore"
  try {
    const report = await props.manager.restoreFromZip(file)
    const failed = report.failed[0]
    if (failed) {
      emit("notify", "error", fill(
        props.t.transfer?.restorePartial,
        report.applied.length,
        report.failed.length,
        report.skipped.length,
        errorText(failed.error),
      ))
    } else {
      let text = fill(
        props.t.transfer?.restoreDone,
        report.applied.length,
        report.failed.length,
        report.skipped.length,
      )
      if (report.snapshotPath) text += ` · ${fill(props.t.transfer?.snapshotAt, report.snapshotPath)}`
      if (report.requiresReload) text += ` · ${props.t.transfer?.requiresReload}`
      emit("notify", "success", text)
    }
    emit("done")
  } catch (error) {
    emit("notify", "error", fill(
      props.t.transfer?.restoreFailed,
      error instanceof Error ? error.message : String(error),
    ))
  } finally {
    busy.value = ""
  }
}

async function handleRestorePath(filePath: string): Promise<void> {
  const node = getNodeModules()
  if (!node) {
    emit("notify", "error", errorText("dataDirUnavailable"))
    return
  }
  try {
    const buffer = await node.fs.promises.readFile(filePath)
    const fileName = node.path.basename(filePath)
    await runRestore(new File([new Uint8Array(buffer)], fileName, { type: "application/zip" }))
  } catch (error) {
    emit("notify", "error", fill(
      props.t.transfer?.restoreFailed,
      error instanceof Error ? error.message : String(error),
    ))
  }
}

async function handleUpload(files: File[]): Promise<void> {
  const file = files[0]
  if (!file) return
  await runRestore(file)
  uploadRef.value?.clear()
}

onMounted(() => {
  void loadBackups()
})
</script>

<style lang="scss" scoped>
@use "../styles/BackupTab.scss";
@use "../styles/index.scss";
</style>
