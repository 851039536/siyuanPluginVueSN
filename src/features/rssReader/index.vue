<!--
  RSS 订阅主面板 — Dock 侧栏，管理订阅源分组/文章列表/详情阅读/OPML 导入导出
-->
<template>
  <div class="rss-reader-panel">
    <!-- 文章详情视图 -->
    <ArticleDetail
      v-if="showItemDetail && selectedItem"
      :i18n="i18n"
      :item="selectedItem"
      :settings="settings"
      @close="closeItemDetail"
      @change-font-size="changeDetailFontSize"
      @toggle-star="handleToggleStar"
      @open-in-browser="openInBrowser(selectedItem)"
    />

    <!-- 添加订阅源对话框 -->
    <AddFeedDialog
      v-else-if="showAddFeedDialog"
      :i18n="i18n"
      :adding="addingFeed"
      @close="showAddFeedDialog = false"
      @submit="handleAddFeed"
    />

    <!-- 设置面板 -->
    <SettingsPanel
      v-else-if="showSettingsDialog"
      :i18n="i18n"
      :settings="settings"
      :import-opml="handleImportOpml"
      @close="showSettingsDialog = false"
      @setting-change="handleSettingChange"
      @export-opml="handleExportOpml"
    />

    <!-- 主视图 -->
    <template v-else>
      <!-- 顶部操作栏 -->
      <div class="rss-toolbar">
        <div class="rss-toolbar-title">
          <Icon
            icon="mdi:rss"
            class="rss-title-icon"
          />
          <!-- 面板标题："RSS订阅" -->
          {{ i18n.title }}
          <span
            v-if="unreadCount > 0"
            class="unread-badge"
          >{{ unreadCount }}</span>
        </div>
        <!-- 刷新全部按钮 -->
        <button
          class="rss-toolbar-btn"
          :title="i18n.refreshAll"
          @click="refreshAllFeeds"
        >
          <Icon
            :icon="loadingStatus === 'loading' ? 'mdi:loading' : 'mdi:refresh'"
            :class="{ 'loading-icon': loadingStatus === 'loading' }"
          />
        </button>
        <!-- 添加订阅源按钮 -->
        <button
          class="rss-toolbar-btn"
          :title="i18n.addFeed"
          @click="showAddFeedDialog = true"
        >
          <Icon icon="mdi:plus" />
        </button>
        <!-- 导出 OPML 按钮 -->
        <button
          class="rss-toolbar-btn"
          :title="i18n.exportOpml"
          @click="handleExportOpml"
        >
          <Icon icon="mdi:export-variant" />
        </button>
        <!-- 设置按钮 -->
        <button
          class="rss-toolbar-btn"
          :title="i18n.settings"
          @click="showSettingsDialog = true"
        >
          <Icon icon="mdi:cog" />
        </button>
      </div>

      <!-- 搜索栏 -->
      <div class="rss-search-bar">
        <!-- 搜索输入框："搜索文章..." -->
        <input
          v-model="searchKeyword"
          :placeholder="i18n.searchPlaceholder"
        >
      </div>

      <!-- 过滤标签 -->
      <div class="rss-filter-bar">
        <button
          class="filter-tag"
          :class="{ active: isOverviewMode }"
          @click="resetFilters"
        >
          <!-- 过滤标签："全部" -->
          {{ i18n.all }}
        </button>
        <button
          class="filter-tag"
          :class="{ active: showUnreadOnly }"
          @click="showUnreadOnly = !showUnreadOnly; showStarredOnly = false"
        >
          <!-- 过滤标签："未读" -->
          {{ i18n.unread }}
        </button>
        <button
          class="filter-tag"
          :class="{ active: showStarredOnly }"
          @click="showStarredOnly = !showStarredOnly; showUnreadOnly = false"
        >
          <!-- 过滤标签："收藏" -->
          {{ i18n.starred }}
        </button>
        <template
          v-for="group in groups"
          :key="group"
        >
          <button
            class="filter-tag"
            :class="{ active: currentGroupFilter === group }"
            @click="setGroupFilter(group)"
          >
            {{ group }}
          </button>
        </template>
      </div>

      <!-- 主内容区域 -->
      <div class="rss-content">
        <!-- 有订阅源时 -->
        <template v-if="feeds.length > 0">
          <!-- 订阅源概览模式 - 按分组分类 -->
          <FeedList
            v-if="isOverviewMode"
            :i18n="i18n"
            :grouped-feeds="groupedFeeds"
            :collapsed-groups="collapsedGroups"
            :feed-unread-counts="feedUnreadCounts"
            :refreshing-feed-ids="refreshingFeedIds"
            :groups="groups"
            :renaming-group-key="renamingGroupKey"
            :renaming-group-value="renamingGroupValue"
            @toggle-collapse="toggleGroupCollapse"
            @select-feed="setFeedFilter"
            @refresh-feed="refreshFeed"
            @delete-feed="removeFeed"
            @rename-group="renameGroup"
            @rename-start="startRenameGroup"
            @rename-cancel="cancelRenameGroup"
            @rename-value-change="renamingGroupValue = $event"
            @move-feed="handleMoveFeed"
          />

          <!-- 文章列表模式 -->
          <ArticleList
            v-else
            :i18n="i18n"
            :items="filteredItems"
            :filter-title="getFilterTitle()"
            :show-description="settings.showDescription"
            @reset-filters="resetFilters"
            @mark-all-read="markAllAsRead"
            @open-item="openItemDetail"
            @toggle-star="toggleStar($event.link)"
          />
        </template>

        <!-- 无订阅源时 -->
        <EmptyState
          v-else
          icon="mdi:rss"
          :title="i18n.noFeeds"
          :desc="i18n.noFeedsDesc"
          :action-text="i18n.addFeed"
          @action="showAddFeedDialog = true"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import { Icon } from "@iconify/vue"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import ArticleDetail from "./components/article/ArticleDetail.vue"
import ArticleList from "./components/article/ArticleList.vue"
import EmptyState from "./components/common/EmptyState.vue"
import AddFeedDialog from "./components/feed/AddFeedDialog.vue"
import FeedList from "./components/feed/FeedList.vue"
import SettingsPanel from "./components/settings/SettingsPanel.vue"
import { useRssReader } from "./composables/useRssReader"
import { triggerBlobDownload } from "@/utils/domUtils"

interface Props {
  i18n: Record<string, string>
  plugin: Plugin
}

const props = defineProps<Props>()

const {
  settings,
  feeds,
  loadingStatus,
  currentFeedFilter,
  currentGroupFilter,
  searchKeyword,
  showStarredOnly,
  showUnreadOnly,
  selectedItem,
  showItemDetail,
  showAddFeedDialog,
  showSettingsDialog,
  refreshingFeedIds,
  groups,
  groupedFeeds,
  filteredItems,
  unreadCount,
  feedUnreadCounts,
  collapsedGroups,
  init,
  addFeed,
  removeFeed,
  refreshFeed,
  refreshAllFeeds,
  markAllAsRead,
  toggleStar,
  openItemDetail,
  closeItemDetail,
  openInBrowser,
  updateSettings,
  setFeedFilter,
  setGroupFilter,
  toggleGroupCollapse,
  renameGroup,
  updateFeedGroup,
  exportOpml,
  importOpml,
  changeDetailFontSize,
} = useRssReader(props.plugin)

// ===== 添加订阅源 =====
const addingFeed = ref(false)

function handleToggleStar() {
  if (selectedItem.value) {
    toggleStar(selectedItem.value.link)
  }
}

function handleSettingChange(key: string, value: unknown) {
  updateSettings({ [key]: value })
}

async function handleAddFeed(url: string, group?: string) {
  addingFeed.value = true
  try {
    const success = await addFeed(url, group)
    if (success) {
      showAddFeedDialog.value = false
    }
  } finally {
    addingFeed.value = false
  }
}

// ===== 分组重命名 =====
const renamingGroupKey = ref("")
const renamingGroupValue = ref("")

function startRenameGroup(groupKey: string, currentLabel: string) {
  renamingGroupKey.value = groupKey
  renamingGroupValue.value = currentLabel === props.i18n.ungrouped ? "" : currentLabel
}

function cancelRenameGroup() {
  renamingGroupKey.value = ""
  renamingGroupValue.value = ""
}

// ===== 移动订阅源到分组 =====
async function handleMoveFeed(feedId: string, group: string) {
  await updateFeedGroup(feedId, group)
}

// ===== OPML 导入导出 =====
function handleExportOpml() {
  const xml = exportOpml()
  if (!xml) {
    showMessage(props.i18n.noFeedsToExport, 2000, "info")
    return
  }
  triggerBlobDownload(new Blob([xml], { type: "application/xml" }), `rss-subscriptions-${new Date().toISOString().slice(0, 10)}.opml`)
}

async function handleImportOpml(xml: string) {
  try {
    await importOpml(xml)
  } catch (err: unknown) {
    showMessage(`${props.i18n.opmlImportFailed}: ${err instanceof Error ? err.message : String(err)}`, 5000, "error")
  }
}

// ===== 过滤与工具函数 =====
const isOverviewMode = computed(
  () =>
    currentFeedFilter.value === "all"
    && currentGroupFilter.value === "all"
    && !searchKeyword.value
    && !showStarredOnly.value
    && !showUnreadOnly.value,
)

function resetFilters() {
  currentFeedFilter.value = "all"
  currentGroupFilter.value = "all"
  searchKeyword.value = ""
  showStarredOnly.value = false
  showUnreadOnly.value = false
}

function getFilterTitle(): string {
  if (showStarredOnly.value) return props.i18n.starred
  if (showUnreadOnly.value) return props.i18n.unread
  if (currentGroupFilter.value !== "all") return currentGroupFilter.value
  if (currentFeedFilter.value !== "all") {
    const feed = feeds.value.find((f) => f.id === currentFeedFilter.value)
    return feed?.title || ""
  }
  return ""
}

onMounted(() => {
  init()
})
</script>

<style lang="scss">
@use "./styles/index.scss";

.loading-icon {
  animation: spin 1s linear infinite;
}
</style>
