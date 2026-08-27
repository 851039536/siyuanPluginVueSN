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
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :title="i18n.keepOurs"
          @click="$emit('resolveConflict', f.path, 'ours')"
        >
          <Icon
            icon="mdi:file-document-check-outline"
            height="12"
          />
        </button>
        <!-- 悬停提示："保留远程版本" -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :title="i18n.keepTheirs"
          @click="$emit('resolveConflict', f.path, 'theirs')"
        >
          <Icon
            icon="mdi:file-download-outline"
            height="12"
          />
        </button>
      </span>
    </div>
    <div class="gp-conflict-actions">
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
        @click="$emit('abortMerge')"
      >
        <Icon
          icon="mdi:undo"
          height="12"
        />
        <!-- "中止合并" -->
        {{ i18n.abortMerge }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConflictFile } from "../../types"
import { Icon } from "@iconify/vue"

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
@use "../../styles/index.scss";
</style>
