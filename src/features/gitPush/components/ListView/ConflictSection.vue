<!-- Git 冲突信息展示区 -->
<template>
  <div
    v-if="conflicts?.length"
    class="gp-conflict-bar"
  >
    <div class="gp-conflict-header">
      <Icon
        icon="mdi:alert-circle"
        height="12"
      />
      <!-- 冲突标题（"检测到合并冲突" + 共 N 个文件） -->
      <span>{{ i18n.conflictDetected }}（{{ i18n.conflictFileCount.replace('{0}', String(conflicts.length)) }}）</span>
    </div>
    <div class="gp-conflict-files">
      <span
        v-for="f in conflicts.slice(0, 5)"
        :key="f.path"
        class="gp-conflict-file"
      >
        {{ f.path }}
        <!-- 悬停提示："保留本地版本" -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          icon="fileDocumentCheckOutline"
          :title="i18n.keepOurs"
          @click="$emit('resolveConflict', f.path, 'ours')"
        />
        <!-- 悬停提示："保留远程版本" -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          icon="fileDownloadOutline"
          :title="i18n.keepTheirs"
          @click="$emit('resolveConflict', f.path, 'theirs')"
        />
      </span>
    </div>
    <div class="gp-conflict-actions">
      <!-- "中止合并"（危险操作：悬停变红由 .gp-btn-danger 提供） -->
      <Button
        class="gp-btn-danger"
        variant="ghost"
        size="xsmall"
        dense
        icon="refreshLeft"
        @click="$emit('abortMerge')"
      >
        {{ i18n.abortMerge }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConflictFile } from "../../types"
import { Icon } from "@iconify/vue"
import Button from "@/components/Button.vue"

defineProps<{
  conflicts: ConflictFile[] | undefined
  i18n: Record<string, any>
}>()

defineEmits<{
  resolveConflict: [file: string, strategy: "theirs" | "ours"]
  abortMerge: []
}>()
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/index.scss";
</style>
