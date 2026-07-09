<!-- 单词阅读功能 - 面板标题栏 -->
<template>
  <div class="panel-header-wrapper">
    <div class="panel-header">
      <h4 class="panel-title">
        <span>{{ t.panelTitle }}</span>
      </h4>
      <div class="header-actions">
        <Button
          variant="ghost"
          size="xsmall"
          icon="add"
          :title="t.addCard"
          @click="$emit('addCard')"
        />
        <Button
          variant="ghost"
          size="xsmall"
          icon="refresh"
          :title="t.refresh"
          @click="$emit('refresh')"
        />
        <Button
          variant="ghost"
          size="xsmall"
          icon="folder-open-outline"
          :title="storagePath"
          @click="openPath"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { I18n } from "../types"
import { showMessage } from "siyuan"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import { useI18n } from "../composables/useI18n"
import { STORAGE_KEY } from "../types/storage"

const props = defineProps<{
  i18n: I18n
  plugin: Plugin
}>()

defineEmits<{
  addCard: []
  refresh: []
}>()

const t = useI18n(props.i18n)

const storagePath = computed(() => {
  const base = (props.plugin as any).getDataDir?.() || ""
  return base
    ? `${base.replace(/\/$/, "")}/${STORAGE_KEY}.json`
    : `storage/petal/siyuan-plugin-vite-vue-sn/${STORAGE_KEY}.json`
})

const openPath = async () => {
  if (typeof window.require === "function") {
    try {
      const { shell } = window.require("electron")
      await shell.openPath(storagePath.value)
    } catch {
      showMessage("打开文件失败", 2000, "error")
    }
  }
}
</script>
