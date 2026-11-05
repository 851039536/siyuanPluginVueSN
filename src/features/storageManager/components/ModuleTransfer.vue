<!-- 数据管理 - 按模块导出/导入：选择功能 + 是否含敏感项 -->
<template>
  <Panel toggleable :header="t.transfer?.moduleTitle">
    <p class="sm-desc">{{ t.transfer?.moduleDesc }}</p>

    <!-- 功能选择（多选，筛选占位："选择功能"） -->
    <Listbox
      v-model="selectedOwners"
      multiple
      checkbox
      filter
      :options="ownerOptions"
      :filter-placeholder="t.transfer?.selectOwners"
      :empty-text="t.empty"
      size="small"
      :max-height="160"
    />

    <div class="sm-row sm-row--between">
      <!-- 包含敏感项："包含敏感项" -->
      <Switch v-model="includeSensitive" size="small" :label="t.transfer?.includeSensitive" />
      <div class="sm-row">
        <!-- 导出按钮："导出" -->
        <Button
          variant="primary"
          size="small"
          icon="download"
          :disabled="!selectedOwners.length || busy !== ''"
          :loading="busy === 'export'"
          @click="handleExport"
        >
          {{ t.transfer?.export }}
        </Button>
        <!-- 导入按钮："导入 JSON" -->
        <FileUpload
          ref="importRef"
          mode="basic"
          accept=".json"
          size="small"
          :choose-label="t.transfer?.import"
          :show-upload-button="false"
          :show-cancel-button="false"
          @select="handleImport"
        />
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import type { StorageOwner } from "@/config/storage"
import type { StorageInventory } from "../types/model"
import type { StorageManager } from "../types"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import FileUpload from "@/components/FileUpload.vue"
import Listbox from "@/components/Listbox.vue"
import Panel from "@/components/Panel.vue"
import Switch from "@/components/Switch.vue"
import { triggerBlobDownload } from "@/utils/domUtils"

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

const selectedOwners = ref<StorageOwner[]>([])
const includeSensitive = ref(false)
const busy = ref<"" | "export" | "import">("")
const importRef = ref<{ clear: () => void } | null>(null)

const ownerOptions = computed(() => (props.inventory?.groups || []).map((group) => ({
  value: group.owner,
  label: group.owner === "core"
    ? (props.t.owners?.core || "core")
    : group.owner,
})))

watch(
  () => props.inventory?.groups.map((group) => group.owner).join(",") || "",
  () => {
    if (!selectedOwners.value.length) {
      selectedOwners.value = (props.inventory?.groups || []).map((group) => group.owner)
    }
  },
  { immediate: true },
)

function fill(template: string | undefined, ...args: (string | number)[]): string {
  return (template || "").replace(/\{(\d+)\}/g, (_match, index) => String(args[Number(index)] ?? ""))
}

function errorText(code: string | undefined): string {
  if (!code) return ""
  return props.t.errors?.[code] || code
}

async function handleExport(): Promise<void> {
  if (!selectedOwners.value.length || busy.value) return
  busy.value = "export"
  try {
    const blob = await props.manager.exportModule(selectedOwners.value, {
      includeSensitive: includeSensitive.value,
    })
    triggerBlobDownload(blob, `storage-export-${Date.now()}.json`)
    emit("notify", "success", props.t.transfer?.exportDone || "")
  } catch (error) {
    emit("notify", "error", fill(
      props.t.transfer?.exportFailed,
      error instanceof Error ? error.message : String(error),
    ))
  } finally {
    busy.value = ""
  }
}

async function handleImport(files: File[]): Promise<void> {
  const file = files[0]
  if (!file || busy.value) return
  busy.value = "import"
  try {
    const report = await props.manager.importModule(file)
    const failed = report.failed[0]
    if (failed) {
      emit("notify", "error", fill(props.t.transfer?.importFailed, errorText(failed.error)))
    } else {
      let text = fill(props.t.transfer?.importDone, report.applied.length, report.failed.length)
      if (report.snapshotPath) text += ` · ${fill(props.t.transfer?.snapshotAt, report.snapshotPath)}`
      if (report.requiresReload) text += ` · ${props.t.transfer?.requiresReload}`
      emit("notify", "success", text)
    }
    emit("done")
  } catch (error) {
    emit("notify", "error", fill(
      props.t.transfer?.importFailed,
      error instanceof Error ? error.message : String(error),
    ))
  } finally {
    busy.value = ""
    importRef.value?.clear()
  }
}
</script>

<style lang="scss" scoped>
@use "../styles/index.scss";
</style>
