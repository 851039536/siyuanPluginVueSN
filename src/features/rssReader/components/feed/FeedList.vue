<!--
  RSS 订阅源概览列表 — 分组展示订阅源
-->
<template>
  <div class="rss-feed-list">
    <FeedGroup
      v-for="groupItem in groupedFeeds"
      :key="groupItem.group"
      :i18n="i18n"
      :group-item="groupItem"
      :collapsed="collapsedGroups.has(groupItem.group)"
      :unread-count="groupItem.feeds.reduce((sum, f) => sum + (feedUnreadCounts[f.id] || 0), 0)"
      :unread-by-feed="feedUnreadCounts"
      :refreshing-feed-ids="refreshingFeedIds"
      :groups="groups"
      :renaming="renamingGroupKey === groupItem.group"
      :rename-value="renamingGroupValue"
      :move-menu-feed-id="moveMenuFeedId"
      :new-group-value="newGroupValue"
      @toggle-collapse="handleToggleCollapse"
      @select-feed="handleSelectFeed"
      @refresh-feed="handleRefreshFeed"
      @delete-feed="handleDeleteFeed"
      @rename-group="handleRenameGroup"
      @rename-start="handleRenameStart"
      @rename-cancel="handleRenameCancel"
      @rename-value-change="handleRenameValueChange"
      @move-feed="handleMoveFeed"
      @toggle-move-menu="handleToggleMoveMenu"
      @new-group-value-change="handleNewGroupValueChange"
    />
  </div>
</template>

<script setup lang="ts">
import FeedGroup from "./FeedGroup.vue"
import type { RssGroupItem } from "../../types"

interface Props {
  i18n: Record<string, string>
  groupedFeeds: RssGroupItem[]
  collapsedGroups: Set<string>
  feedUnreadCounts: Record<string, number>
  refreshingFeedIds: Set<string>
  groups: string[]
  renamingGroupKey: string
  renamingGroupValue: string
  moveMenuFeedId: string
  newGroupValue: string
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
  toggleMoveMenu: [feedId: string]
  newGroupValueChange: [value: string]
}>()

function handleToggleCollapse(group: string) { emit("toggleCollapse", group) }
function handleSelectFeed(feedId: string) { emit("selectFeed", feedId) }
function handleRefreshFeed(feedId: string) { emit("refreshFeed", feedId) }
function handleDeleteFeed(feedId: string) { emit("deleteFeed", feedId) }
function handleRenameGroup(oldName: string, newName: string) { emit("renameGroup", oldName, newName) }
function handleRenameStart(group: string, label: string) { emit("renameStart", group, label) }
function handleRenameCancel() { emit("renameCancel") }
function handleRenameValueChange(value: string) { emit("renameValueChange", value) }
function handleMoveFeed(feedId: string, group: string) { emit("moveFeed", feedId, group) }
function handleToggleMoveMenu(feedId: string) { emit("toggleMoveMenu", feedId) }
function handleNewGroupValueChange(value: string) { emit("newGroupValueChange", value) }
</script>

<style lang="scss">
@use "../../styles/FeedList.scss";
@use "../../styles/index.scss";
</style>
