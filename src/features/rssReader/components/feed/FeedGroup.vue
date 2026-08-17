<!--
  RSS 订阅源分组列表 — 分组折叠/重命名/移动/删除/刷新
-->
<template>
  <div class="feed-group">
    <div
      class="feed-group-header"
      @click="emit('toggleCollapse', groupItem.group)"
    >
      <Icon
        :icon="collapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'"
        class="group-collapse-icon"
      />
      <template v-if="renaming">
        <input
          v-model="renameValue"
          class="group-rename-input"
          @click.stop
          @keydown.enter="confirmRename"
          @keydown.escape="cancelRename"
          @blur="confirmRename"
        >
      </template>
      <template v-else>
        <span class="group-label">{{ groupItem.label }}</span>
      </template>
      <span class="group-count">{{ groupItem.feeds.length }}</span>
      <span class="group-unread">{{ unreadCount || '' }}</span>
      <!-- 重命名分组按钮 -->
      <button
        v-if="groupItem.group"
        class="group-action-btn"
        :title="i18n.renameGroup"
        @click.stop="startRename"
      >
        <Icon icon="mdi:pencil-outline" />
      </button>
    </div>

    <template v-if="!collapsed">
      <div
        v-for="feed in groupItem.feeds"
        :key="feed.id"
        class="feed-item"
        @click="emit('selectFeed', feed.id)"
      >
        <div class="feed-icon">
          <img
            v-if="feed.iconUrl"
            :src="feed.iconUrl"
            :alt="feed.title"
          >
          <Icon
            v-else
            icon="mdi:rss"
          />
        </div>
        <div class="feed-info">
          <div class="feed-title">
            {{ feed.title }}
          </div>
          <div class="feed-url">
            {{ feed.url }}
          </div>
        </div>
        <span
          v-if="unreadByFeed[feed.id]"
          class="feed-unread"
        >{{ unreadByFeed[feed.id] }}</span>
        <div class="feed-actions">
          <!-- 刷新订阅源按钮 -->
          <button
            :title="i18n.refresh"
            @click.stop="emit('refreshFeed', feed.id)"
          >
            <Icon
              :icon="refreshingFeedIds.has(feed.id) ? 'mdi:loading' : 'mdi:refresh'"
              :class="{ 'loading-icon': refreshingFeedIds.has(feed.id) }"
            />
          </button>
          <!-- 移动分组按钮 -->
          <button
            :title="i18n.moveToGroup"
            @click.stop="toggleMoveMenu(feed.id)"
          >
            <Icon icon="mdi:folder-outline" />
          </button>
          <!-- 删除订阅源按钮 -->
          <button
            :title="i18n.delete"
            @click.stop="emit('deleteFeed', feed.id)"
          >
            <Icon icon="mdi:delete-outline" />
          </button>
        </div>

        <!-- 移动分组下拉菜单 -->
        <div
          v-if="moveMenuFeedId === feed.id"
          class="move-group-menu"
          @click.stop
        >
          <div
            class="move-option"
            :class="{ active: !feed.group }"
            @click="moveFeed(feed.id, '')"
          >
            <!-- 移动分组选项："未分组" -->
            {{ i18n.ungrouped }}
          </div>
          <div
            v-for="g in groups"
            :key="g"
            class="move-option"
            :class="{ active: feed.group === g }"
            @click="moveFeed(feed.id, g)"
          >
            {{ g }}
          </div>
          <div class="move-option new-group-option">
            <!-- 新分组名称输入框 -->
            <input
              v-model="newGroup"
              :placeholder="i18n.newGroup"
              @keydown.enter="moveToNewGroup(feed.id)"
            >
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
} from "vue"
import type { RssGroupItem } from "../../types"

interface Props {
  i18n: Record<string, string>
  groupItem: RssGroupItem
  collapsed: boolean
  /** 分组当前未读总数 */
  unreadCount: number
  /** 每个订阅源的未读数 */
  unreadByFeed: Record<string, number>
  refreshingFeedIds: Set<string>
  groups: string[]
  /** 是否重命名中（外部控制，仅当前分组为 true） */
  renaming: boolean
  /** 重命名输入框当前值（外部初始化） */
  renameValue: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggleCollapse: [group: string]
  selectFeed: [feedId: string]
  refreshFeed: [feedId: string]
  deleteFeed: [feedId: string]
  renameGroup: [oldName: string, newName: string]
  renameStart: [group: string, label: string]
  renameCancel: []
  renameValueChange: [value: string]
  moveFeed: [feedId: string, group: string]
}>()

const moveMenuFeedId = ref("")
const newGroup = ref("")

const renameValue = computed({
  get: () => props.renameValue,
  set: (v: string) => emit("renameValueChange", v),
})

function startRename() {
  emit("renameStart", props.groupItem.group, props.groupItem.label)
}

function confirmRename() {
  const value = renameValue.value.trim()
  if (value) {
    emit("renameGroup", props.groupItem.group, value)
  }
  emit("renameCancel")
}

function cancelRename() {
  emit("renameCancel")
}

function toggleMoveMenu(feedId: string) {
  moveMenuFeedId.value = moveMenuFeedId.value === feedId ? "" : feedId
  newGroup.value = ""
}

function moveFeed(feedId: string, group: string) {
  emit("moveFeed", feedId, group)
  moveMenuFeedId.value = ""
}

function moveToNewGroup(feedId: string) {
  const g = newGroup.value.trim()
  if (!g) return
  emit("moveFeed", feedId, g)
  moveMenuFeedId.value = ""
  newGroup.value = ""
}
</script>

<style lang="scss">
@use "../../styles/FeedGroup.scss";
@use "../../styles/index.scss";
</style>
