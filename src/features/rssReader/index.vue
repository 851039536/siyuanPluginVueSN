<template>
  <div class="rss-reader-panel">
    <!-- 文章详情视图 -->
    <template v-if="showItemDetail && selectedItem">
      <div class="rss-item-detail">
        <div class="detail-header">
          <button
            class="back-btn"
            title="返回"
            @click="closeItemDetail"
          >
            <Icon icon="mdi:arrow-left" />
          </button>
          <div class="detail-font-controls">
            <button
              class="font-btn"
              title="缩小字体"
              @click="changeDetailFontSize(-2)"
            >
              A<sup>-</sup>
            </button>
            <span class="font-size-label">{{ settings.detailFontSize }}</span>
            <button
              class="font-btn"
              title="放大字体"
              @click="changeDetailFontSize(2)"
            >
              A<sup>+</sup>
            </button>
          </div>
          <span style="flex:1" />
          <div class="detail-actions">
            <button
              :title="ttsPlaying ? (i18n.ttsStop || '停止朗读') : (i18n.ttsStart || '朗读')"
              @click="speakArticle(selectedItem!)"
            >
              <Icon :icon="ttsPlaying ? 'mdi:stop-circle-outline' : 'mdi:volume-high'" />
            </button>
            <button @click="toggleStar(selectedItem!.link)">
              <Icon :icon="selectedItem!.starred ? 'mdi:star' : 'mdi:star-outline'" />
            </button>
            <button @click="openInBrowser(selectedItem!)">
              <Icon icon="mdi:open-in-new" />
              {{ i18n.openInBrowser || '打开' }}
            </button>
          </div>
        </div>
        <div class="detail-content">
          <h2 class="detail-title">{{ selectedItem!.title }}</h2>
          <div class="detail-meta">
            <span v-if="selectedItem!.feedTitle">{{ selectedItem!.feedTitle }}</span>
            <span v-if="selectedItem!.author">{{ i18n.author || '作者' }}: {{ selectedItem!.author }}</span>
            <span v-if="selectedItem!.pubDate">{{ formatDate(selectedItem!.pubDate) }}</span>
          </div>
          <div
            class="detail-body"
            :style="{ fontSize: settings.detailFontSize + 'px' }"
            v-html="processedDetailContent"
          />
        </div>
      </div>
    </template>

    <!-- 添加订阅源对话框 -->
    <template v-else-if="showAddFeedDialog">
      <div class="rss-add-dialog">
        <div class="dialog-header">
          <span class="dialog-title">{{ i18n.addFeed || '添加订阅源' }}</span>
          <button
            class="close-btn"
            @click="showAddFeedDialog = false"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>{{ i18n.feedUrl || '订阅地址' }}</label>
            <input
              v-model="newFeedUrl"
              :placeholder="i18n.feedUrlPlaceholder || '输入RSS/Atom订阅地址...'"
              @keydown.enter="handleAddFeed"
            >
            <div class="hint">{{ i18n.feedUrlHint || '支持RSS 2.0和Atom格式，例如 https://example.com/feed 或 https://example.com/rss' }}</div>
          </div>
          <div class="form-group">
            <label>{{ i18n.feedGroup || '分组' }}</label>
            <input
              v-model="newFeedGroup"
              :placeholder="i18n.feedGroupPlaceholder || '输入分组名称（可选）'"
            >
          </div>
        </div>
        <div class="dialog-footer">
          <button @click="showAddFeedDialog = false">
            {{ i18n.cancel || '取消' }}
          </button>
          <button
            class="primary"
            :disabled="!newFeedUrl.trim() || addingFeed"
            @click="handleAddFeed"
          >
            {{ addingFeed ? (i18n.adding || '添加中...') : (i18n.add || '添加') }}
          </button>
        </div>
      </div>
    </template>

    <!-- 设置面板 -->
    <template v-else-if="showSettingsDialog">
      <div class="rss-settings-panel">
        <div class="settings-header">
          <span class="settings-title">{{ i18n.settings || '设置' }}</span>
          <button
            class="close-btn"
            @click="showSettingsDialog = false"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="settings-body">
          <div class="setting-item">
            <div class="setting-label">{{ i18n.refreshInterval || '自动刷新间隔' }}</div>
            <div class="setting-desc">{{ i18n.refreshIntervalDesc || '0表示不自动刷新' }}</div>
            <select
              :value="settings.refreshInterval"
              @change="handleSettingChange('refreshInterval', Number(($event.target as HTMLSelectElement).value))"
            >
              <option :value="0">{{ i18n.disabled || '禁用' }}</option>
              <option :value="15">15 {{ i18n.minutes || '分钟' }}</option>
              <option :value="30">30 {{ i18n.minutes || '分钟' }}</option>
              <option :value="60">1 {{ i18n.hour || '小时' }}</option>
              <option :value="120">2 {{ i18n.hours || '小时' }}</option>
              <option :value="360">6 {{ i18n.hours || '小时' }}</option>
            </select>
          </div>
          <div class="setting-item">
            <div class="setting-label">{{ i18n.maxItems || '每源最大文章数' }}</div>
            <div class="setting-desc">{{ i18n.maxItemsDesc || '超过此数量将自动删除最旧的非收藏文章' }}</div>
            <input
              type="number"
              :value="settings.maxItemsPerFeed"
              min="10"
              max="500"
              @change="handleSettingChange('maxItemsPerFeed', Number(($event.target as HTMLInputElement).value))"
            >
          </div>
          <div class="setting-item">
            <div class="setting-label">{{ i18n.sortOrder || '排序方式' }}</div>
            <select
              :value="settings.sortOrder"
              @change="handleSettingChange('sortOrder', ($event.target as HTMLSelectElement).value)"
            >
              <option value="newest">{{ i18n.newestFirst || '最新优先' }}</option>
              <option value="oldest">{{ i18n.oldestFirst || '最早优先' }}</option>
            </select>
          </div>
          <div class="opml-section">
            <div class="setting-label">{{ i18n.opmlExport || 'OPML 导出' }}</div>
            <div class="setting-desc">{{ i18n.opmlExportDesc || '将当前订阅源列表导出为 OPML 文件，用于备份或迁移' }}</div>
            <button
              class="opml-btn"
              @click="handleExportOpml"
            >
              <Icon icon="mdi:export-variant" />
              {{ i18n.exportOpml || '导出订阅源列表' }}
            </button>
          </div>
          <div class="opml-section">
            <div class="setting-label">{{ i18n.opmlImport || 'OPML 导入' }}</div>
            <div class="setting-desc">{{ i18n.opmlImportDesc || '从 OPML 文件导入订阅源（会逐个添加）' }}</div>
            <div class="opml-import-row">
              <input
                ref="opmlFileInput"
                type="file"
                accept=".opml,.xml"
                :disabled="importingOpml"
                @change="handleOpmlFile"
              >
              <span
                v-if="importingOpml"
                class="opml-importing"
              >
                <Icon icon="mdi:loading" class="loading-icon" />
                {{ i18n.importing || '导入中...' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 主视图 -->
    <template v-else>
      <!-- 顶部操作栏 -->
      <div class="rss-toolbar">
        <div class="rss-toolbar-title">
          <Icon
            icon="mdi:rss"
            style="color: #f97316"
          />
          {{ i18n.title || 'RSS订阅' }}
          <span
            v-if="unreadCount > 0"
            class="unread-badge"
          >{{ unreadCount }}</span>
        </div>
        <button
          class="rss-toolbar-btn"
          :title="i18n.refreshAll || '刷新全部'"
          @click="refreshAllFeeds"
        >
          <Icon
            :icon="loadingStatus === 'loading' ? 'mdi:loading' : 'mdi:refresh'"
            :class="{ 'loading-icon': loadingStatus === 'loading' }"
          />
        </button>
        <button
          class="rss-toolbar-btn"
          :title="i18n.addFeed || '添加订阅'"
          @click="showAddFeedDialog = true"
        >
          <Icon icon="mdi:plus" />
        </button>
        <button
          class="rss-toolbar-btn"
          :title="i18n.exportOpml || '导出OPML'"
          @click="handleExportOpml"
        >
          <Icon icon="mdi:export-variant" />
        </button>
        <button
          class="rss-toolbar-btn"
          :title="i18n.settings || '设置'"
          @click="showSettingsDialog = true"
        >
          <Icon icon="mdi:cog" />
        </button>
      </div>

      <!-- 搜索栏 -->
      <div class="rss-search-bar">
        <input
          v-model="searchKeyword"
          :placeholder="i18n.searchPlaceholder || '搜索文章...'"
        >
      </div>

      <!-- 过滤标签 -->
      <div class="rss-filter-bar">
        <button
          class="filter-tag"
          :class="{ active: currentFeedFilter === 'all' && currentGroupFilter === 'all' && !showStarredOnly && !showUnreadOnly }"
          @click="resetFilters"
        >
          {{ i18n.all || '全部' }}
        </button>
        <button
          class="filter-tag"
          :class="{ active: showUnreadOnly }"
          @click="showUnreadOnly = !showUnreadOnly; showStarredOnly = false"
        >
          {{ i18n.unread || '未读' }}
        </button>
        <button
          class="filter-tag"
          :class="{ active: showStarredOnly }"
          @click="showStarredOnly = !showStarredOnly; showUnreadOnly = false"
        >
          {{ i18n.starred || '收藏' }}
        </button>
        <template v-for="group in groups" :key="group">
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
          <!-- 显示订阅源列表或文章列表 -->
          <template v-if="currentFeedFilter === 'all' && currentGroupFilter === 'all' && !searchKeyword && !showStarredOnly && !showUnreadOnly">
            <!-- 订阅源概览模式 - 按分组分类 -->
            <div class="rss-feed-list">
              <div
                v-for="groupItem in groupedFeeds"
                :key="groupItem.group"
                class="feed-group"
              >
                <div
                  class="feed-group-header"
                  @click="toggleGroupCollapse(groupItem.group)"
                >
                  <Icon
                    :icon="collapsedGroups.has(groupItem.group) ? 'mdi:chevron-right' : 'mdi:chevron-down'"
                    class="group-collapse-icon"
                  />
                  <template v-if="renamingGroupKey === groupItem.group">
                    <input
                      v-model="renamingGroupValue"
                      class="group-rename-input"
                      @click.stop
                      @keydown.enter="confirmRenameGroup(groupItem.group)"
                      @keydown.escape="cancelRenameGroup"
                      @blur="confirmRenameGroup(groupItem.group)"
                    >
                  </template>
                  <template v-else>
                    <span class="group-label">{{ groupItem.label }}</span>
                  </template>
                  <span class="group-count">{{ groupItem.feeds.length }}</span>
                  <span class="group-unread">{{ groupItem.feeds.reduce((sum, f) => sum + (feedUnreadCounts[f.id] || 0), 0) || '' }}</span>
                  <button
                    v-if="groupItem.group"
                    class="group-action-btn"
                    title="重命名分组"
                    @click.stop="startRenameGroup(groupItem.group, groupItem.label)"
                  >
                    <Icon icon="mdi:pencil-outline" />
                  </button>
                </div>
                <template v-if="!collapsedGroups.has(groupItem.group)">
                  <div
                    v-for="feed in groupItem.feeds"
                    :key="feed.id"
                    class="feed-item"
                    @click="setFeedFilter(feed.id)"
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
                      <div class="feed-title">{{ feed.title }}</div>
                      <div class="feed-url">{{ feed.url }}</div>
                    </div>
                    <span
                      v-if="feedUnreadCounts[feed.id]"
                      class="feed-unread"
                    >{{ feedUnreadCounts[feed.id] }}</span>
                    <div class="feed-actions">
                      <button
                        :title="i18n.refresh || '刷新'"
                        @click.stop="refreshFeed(feed.id)"
                      >
                        <Icon
                          :icon="refreshingFeedIds.has(feed.id) ? 'mdi:loading' : 'mdi:refresh'"
                          :class="{ 'loading-icon': refreshingFeedIds.has(feed.id) }"
                        />
                      </button>
                      <button
                        title="移动到分组"
                        @click.stop="toggleMoveMenu(feed.id)"
                      >
                        <Icon icon="mdi:folder-outline" />
                      </button>
                      <button
                        :title="i18n.delete || '删除'"
                        @click.stop="removeFeed(feed.id)"
                      >
                        <Icon icon="mdi:delete-outline" />
                      </button>
                    </div>
                    <!-- 移动分组下拉 -->
                    <div
                      v-if="moveMenuFeedId === feed.id"
                      class="move-group-menu"
                      @click.stop
                    >
                      <div
                        class="move-option"
                        :class="{ active: !feed.group }"
                        @click="handleMoveFeed(feed.id, '')"
                      >
                        未分组
                      </div>
                      <div
                        v-for="g in groups"
                        :key="g"
                        class="move-option"
                        :class="{ active: feed.group === g }"
                        @click="handleMoveFeed(feed.id, g)"
                      >
                        {{ g }}
                      </div>
                      <div class="move-option new-group-option">
                        <input
                          v-model="newGroupOnMove"
                          placeholder="新建分组..."
                          @keydown.enter="handleMoveToNewGroup(feed.id)"
                        >
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </template>

          <!-- 文章列表模式 -->
          <template v-else>
            <!-- 返回按钮和标题 -->
            <div class="rss-toolbar">
              <button
                class="rss-toolbar-btn"
                @click="resetFilters"
              >
                <Icon icon="mdi:arrow-left" />
              </button>
              <div class="rss-toolbar-title">
                {{ getFilterTitle() }}
              </div>
              <button
                class="rss-toolbar-btn"
                :title="i18n.markAllRead || '全部已读'"
                @click="markAllAsRead"
              >
                <Icon icon="mdi:check-all" />
              </button>
            </div>

            <div
              v-if="filteredItems.length === 0"
              class="rss-empty-state"
            >
              <Icon
                icon="mdi:file-document-outline"
                class="empty-icon"
              />
              <div class="empty-title">
                {{ i18n.noItems || '暂无文章' }}
              </div>
              <div class="empty-desc">
                {{ i18n.noItemsDesc || '尝试刷新订阅源或调整过滤条件' }}
              </div>
            </div>

            <div
              v-else
              class="rss-item-list"
            >
              <div
                v-for="item in filteredItems"
                :key="item.link"
                class="rss-item"
                :class="{ unread: !item.read }"
                @click="openItemDetail(item)"
              >
                <div class="item-header">
                  <span class="item-feed-tag">{{ item.feedTitle }}</span>
                  <span class="item-date">{{ formatDate(item.pubDate) }}</span>
                </div>
                <div class="item-title">
                  {{ item.title }}
                </div>
                <div
                  v-if="settings.showDescription && item.description"
                  class="item-desc"
                >
                  {{ item.description }}
                </div>
                <div class="item-footer">
                  <button
                    class="item-star-btn"
                    :class="{ starred: item.starred }"
                    @click.stop="toggleStar(item.link)"
                  >
                    <Icon :icon="item.starred ? 'mdi:star' : 'mdi:star-outline'" />
                  </button>
                </div>
              </div>
            </div>
          </template>
        </template>

        <!-- 无订阅源时 -->
        <div
          v-else
          class="rss-empty-state"
        >
          <Icon
            icon="mdi:rss"
            class="empty-icon"
          />
          <div class="empty-title">
            {{ i18n.noFeeds || '暂无订阅源' }}
          </div>
          <div class="empty-desc">
            {{ i18n.noFeedsDesc || '点击右上角 + 按钮添加RSS订阅源' }}
          </div>
          <button
            class="empty-action"
            @click="showAddFeedDialog = true"
          >
            {{ i18n.addFeed || '添加订阅源' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { computed, onMounted, onBeforeUnmount, ref } from "vue"
import { useRssReader } from "./composables/useRssReader"

interface Props {
  i18n: any
  plugin: any
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
const newFeedUrl = ref("")
const newFeedGroup = ref("")
const addingFeed = ref(false)

// ===== 分组重命名 =====
const renamingGroupKey = ref("")
const renamingGroupValue = ref("")

function startRenameGroup(groupKey: string, currentLabel: string) {
  renamingGroupKey.value = groupKey
  renamingGroupValue.value = currentLabel === "未分组" ? "" : currentLabel
}

function confirmRenameGroup(oldKey: string) {
  if (renamingGroupKey.value && renamingGroupValue.value.trim()) {
    renameGroup(oldKey, renamingGroupValue.value.trim())
  }
  renamingGroupKey.value = ""
  renamingGroupValue.value = ""
}

function cancelRenameGroup() {
  renamingGroupKey.value = ""
  renamingGroupValue.value = ""
}

// ===== 移动订阅源到分组 =====
const moveMenuFeedId = ref("")
const newGroupOnMove = ref("")

function toggleMoveMenu(feedId: string) {
  moveMenuFeedId.value = moveMenuFeedId.value === feedId ? "" : feedId
  newGroupOnMove.value = ""
}

async function handleMoveFeed(feedId: string, group: string) {
  await updateFeedGroup(feedId, group)
  moveMenuFeedId.value = ""
}

async function handleMoveToNewGroup(feedId: string) {
  const g = newGroupOnMove.value.trim()
  if (!g) return
  await updateFeedGroup(feedId, g)
  moveMenuFeedId.value = ""
  newGroupOnMove.value = ""
}

async function handleAddFeed() {
  if (!newFeedUrl.value.trim()) return
  addingFeed.value = true
  const timeoutId = setTimeout(() => { addingFeed.value = false }, 45000)
  try {
    const success = await addFeed(newFeedUrl.value, newFeedGroup.value || undefined)
    clearTimeout(timeoutId)
    addingFeed.value = false
    if (success) {
      newFeedUrl.value = ""
      newFeedGroup.value = ""
      showAddFeedDialog.value = false
    }
  } catch (err) {
    clearTimeout(timeoutId)
    addingFeed.value = false
    console.error("[RSS] handleAddFeed error:", err)
  }
}

// ===== 设置 =====
function handleSettingChange(key: string, value: any) {
  updateSettings({ [key]: value })
}

// ===== OPML 导入导出 =====
const opmlFileInput = ref<HTMLInputElement | null>(null)
const importingOpml = ref(false)

function handleExportOpml() {
  const xml = exportOpml()
  if (!xml) {
    showMessage("暂无订阅源可导出", 2000, "info")
    return
  }
  const blob = new Blob([xml], { type: "application/xml" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `rss-subscriptions-${new Date().toISOString().slice(0, 10)}.opml`
  a.click()
  URL.revokeObjectURL(url)
}

async function handleOpmlFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  importingOpml.value = true
  try {
    const text = await file.text()
    await importOpml(text)
  } catch (err: any) {
    showMessage(`OPML 导入失败: ${err.message}`, 5000, "error")
  } finally {
    importingOpml.value = false
    if (opmlFileInput.value) opmlFileInput.value.value = ""
  }
}

// ===== TTS 朗读 =====
const ttsUtterance = ref<SpeechSynthesisUtterance | null>(null)
const ttsPlaying = ref(false)

function speakArticle(item: { title?: string; content?: string; description?: string }) {
  if (ttsPlaying.value) {
    window.speechSynthesis.cancel()
    ttsPlaying.value = false
    ttsUtterance.value = null
    return
  }
  const text = [item.title, item.content || item.description].filter(Boolean).join(". ")
  if (!text) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = "zh-CN"
  utterance.rate = 1.0
  utterance.onend = () => { ttsPlaying.value = false; ttsUtterance.value = null }
  utterance.onerror = () => { ttsPlaying.value = false; ttsUtterance.value = null }
  ttsUtterance.value = utterance
  ttsPlaying.value = true
  window.speechSynthesis.speak(utterance)
}

// ===== 文章详情内容处理（添加图片懒加载 + 为代码块添加复制按钮） =====
const processedDetailContent = computed(() => {
  const raw = selectedItem.value?.content || selectedItem.value?.description || ""
  if (!raw) return ""
  // 给所有 img 标签添加 loading="lazy"
  return raw.replace(/<img\s+/gi, '<img loading="lazy" ')
})

// ===== 过滤与工具函数 =====
function resetFilters() {
  currentFeedFilter.value = "all"
  currentGroupFilter.value = "all"
  searchKeyword.value = ""
  showStarredOnly.value = false
  showUnreadOnly.value = false
}

function getFilterTitle(): string {
  if (showStarredOnly.value) return props.i18n.starred || "收藏"
  if (showUnreadOnly.value) return props.i18n.unread || "未读"
  if (currentGroupFilter.value !== "all") return currentGroupFilter.value
  if (currentFeedFilter.value !== "all") {
    const feed = feeds.value.find(f => f.id === currentFeedFilter.value)
    return feed?.title || ""
  }
  return ""
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ""
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return props.i18n.justNow || "刚刚"
    if (diffMins < 60) return `${diffMins}${props.i18n.minutesAgo || "分钟前"}`
    if (diffHours < 24) return `${diffHours}${props.i18n.hoursAgo || "小时前"}`
    if (diffDays < 7) return `${diffDays}${props.i18n.daysAgo || "天前"}`
    return date.toLocaleDateString()
  } catch {
    return dateStr
  }
}

onMounted(() => {
  init()
  document.addEventListener("click", handleGlobalClick)
})

onBeforeUnmount(() => {
  document.removeEventListener("click", handleGlobalClick)
})

function handleGlobalClick() {
  if (moveMenuFeedId.value) {
    moveMenuFeedId.value = ""
    newGroupOnMove.value = ""
  }
}
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";

.loading-icon {
  animation: spin 1s linear infinite;
}
</style>
