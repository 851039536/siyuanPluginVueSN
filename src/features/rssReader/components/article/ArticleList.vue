<!--
  RSS 文章列表 — 过滤后的文章条目，点击进入详情
-->
<template>
  <div>
    <!-- 返回按钮和标题 -->
    <div class="rss-toolbar">
      <!-- 返回/重置过滤按钮 -->
      <button
        class="rss-toolbar-btn"
        @click="emit('resetFilters')"
      >
        <Icon icon="mdi:arrow-left" />
      </button>
      <div class="rss-toolbar-title">
        {{ filterTitle }}
      </div>
      <!-- 全部标记已读按钮 -->
      <button
        class="rss-toolbar-btn"
        :title="i18n.markAllRead"
        @click="emit('markAllRead')"
      >
        <Icon icon="mdi:check-all" />
      </button>
    </div>

    <!-- 空状态 -->
    <div
      v-if="items.length === 0"
      class="rss-empty-state"
    >
      <Icon
        icon="mdi:file-document-outline"
        class="empty-icon"
      />
      <div class="empty-title">
        <!-- 空状态标题："暂无文章" -->
        {{ i18n.noItems }}
      </div>
      <div class="empty-desc">
        <!-- 空状态描述："尝试刷新订阅源或调整过滤条件" -->
        {{ i18n.noItemsDesc }}
      </div>
    </div>

    <!-- 文章条目列表 -->
    <div
      v-else
      class="rss-item-list"
    >
      <div
        v-for="item in items"
        :key="item.link"
        class="rss-item"
        :class="{ unread: !item.read }"
        @click="emit('openItem', item)"
      >
        <div class="item-header">
          <span class="item-feed-tag">{{ item.feedTitle }}</span>
          <span class="item-date">{{ formatDate(item.pubDate) }}</span>
        </div>
        <div class="item-title">
          {{ item.title }}
        </div>
        <div
          v-if="showDescription && item.description"
          class="item-desc"
        >
          {{ item.description }}
        </div>
        <div class="item-footer">
          <!-- 收藏切换按钮 -->
          <button
            class="item-star-btn"
            :class="{ starred: item.starred }"
            :title="i18n.starred"
            @click.stop="emit('toggleStar', item)"
          >
            <Icon :icon="item.starred ? 'mdi:star' : 'mdi:star-outline'" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import type { RssItem } from "../../types"

interface Props {
  i18n: Record<string, string>
  items: RssItem[]
  filterTitle: string
  showDescription: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  resetFilters: []
  markAllRead: []
  openItem: [item: RssItem]
  toggleStar: [item: RssItem]
}>()

function formatDate(dateStr?: string): string {
  if (!dateStr) return ""
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    if (diffMins < 1) return props.i18n.justNow
    if (diffMins < 60) return `${diffMins}${props.i18n.minutesAgo}`
    if (diffHours < 24) return `${diffHours}${props.i18n.hoursAgo}`
    if (diffDays < 7) return `${diffDays}${props.i18n.daysAgo}`
    return date.toLocaleDateString()
  } catch {
    return dateStr
  }
}
</script>

<style lang="scss">
@use "../../styles/ArticleList.scss";
@use "../../styles/index.scss";
</style>
