<!-- 路径栏：路径文本可点击打开目录 + 打开目录 / 复制路径按钮 -->
<template>
  <div class="sm-pathbar">
    <span class="sm-pathbar__label">{{ label }}</span>
    <button
      type="button"
      class="sm-pathbar__path"
      :title="path || emptyText"
      :aria-label="`${openLabel}: ${path || emptyText}`"
      :disabled="!path"
      @click="openFolder"
    >
      {{ path || emptyText }}
    </button>
    <!-- 打开目录："打开目录" -->
    <Button
      variant="ghost"
      size="xsmall"
      dense
      icon="folderOpen"
      :title="openLabel"
      :disabled="!path"
      @click="openFolder"
    />
    <!-- 复制路径："复制路径" -->
    <Button
      variant="ghost"
      size="xsmall"
      dense
      icon="copy"
      :title="copyLabel"
      :disabled="!path"
      @click="copyPath"
    />
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { openFolderInExplorer } from "@/utils/electronDialog"

interface Props {
  label: string
  path: string
  emptyText: string
  openLabel: string
  copyLabel: string
  openFailedText: string
  copiedText: string
  copyFailedText: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  notify: [severity: "success" | "error", text: string]
}>()

async function openFolder(): Promise<void> {
  if (!props.path) return
  const ok = await openFolderInExplorer(props.path)
  if (!ok) emit("notify", "error", props.openFailedText)
}

async function copyPath(): Promise<void> {
  if (!props.path) return
  const ok = await copyToClipboard(props.path)
  emit("notify", ok ? "success" : "error", ok ? props.copiedText : props.copyFailedText)
}
</script>

<style lang="scss" scoped>
@use "../styles/PathBar.scss";
</style>
