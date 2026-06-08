<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { SnapshotDiffData, SnapshotInfo, SnapshotContentFile } from "./types"
import { ref } from "vue"
import { useDataSnapshot } from "./composables/useDataSnapshot"
import "./styles/index.scss"

const props = defineProps<{
  i18n?: any
  plugin: Plugin
}>()

const {
  currentView,
  snapshots,
  cloudTags,
  selectedSnapshot,
  diffData,
  memo,
  compareMode,
  compareIds,
  loading,
  cloudLoading,
  op,
  i18n,
  loadLocalSnapshots,
  createSnapshotAction,
  viewSnapshot,
  restoreSnapshot,
  loadCloudSnapshots,
  downloadFromCloud,
  removeCloudTag,
  toggleCompare,
  compareSnapshots,
  backToList,
  switchTab,
} = useDataSnapshot(props.plugin)

const restoreTarget = ref<string | null>(null)

function confirmRestore(id: string) {
  restoreTarget.value = id
}

function doRestore() {
  if (restoreTarget.value) {
    restoreSnapshot(restoreTarget.value)
    restoreTarget.value = null
  }
}

function cancelRestore() {
  restoreTarget.value = null
}

function formatTime(s: SnapshotInfo): string {
  if (s.hCreated) return s.hCreated
  if (s.hCreateTime) return s.hCreateTime
  if (s.created) return new Date(s.created).toLocaleString()
  const raw = s.createTime
  if (!raw) return ""
  const num = Number(raw)
  if (!isNaN(num) && num > 1000000000) {
    return new Date(num * 1000).toLocaleString()
  }
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toLocaleString()
  return raw
}

function getFileStatusClass(status: string): string {
  if (status === "add") return "ds-detail__file-status--add"
  if (status === "remove") return "ds-detail__file-status--remove"
  return "ds-detail__file-status--modify"
}

function getAllDiffPaths(data: SnapshotDiffData): string[] {
  const paths = new Set<string>()
  for (const f of data.snapshotA.files) paths.add(f.path)
  for (const f of data.snapshotB.files) paths.add(f.path)
  return Array.from(paths).sort()
}

function findFileStatus(files: SnapshotContentFile[], path: string): string {
  return files.find(f => f.path === path)?.status || ""
}
</script>

<template>
  <div class="data-snapshot-panel">
    <!-- Header -->
    <div class="ds-header">
      <span class="ds-header__title">{{ i18n.title || "数据快照" }}</span>
      <div class="ds-header__actions">
        <button
          class="ds-btn ds-btn--icon"
          :title="i18n.refresh || '刷新'"
          @click="currentView === 'cloud' ? loadCloudSnapshots() : loadLocalSnapshots()"
        >
          <svg class="svg-icon" viewBox="0 0 1024 1024" width="16" height="16">
            <path d="M934.4 193.6v243.2c0 17.6-14.4 32-32 32s-32-14.4-32-32V257.6c-62.4 70.4-148.8 115.2-243.2 115.2-177.6 0-321.6-144-321.6-321.6 0-17.6 14.4-32 32-32s32 14.4 32 32c0 142.4 115.2 257.6 257.6 257.6 76.8 0 147.2-33.6 196.8-86.4v-84.8c0-17.6 14.4-32 32-32s32 14.4 32 32v1.6zM513.6 897.6c-76.8 0-147.2-33.6-196.8-86.4v84.8c0 17.6-14.4 32-32 32s-32-14.4-32-32v-243.2c0-17.6 14.4-32 32-32h243.2c17.6 0 32 14.4 32 32s-14.4 32-32 32H291.2c62.4-70.4 148.8-115.2 243.2-115.2 177.6 0 321.6 144 321.6 321.6 0 17.6-14.4 32-32 32s-32-14.4-32-32c0-142.4-115.2-257.6-257.6-257.6z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div v-if="currentView === 'local' || currentView === 'cloud'" class="ds-tabs">
      <button
        class="ds-tabs__item"
        :class="{ 'ds-tabs__item--active': currentView === 'local' }"
        @click="switchTab('local')"
      >
        {{ i18n.tabLocal || "本地" }}
      </button>
      <button
        class="ds-tabs__item"
        :class="{ 'ds-tabs__item--active': currentView === 'cloud' }"
        @click="switchTab('cloud')"
      >
        {{ i18n.tabCloud || "云端" }}
      </button>
    </div>

    <!-- Create form (local tab only) -->
    <div v-if="currentView === 'local'" class="ds-create">
      <input
        v-model="memo"
        class="ds-create__input"
        :placeholder="i18n.memoPlaceholder || '输入快照备注...'"
        @keydown.enter="createSnapshotAction"
      >
      <button
        class="ds-btn ds-btn--primary"
        :disabled="op.creating"
        @click="createSnapshotAction"
      >
        {{ op.creating ? "..." : (i18n.createSnapshot || "创建快照") }}
      </button>
    </div>

    <!-- Compare bar -->
    <div v-if="compareMode && currentView === 'local'" class="ds-compare-bar">
      <span>{{ compareIds?.filter(Boolean).length || 0 }}/2 {{ i18n.selectSnapshotToCompare || "选择要对比的快照" }}</span>
      <div style="display:flex;gap:4px;">
        <button
          class="ds-btn ds-btn--primary ds-btn--small"
          :disabled="!compareIds || compareIds.filter(Boolean).length < 2"
          @click="compareSnapshots()"
        >
          {{ i18n.compare || "对比" }}
        </button>
        <button class="ds-btn ds-btn--small" @click="compareMode=false;compareIds=null">
          {{ i18n.cancel || "取消" }}
        </button>
      </div>
    </div>

    <!-- Content area -->
    <div class="ds-content">
      <!-- Local snapshot list -->
      <div v-if="currentView === 'local'">
        <div v-if="loading" class="ds-list__loading">{{ i18n.refreshing || "加载中..." }}</div>
        <div v-else-if="snapshots.length === 0" class="ds-list__empty">
          {{ i18n.noSnapshots || "暂无快照" }}
        </div>
        <div v-else class="ds-list">
          <div
            v-for="snap in snapshots"
            :key="snap.id"
            class="ds-item"
          >
            <div class="ds-item__header">
              <span class="ds-item__memo">{{ snap.memo || snap.id }}</span>
              <label v-if="compareMode" class="ds-item__compare-check">
                <input
                  type="checkbox"
                  :checked="compareIds?.[0] === snap.id || compareIds?.[1] === snap.id"
                  @change="toggleCompare(snap.id)"
                >
              </label>
            </div>
            <div class="ds-item__time">{{ formatTime(snap) }}</div>
            <div class="ds-item__actions">
              <button
                class="ds-btn ds-btn--small"
                :disabled="op.loadingContent === snap.id"
                @click="viewSnapshot(snap.id)"
              >
                {{ i18n.view || "查看" }}
              </button>
              <button
                class="ds-btn ds-btn--small"
                :disabled="op.restoring === snap.id"
                @click="confirmRestore(snap.id)"
              >
                {{ i18n.restore || "恢复" }}
              </button>
              <button
                v-if="!compareMode"
                class="ds-btn ds-btn--small ds-btn--compare"
                @click="compareMode=true;toggleCompare(snap.id)"
              >
                {{ i18n.snapshotDiff || "对比" }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cloud snapshot list -->
      <div v-if="currentView === 'cloud'">
        <div v-if="cloudLoading" class="ds-list__loading">{{ i18n.refreshing || "加载中..." }}</div>
        <div v-else-if="cloudTags.length === 0" class="ds-list__empty">
          {{ i18n.noCloudSnapshots || "暂无云端快照" }}
        </div>
        <div v-else>
          <div v-for="tag in cloudTags" :key="tag.tag" class="ds-cloud-tag">
            <div class="ds-cloud-tag__header">
              <span>{{ tag.tag }}</span>
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="ds-cloud-tag__count">{{ tag.snapshots?.length || 0 }}</span>
                <button
                  class="ds-btn ds-btn--small ds-btn--danger"
                  :disabled="op.removing === tag.tag"
                  @click="removeCloudTag(tag.tag)"
                >
                  {{ i18n.removeCloudTag || "删除" }}
                </button>
              </div>
            </div>
            <div v-for="snap in tag.snapshots" :key="snap.id" class="ds-item">
              <div class="ds-item__header">
                <span class="ds-item__memo">{{ snap.memo || snap.id }}</span>
              </div>
              <div class="ds-item__time">{{ formatTime(snap) }}</div>
              <div class="ds-item__actions">
                <button
                  class="ds-btn ds-btn--small"
                  :disabled="op.downloading === snap.id"
                  @click="downloadFromCloud(tag.tag, snap.id)"
                >
                  {{ op.downloading === snap.id ? (i18n.downloading || "下载中...") : (i18n.download || "下载") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail view -->
      <div v-if="currentView === 'detail' && selectedSnapshot">
        <button class="ds-detail__back" @click="backToList">
          <svg viewBox="0 0 1024 1024" width="14" height="14">
            <path d="M724 218.3V141c0-6.7-7.7-10.4-12.9-6.3L260.3 486.8c-3.9 3.1-3.9 9.2 0 12.3l450.8 352.1c5.3 4.1 12.9.4 12.9-6.3v-77.3c0-4.9-2.3-9.6-6.1-12.6l-364.2-276.1 364.2-276.1c3.8-3 6.1-7.7 6.1-12.6z" fill="currentColor"/>
          </svg>
          {{ i18n.snapshotDetail || "快照详情" }}
        </button>
        <div class="ds-detail__info">
          <div>{{ i18n.memo || "备注" }}: {{ selectedSnapshot.snapshot.memo }}</div>
          <div>{{ i18n.createdAt || "创建时间" }}: {{ formatTime(selectedSnapshot.snapshot) }}</div>
          <div>{{ i18n.snapshotFiles || "文件" }}: {{ selectedSnapshot.files.length }}</div>
        </div>
        <div class="ds-detail__file-list">
          <div v-for="file in selectedSnapshot.files" :key="file.path" class="ds-detail__file">
            <span class="ds-detail__file-path" :title="file.path">{{ file.path }}</span>
            <span class="ds-detail__file-status" :class="getFileStatusClass(file.status)">{{ file.status }}</span>
          </div>
          <div v-if="selectedSnapshot.files.length === 0" class="ds-list__empty">
            {{ i18n.noChanges || "无变更" }}
          </div>
        </div>
      </div>

      <!-- Diff view -->
      <div v-if="currentView === 'diff' && diffData">
        <button class="ds-diff__back" @click="backToList">
          <svg viewBox="0 0 1024 1024" width="14" height="14">
            <path d="M724 218.3V141c0-6.7-7.7-10.4-12.9-6.3L260.3 486.8c-3.9 3.1-3.9 9.2 0 12.3l450.8 352.1c5.3 4.1 12.9.4 12.9-6.3v-77.3c0-4.9-2.3-9.6-6.1-12.6l-364.2-276.1 364.2-276.1c3.8-3 6.1-7.7 6.1-12.6z" fill="currentColor"/>
          </svg>
          {{ i18n.snapshotDiff || "差异对比" }}
        </button>
        <div class="ds-diff__header">
          <span>{{ diffData.snapshotA.snapshot.memo || diffData.snapshotA.snapshot.id }}</span>
          <span>vs</span>
          <span>{{ diffData.snapshotB.snapshot.memo || diffData.snapshotB.snapshot.id }}</span>
        </div>
        <div v-if="getAllDiffPaths(diffData).length === 0" class="ds-diff__empty">
          {{ i18n.noChanges || "无变更" }}
        </div>
        <div v-else class="ds-diff__files">
          <div v-for="diffPath in getAllDiffPaths(diffData)" :key="diffPath" class="ds-diff__file">
            <span class="ds-diff__file-path" :title="diffPath">{{ diffPath }}</span>
            <div class="ds-diff__file-indicators">
              <span
                v-if="findFileStatus(diffData.snapshotA.files, diffPath)"
                class="ds-detail__file-status"
                :class="getFileStatusClass(findFileStatus(diffData.snapshotA.files, diffPath))"
              >
                A: {{ findFileStatus(diffData.snapshotA.files, diffPath) }}
              </span>
              <span
                v-if="findFileStatus(diffData.snapshotB.files, diffPath)"
                class="ds-detail__file-status"
                :class="getFileStatusClass(findFileStatus(diffData.snapshotB.files, diffPath))"
              >
                B: {{ findFileStatus(diffData.snapshotB.files, diffPath) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Restore confirm dialog -->
    <div v-if="restoreTarget" class="ds-confirm" @click.self="cancelRestore">
      <div class="ds-confirm__box">
        <div class="ds-confirm__text">{{ i18n.restoreConfirm || "确定要恢复此快照吗？当前数据将被覆盖。" }}</div>
        <div class="ds-confirm__actions">
          <button class="ds-btn" @click="cancelRestore">{{ i18n.cancel || "取消" }}</button>
          <button class="ds-btn ds-btn--danger" @click="doRestore">{{ i18n.confirmRestore || "确认恢复" }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
