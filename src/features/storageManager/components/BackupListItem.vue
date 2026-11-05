<!-- 数据管理 - 备份列表项：时间/大小 + 还原/删除 -->
<template>
  <div class="sm-backup-item">
    <div class="sm-backup-item__info">
      <span class="sm-backup-item__name" :title="item.fileName">{{ item.fileName }}</span>
      <span class="sm-backup-item__meta">{{ formatBytes(item.size) }} · {{ formatTime(item.createdAt) }}</span>
    </div>
    <div class="sm-backup-item__actions">
      <!-- 还原按钮："还原" -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="upload"
        :title="t.transfer?.restore"
        @click="ask('restore')"
      />
      <!-- 删除按钮："删除" -->
      <Button
        variant="ghost"
        severity="danger"
        size="xsmall"
        dense
        icon="delete"
        :title="t.transfer?.delete"
        @click="ask('delete')"
      />
    </div>

    <ConfirmDialog
      v-model:visible="confirmVisible"
      :header="confirmHeader"
      :message="confirmMessage"
      :accept-label="t.confirm"
      :reject-label="t.cancel"
      accept-severity="danger"
      @confirm="confirm"
      @cancel="confirmVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { PluginBackupListItem } from "@/utils/settingsBackup"
import { computed, ref } from "vue"
import Button from "@/components/Button.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import { formatBytes, formatTime } from "../utils"

interface Props {
  item: PluginBackupListItem
  t: Record<string, any>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  restore: [filePath: string]
  delete: [fileName: string]
}>()

type ConfirmMode = "restore" | "delete"
const confirmVisible = ref(false)
const mode = ref<ConfirmMode>("restore")

const confirmHeader = computed(() => mode.value === "restore"
  ? props.t.transfer?.restore
  : props.t.transfer?.deleteTitle)
const confirmMessage = computed(() => mode.value === "restore"
  ? props.t.transfer?.restoreConfirm
  : (props.t.transfer?.deleteConfirm || "").replace("{0}", props.item.fileName))

function ask(next: ConfirmMode): void {
  mode.value = next
  confirmVisible.value = true
}

function confirm(): void {
  confirmVisible.value = false
  if (mode.value === "restore") emit("restore", props.item.filePath)
  else emit("delete", props.item.fileName)
}
</script>

<style lang="scss" scoped>
@use "../styles/BackupListItem.scss";
@use "../styles/index.scss";
</style>
