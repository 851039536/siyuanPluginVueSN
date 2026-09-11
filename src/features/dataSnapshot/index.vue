<!-- 数据快照面板：本地/云端快照列表、详情查看与恢复/删除二次确认 -->
<template>
  <div class="data-snapshot-panel">
    <!-- 头部：标题 + 刷新 -->
    <div class="ds-header">
      <span class="ds-header__title">{{ i18n.title }}</span>
      <Button
        icon="refresh"
        size="xsmall"
        :title="i18n.refresh"
        :aria-label="i18n.refresh"
        :loading="isRefreshing"
        @click="refresh"
      />
    </div>

    <!-- 本地 / 云端页签 -->
    <div
      v-if="currentView === 'local' || currentView === 'cloud'"
      class="ds-tabs"
    >
      <Button
        v-for="tab in tabs"
        :key="tab.id"
        :variant="currentView === tab.id ? 'primary' : 'ghost'"
        text
        size="xsmall"
        :aria-pressed="currentView === tab.id"
        @click="switchTab(tab.id)"
      >
        {{ tab.label }}
      </Button>
    </div>

    <!-- 创建快照 -->
    <div v-if="currentView === 'local'" class="ds-create">
      <Input
        v-model="memo"
        size="small"
        :placeholder="i18n.memoPlaceholder"
        @keydown.enter="createSnapshotAction"
      />
      <Button
        variant="primary"
        size="small"
        icon="plus"
        :loading="op.creating"
        @click="createSnapshotAction"
      >
        {{ i18n.createSnapshot }}
      </Button>
    </div>

    <!-- 内容区：本地列表 / 云端列表 / 详情 -->
    <div class="ds-content">
      <LocalSnapshotList
        v-if="currentView === 'local'"
        :snapshots="snapshots"
        :loading="loading"
        :restoring-id="op.restoring"
        :i18n="i18n"
        @view="viewSnapshot"
        @restore="askRestore"
      />
      <CloudSnapshotList
        v-else-if="currentView === 'cloud'"
        :tags="cloudTags"
        :loading="cloudLoading"
        :downloading-id="op.downloading"
        :removing-tag="op.removing"
        :i18n="i18n"
        @download="downloadFromCloud"
        @remove-tag="askRemoveTag"
      />
      <SnapshotDetail
        v-else-if="selectedSnapshot"
        :snapshot="selectedSnapshot"
        :i18n="i18n"
        @back="backToList"
      />
    </div>

    <!-- 恢复快照 / 删除云端标签 二次确认 -->
    <ConfirmDialog
      v-model:visible="confirmVisible"
      :header="confirmMeta.title"
      :accept-label="confirmMeta.confirmText"
      :accept-loading="confirmMeta.loading"
      @confirm="doConfirm"
    >
      <p class="ds-confirm-text">{{ confirmMeta.message }}</p>
      <div v-if="confirmAction?.kind === 'restore'" class="ds-confirm-info">
        <div>
          <span class="ds-detail__key">{{ i18n.memo }}:</span>
          {{ confirmAction.snap.memo || confirmAction.snap.id }}
        </div>
        <div>
          <span class="ds-detail__key">{{ i18n.createdAt }}:</span>
          {{ formatSnapshotTime(confirmAction.snap) }}
        </div>
      </div>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { SnapshotInfo } from "./types"
import { computed, ref } from "vue"
import Button from "@/components/Button.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import Input from "@/components/Input.vue"
import CloudSnapshotList from "./components/CloudSnapshotList.vue"
import LocalSnapshotList from "./components/LocalSnapshotList.vue"
import SnapshotDetail from "./components/SnapshotDetail.vue"
import { useDataSnapshot } from "./composables/useDataSnapshot"
import { formatSnapshotTime } from "./utils"

/** 二次确认场景：恢复本地快照 / 删除云端标签 */
type ConfirmAction =
  | { kind: "restore", snap: SnapshotInfo }
  | { kind: "removeTag", tag: string }

const props = defineProps<{
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

/** 页签配置（文案随 i18n 变化） */
const tabs = computed(() => [
  { id: "local" as const, label: i18n.value.tabLocal },
  { id: "cloud" as const, label: i18n.value.tabCloud },
])

/** 当前视图是否正在刷新（驱动刷新按钮加载态） */
const isRefreshing = computed(() =>
  currentView.value === "cloud" ? cloudLoading.value : loading.value,
)

function refresh(): void {
  if (currentView.value === "cloud") {
    void loadCloudSnapshots()
  } else {
    void loadLocalSnapshots()
  }
}

const confirmAction = ref<ConfirmAction | null>(null)

/** 打开恢复确认 */
function askRestore(snap: SnapshotInfo): void {
  confirmAction.value = { kind: "restore", snap }
}

/** 打开删除云端标签确认 */
function askRemoveTag(tag: string): void {
  confirmAction.value = { kind: "removeTag", tag }
}

/** 确认弹窗可见性（受控：关闭即清空待确认动作） */
const confirmVisible = computed({
  get: () => confirmAction.value !== null,
  set: (visible: boolean) => {
    if (!visible) {
      confirmAction.value = null
    }
  },
})

/** 确认弹窗文案与确认按钮加载态（按场景派生） */
const confirmMeta = computed(() => {
  const action = confirmAction.value
  if (!action) {
    return { title: "", message: "", confirmText: "", loading: false }
  }
  if (action.kind === "restore") {
    return {
      title: i18n.value.restoreTitle || i18n.value.restore,
      message: i18n.value.restoreConfirm,
      confirmText: i18n.value.confirmRestore,
      loading: op.restoring === action.snap.id,
    }
  }
  return {
    title: i18n.value.removeCloudTagTitle || i18n.value.removeCloudTag,
    message: i18n.value.removeCloudTagConfirm,
    confirmText: i18n.value.removeCloudTag,
    loading: op.removing === action.tag,
  }
})

function doConfirm(): void {
  const action = confirmAction.value
  if (!action) {
    return
  }
  confirmAction.value = null
  if (action.kind === "restore") {
    void restoreSnapshot(action.snap.id)
  } else {
    void removeCloudTag(action.tag)
  }
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
