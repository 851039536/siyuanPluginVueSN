<!-- dataSnapshot 数据快照管理面板：本地/云端快照列表、详情、恢复与删除确认 -->
<template>
  <div class="data-snapshot-panel">
    <!-- 头部：标题 + 刷新按钮 -->
    <div class="ds-header">
      <!-- 面板标题："数据快照" -->
      <span class="ds-header__title">{{ i18n.title }}</span>
      <div class="ds-header__actions">
        <!-- 刷新按钮悬浮提示："刷新" -->
        <button
          class="ds-btn ds-btn--icon"
          :title="i18n.refresh"
          @click="currentView === 'cloud' ? loadCloudSnapshots() : loadLocalSnapshots()"
        >
          <IconWrapper
            name="refresh"
            :size="14"
          />
        </button>
      </div>
    </div>

    <!-- 本地/云端页签切换 -->
    <div
      v-if="currentView === 'local' || currentView === 'cloud'"
      class="ds-tabs"
    >
      <!-- 页签："本地" -->
      <button
        class="ds-tabs__item"
        :class="{ 'ds-tabs__item--active': currentView === 'local' }"
        @click="switchTab('local')"
      >
        {{ i18n.tabLocal }}
      </button>
      <!-- 页签："云端" -->
      <button
        class="ds-tabs__item"
        :class="{ 'ds-tabs__item--active': currentView === 'cloud' }"
        @click="switchTab('cloud')"
      >
        {{ i18n.tabCloud }}
      </button>
    </div>

    <!-- 创建快照表单 -->
    <div
      v-if="currentView === 'local'"
      class="ds-create"
    >
      <!-- 输入框占位："输入快照备注..." -->
      <input
        v-model="memo"
        class="ds-create__input"
        :placeholder="i18n.memoPlaceholder"
        @keydown.enter="createSnapshotAction"
      >
      <!-- 创建按钮："创建快照"，创建中显示省略号 -->
      <button
        class="ds-btn ds-btn--primary"
        :disabled="op.creating"
        @click="createSnapshotAction"
      >
        <IconWrapper
          v-if="!op.creating"
          name="plus"
          :size="12"
        />
        {{ op.creating ? "..." : i18n.createSnapshot }}
      </button>
    </div>

    <!-- 内容区 -->
    <div class="ds-content">
      <!-- 本地快照列表 -->
      <div v-if="currentView === 'local'">
        <!-- 加载中提示："正在刷新..." -->
        <div
          v-if="loading"
          class="ds-loading"
        >
          {{ i18n.refreshing }}
        </div>
        <!-- 空状态："暂无快照" -->
        <div
          v-else-if="snapshots.length === 0"
          class="ds-empty"
        >
          {{ i18n.noSnapshots }}
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
              {{ formatSnapshotTime(snap) }}
              <!-- 文件数徽标："文件" -->
              <template v-if="snap.count">
                · {{ snap.count }} {{ i18n.snapshotFiles }}
              </template>
              <!-- 快照大小 -->
              <template v-if="formatSnapshotSize(snap)">
                · {{ formatSnapshotSize(snap) }}
              </template>
            </div>
            <div class="ds-item__actions">
              <!-- 查看按钮："查看" -->
              <button
                class="ds-btn ds-btn--small"
                @click="viewSnapshot(snap)"
              >
                <IconWrapper
                  name="eye"
                  :size="12"
                />
                {{ i18n.view }}
              </button>
              <!-- 恢复按钮："恢复"，点击弹出二次确认 -->
              <button
                class="ds-btn ds-btn--small"
                :disabled="op.restoring === snap.id"
                @click="confirmAction = { kind: 'restore', snap }"
              >
                <IconWrapper
                  name="refreshLeft"
                  :size="12"
                />
                {{ i18n.restore }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 云端快照列表 -->
      <div v-if="currentView === 'cloud'">
        <div
          v-if="cloudLoading"
          class="ds-loading"
        >
          {{ i18n.refreshing }}
        </div>
        <!-- 空状态："暂无云端快照" -->
        <div
          v-else-if="cloudTags.length === 0"
          class="ds-empty"
        >
          {{ i18n.noCloudSnapshots }}
        </div>
        <div v-else>
          <div
            v-for="tag in cloudTags"
            :key="tag.tag"
            class="ds-cloud-tag"
          >
            <div class="ds-cloud-tag__header">
              <span>{{ tag.tag }}</span>
              <div class="ds-cloud-tag__actions">
                <span class="ds-cloud-tag__count">{{ tag.snapshots?.length || 0 }}</span>
                <!-- 删除云端标签按钮："删除云端快照"，点击弹出二次确认 -->
                <button
                  class="ds-btn ds-btn--small ds-btn--danger"
                  :title="i18n.removeCloudTag"
                  :disabled="op.removing === tag.tag"
                  @click="confirmAction = { kind: 'removeTag', tag: tag.tag }"
                >
                  <IconWrapper
                    name="delete"
                    :size="12"
                  />
                </button>
              </div>
            </div>
            <div
              v-for="snap in tag.snapshots"
              :key="snap.id"
              class="ds-item"
            >
              <div class="ds-item__header">
                <span class="ds-item__memo">{{ snap.memo || snap.id }}</span>
              </div>
              <div class="ds-item__time">
                {{ formatSnapshotTime(snap) }}
              </div>
              <div class="ds-item__actions">
                <!-- 下载按钮："下载" / 下载中："正在下载..." -->
                <button
                  class="ds-btn ds-btn--small"
                  :disabled="op.downloading === snap.id"
                  @click="downloadFromCloud(tag.tag, snap.id)"
                >
                  <IconWrapper
                    name="download"
                    :size="12"
                  />
                  {{ op.downloading === snap.id ? i18n.downloading : i18n.download }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 快照详情 -->
      <div v-if="currentView === 'detail' && selectedSnapshot">
        <!-- 返回列表按钮 -->
        <button
          class="ds-detail__back"
          @click="backToList"
        >
          <IconWrapper
            name="back"
            :size="14"
          />
          {{ i18n.snapshotDetail }}
        </button>
        <div class="ds-detail__info">
          <!-- 字段："备注" -->
          <div><strong>{{ i18n.memo }}:</strong> {{ selectedSnapshot.memo }}</div>
          <!-- 字段："创建时间" -->
          <div><strong>{{ i18n.createdAt }}:</strong> {{ formatSnapshotTime(selectedSnapshot) }}</div>
          <!-- 字段："文件数" -->
          <div v-if="selectedSnapshot.count">
            <strong>{{ i18n.fileCount }}:</strong> {{ selectedSnapshot.count }}
          </div>
          <!-- 字段："大小" -->
          <div v-if="formatSnapshotSize(selectedSnapshot)">
            <strong>{{ i18n.size }}:</strong> {{ formatSnapshotSize(selectedSnapshot) }}
          </div>
          <!-- 字段："Tag 更新" -->
          <div v-if="selectedSnapshot.hTagUpdated">
            <strong>{{ i18n.tagUpdated }}:</strong> {{ selectedSnapshot.hTagUpdated }}
          </div>
          <!-- 字段："设备" -->
          <div v-if="selectedSnapshot.systemName">
            <strong>{{ i18n.device }}:</strong> {{ selectedSnapshot.systemName }}
            <template v-if="selectedSnapshot.systemOS">
              ({{ selectedSnapshot.systemOS }})
            </template>
          </div>
        </div>
        <!-- 文件类型分布区块 -->
        <div v-if="selectedSnapshot.typesCount && selectedSnapshot.typesCount.length > 0">
          <!-- 区块标题："文件类型分布" -->
          <div class="ds-detail__section-title">
            {{ i18n.typesDistribution }}
          </div>
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

    <!-- 恢复/删除云端标签 二次确认弹窗 -->
    <div
      v-if="confirmAction"
      class="ds-confirm"
      @click.self="confirmAction = null"
    >
      <div class="ds-confirm__box">
        <div class="ds-confirm__text">
          <!-- 确认文案："确定要恢复此快照吗？当前数据将被覆盖。" / "确定要删除此云端快照吗？" -->
          {{ confirmAction.kind === "restore" ? i18n.restoreConfirm : i18n.removeCloudTagConfirm }}
          <!-- 恢复目标信息（仅恢复确认时显示） -->
          <div
            v-if="confirmAction.kind === 'restore'"
            class="ds-confirm__info"
          >
            <div><strong>{{ i18n.memo }}:</strong> {{ confirmAction.snap.memo || confirmAction.snap.id }}</div>
            <div><strong>{{ i18n.createdAt }}:</strong> {{ formatSnapshotTime(confirmAction.snap) }}</div>
          </div>
        </div>
        <div class="ds-confirm__actions">
          <!-- 取消按钮："取消" -->
          <button
            class="ds-btn"
            @click="confirmAction = null"
          >
            {{ i18n.cancel }}
          </button>
          <!-- 确认按钮："确认恢复" / "删除云端快照" -->
          <button
            class="ds-btn ds-btn--danger"
            :disabled="confirmAction.kind === 'removeTag' && op.removing === confirmAction.tag"
            @click="doConfirm"
          >
            {{ confirmAction.kind === "restore" ? i18n.confirmRestore : i18n.removeCloudTag }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { SnapshotInfo } from "./types"
import { ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useDataSnapshot } from "./composables/useDataSnapshot"
import { formatSnapshotSize, formatSnapshotTime } from "./utils"
import "./styles/index.scss"

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

// 二次确认弹窗状态：恢复快照 / 删除云端标签
const confirmAction = ref<
  | { kind: "restore"; snap: SnapshotInfo }
  | { kind: "removeTag"; tag: string }
  | null
>(null)

function doConfirm() {
  const action = confirmAction.value
  if (!action) return
  confirmAction.value = null
  if (action.kind === "restore") {
    restoreSnapshot(action.snap.id)
  } else {
    removeCloudTag(action.tag)
  }
}
</script>
