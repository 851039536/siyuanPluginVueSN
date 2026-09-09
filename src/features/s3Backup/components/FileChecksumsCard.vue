<!-- 文件校验卡片容器 — 组合拖放校验与已存储校验值两个子区，持有 BackupManager 惰性缓存 -->
<template>
  <div class="checksums-container">
    <!-- 拖放文件即时校验 -->
    <DropVerifySection
      :stored-items="storedItems"
      :compute-hash="computeHash"
      :has-workspace="!!workspaceRoot"
      :i18n="i18n"
    />

    <!-- 已存储校验值列表 -->
    <StoredChecksumsSection
      :stored-items="storedItems"
      :compute-hash="computeHash"
      :i18n="i18n"
      @clear="emit('clear')"
      @remove-one="emit('removeOne', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { showMessage } from "siyuan"
import { getErrorMessage } from "@/utils/stringUtils"
import type { FileChecksum } from "../types"
import { BackupManager } from "../modules/BackupManager"
import DropVerifySection from "./checksums/DropVerifySection.vue"
import StoredChecksumsSection from "./checksums/StoredChecksumsSection.vue"

const props = defineProps<{
  storedItems: FileChecksum[]
  workspaceRoot: string
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  (e: "clear"): void
  (e: "removeOne", fileName: string): void
}>()

/** BackupManager 惰性缓存（实例级，workspaceRoot 变化时重建，避免每次校验重复创建） */
let cachedManager: BackupManager | null = null
let cachedRoot = ""

function getManager(): BackupManager | null {
  if (!props.workspaceRoot) { return null }
  if (!cachedManager || cachedRoot !== props.workspaceRoot) {
    try {
      cachedManager = new BackupManager(props.workspaceRoot)
      cachedRoot = props.workspaceRoot
    } catch (err: unknown) {
      showMessage(getErrorMessage(err), 3000, "error")
      return null
    }
  }
  return cachedManager
}

/** 计算文件 SHA-256 校验值；工作区未就绪时返回 null（由调用方决定提示策略） */
async function computeHash(filePath: string): Promise<string | null> {
  const manager = getManager()
  if (!manager) { return null }
  return manager.computeFileHash(filePath)
}
</script>

<style scoped lang="scss">
@use "../styles/FileChecksumsCard.scss";
@use "../styles/index.scss";
</style>
