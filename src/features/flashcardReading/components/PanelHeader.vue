<!-- 单词阅读功能 - 面板标题栏 -->
<template>
  <div class="panel-header-wrapper">
    <div class="panel-header">
      <!-- 面板标题："单词阅读"（独立浮动窗口内隐藏：窗口页签标题已标识功能名，避免重复字样） -->
      <h4
        v-if="!floating"
        class="panel-title"
      >
        <span>{{ t.panelTitle }}</span>
      </h4>
      <!-- 头部操作区：添加/刷新/在独立窗口打开/打开存储文件 -->
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
        <!-- 在独立窗口打开（经 __flashcardReading 的 FlashcardTabManager 调度；浮动窗口内隐藏） -->
        <Button
          v-if="!floating"
          variant="ghost"
          size="xsmall"
          icon="openInNew"
          :title="t.openInWindow"
          @click="$emit('openWindow')"
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

const props = withDefaults(
  defineProps<{
    i18n: I18n
    plugin: Plugin
    /** 独立浮动窗口形态：隐藏重复标题与"在独立窗口打开"按钮 */
    floating?: boolean
  }>(),
  {
    floating: false,
  },
)

defineEmits<{
  addCard: []
  refresh: []
  openWindow: []
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
      showMessage(t.value.openFileFailed, 2000, "error")
    }
  }
}
</script>
