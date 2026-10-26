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
    <EmptyState
      v-if="items.length === 0"
      icon="mdi:file-document-outline"
      :title="i18n.noItems"
      :desc="i18n.noItemsDesc"
    />

    <!-- 文章条目列表 -->
    <div
      v-else
      class="rss-item-list"
    >
      <div
        v-for="(item, index) in items"
        :key="item.link || index"
        class="rss-item"
        :class="{ unread: !item.read }"
        @click="emit('openItem', item)"
      >
        <div class="item-header">
          <span class="item-feed-tag">{{ item.feedTitle }}</span>
          <span class="item-date">{{ formatRelativeDate(item.pubDate, i18n) }}</span>
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
import EmptyState from "../common/EmptyState.vue"
import { formatRelativeDate } from "../../utils/date"
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

</script>

<style lang="scss">
/* 仅引组件自身样式；全局基座（.rss-reader-panel / .loading-icon 等）由 index.vue 统一引入一次，
   子组件重复 @use 会使 Sass 独立编译单元重复输出同一份 CSS */
@use "../../styles/ArticleList.scss";
</style>
