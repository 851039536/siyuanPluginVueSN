<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { SnapshotInfo } from "./types"
import { ref } from "vue"
import { useDataSnapshot } from "./composables/useDataSnapshot"
import IconWrapper from "@/components/IconWrapper.vue"
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
  memo,
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
  backToList,
  switchTab,
} = useDataSnapshot(props.plugin)

const restoreTarget = ref<SnapshotInfo | null>(null)

function confirmRestore(snap: SnapshotInfo) {
  restoreTarget.value = snap
}

function doRestore() {
  if (restoreTarget.value) {
    restoreSnapshot(restoreTarget.value.id)
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

function formatSize(s: SnapshotInfo): string {
  if (s.hSize) return s.hSize
  if (s.size) {
    if (s.size > 1073741824) return `${(s.size / 1073741824).toFixed(2)} GB`
    if (s.size > 1048576) return `${(s.size / 1048576).toFixed(2)} MB`
    if (s.size > 1024) return `${(s.size / 1024).toFixed(2)} KB`
    return `${s.size} B`
  }
  return ""
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
          <IconWrapper name="refresh" :size="14" />
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

    <!-- Create form -->
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
        <IconWrapper v-if="!op.creating" name="plus" :size="12" />
        {{ op.creating ? "..." : (i18n.createSnapshot || "创建快照") }}
      </button>
    </div>

    <!-- Content -->
    <div class="ds-content">
      <!-- Local -->
      <div v-if="currentView === 'local'">
        <div v-if="loading" class="ds-loading">{{ i18n.refreshing || "加载中..." }}</div>
        <div v-else-if="snapshots.length === 0" class="ds-empty">
          {{ i18n.noSnapshots || "暂无快照" }}
        </div>
        <div v-else>
          <div
            v-for="snap in snapshots"
            :key="snap.id"
            class="ds-item"
          >
            <div class="ds-item__header">
              <span class="ds-item__memo">{{ snap.memo || snap.id }}</span>
            </div>
            <div class="ds-item__time">
              {{ formatTime(snap) }}
              <template v-if="snap.count"> · {{ snap.count }} {{ i18n.snapshotFiles || "文件" }}</template>
              <template v-if="formatSize(snap)"> · {{ formatSize(snap) }}</template>
            </div>
            <div class="ds-item__actions">
              <button class="ds-btn ds-btn--small" @click="viewSnapshot(snap)">
                <IconWrapper name="eye" :size="12" />
                {{ i18n.view || "查看" }}
              </button>
              <button
                class="ds-btn ds-btn--small"
                :disabled="op.restoring === snap.id"
                @click="confirmRestore(snap)"
              >
                <IconWrapper name="refreshLeft" :size="12" />
                {{ i18n.restore || "恢复" }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cloud -->
      <div v-if="currentView === 'cloud'">
        <div v-if="cloudLoading" class="ds-loading">{{ i18n.refreshing || "加载中..." }}</div>
        <div v-else-if="cloudTags.length === 0" class="ds-empty">
          {{ i18n.noCloudSnapshots || "暂无云端快照" }}
        </div>
        <div v-else>
          <div v-for="tag in cloudTags" :key="tag.tag" class="ds-cloud-tag">
            <div class="ds-cloud-tag__header">
              <span>{{ tag.tag }}</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="ds-cloud-tag__count">{{ tag.snapshots?.length || 0 }}</span>
                <button
                  class="ds-btn ds-btn--small ds-btn--danger"
                  :disabled="op.removing === tag.tag"
                  @click="removeCloudTag(tag.tag)"
                >
                  <IconWrapper name="delete" :size="12" />
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
                  <IconWrapper name="download" :size="12" />
                  {{ op.downloading === snap.id ? (i18n.downloading || "下载中...") : (i18n.download || "下载") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail -->
      <div v-if="currentView === 'detail' && selectedSnapshot">
        <button class="ds-detail__back" @click="backToList">
          <IconWrapper name="back" :size="14" />
          {{ i18n.snapshotDetail || "快照详情" }}
        </button>
        <div class="ds-detail__info">
          <div><strong>{{ i18n.memo || "备注" }}:</strong> {{ selectedSnapshot.memo }}</div>
          <div><strong>{{ i18n.createdAt || "创建时间" }}:</strong> {{ formatTime(selectedSnapshot) }}</div>
          <div v-if="selectedSnapshot.count">
            <strong>{{ i18n.snapshotFiles || "文件数" }}:</strong> {{ selectedSnapshot.count }}
          </div>
          <div v-if="formatSize(selectedSnapshot)">
            <strong>大小:</strong> {{ formatSize(selectedSnapshot) }}
          </div>
          <div v-if="selectedSnapshot.hTagUpdated">
            <strong>Tag 更新:</strong> {{ selectedSnapshot.hTagUpdated }}
          </div>
          <div v-if="selectedSnapshot.systemName">
            <strong>设备:</strong> {{ selectedSnapshot.systemName }}
            <template v-if="selectedSnapshot.systemOS"> ({{ selectedSnapshot.systemOS }})</template>
          </div>
        </div>
        <div v-if="selectedSnapshot.typesCount && selectedSnapshot.typesCount.length > 0">
          <div class="ds-detail__section-title" style="padding: 0 12px;">文件类型分布</div>
          <div
            v-for="tc in selectedSnapshot.typesCount"
            :key="tc.type"
            class="ds-detail__type-row"
          >
            <span class="ds-detail__type-row-ext">{{ tc.type }}</span>
            <span class="ds-detail__type-row-count">{{ tc.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Restore confirm -->
    <div v-if="restoreTarget" class="ds-confirm" @click.self="cancelRestore">
      <div class="ds-confirm__box">
        <div class="ds-confirm__text">
          {{ i18n.restoreConfirm || "确定要恢复此快照吗？当前数据将被覆盖。" }}
          <div style="margin-top:8px;padding:8px;background:var(--b3-theme-surface);border-radius:4px;font-size:12px;">
            <div><strong>{{ i18n.memo || "备注" }}:</strong> {{ restoreTarget.memo || restoreTarget.id }}</div>
            <div><strong>{{ i18n.createdAt || "时间" }}:</strong> {{ formatTime(restoreTarget) }}</div>
          </div>
        </div>
        <div class="ds-confirm__actions">
          <button class="ds-btn" @click="cancelRestore">{{ i18n.cancel || "取消" }}</button>
          <button class="ds-btn ds-btn--danger" @click="doRestore">{{ i18n.confirmRestore || "确认恢复" }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
