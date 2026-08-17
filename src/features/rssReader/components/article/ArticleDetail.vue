<!--
  RSS 文章详情视图 — 标题/元信息/正文阅读 + 字体缩放 + TTS 朗读
-->
<template>
  <div class="rss-item-detail">
    <!-- 详情头部：返回/字体缩放/朗读/收藏/浏览器打开 -->
    <div class="detail-header">
      <!-- 返回按钮 -->
      <button
        class="back-btn"
        :title="i18n.back"
        @click="emit('close')"
      >
        <Icon icon="mdi:arrow-left" />
      </button>
      <div class="detail-font-controls">
        <!-- 缩小字体按钮 -->
        <button
          class="font-btn"
          :title="i18n.zoomOut"
          @click="emit('changeFontSize', -2)"
        >
          A<sup>-</sup>
        </button>
        <span class="font-size-label">{{ settings.detailFontSize }}</span>
        <!-- 放大字体按钮 -->
        <button
          class="font-btn"
          :title="i18n.zoomIn"
          @click="emit('changeFontSize', 2)"
        >
          A<sup>+</sup>
        </button>
      </div>
      <span class="detail-actions">
        <!-- 朗读/停止朗读按钮 -->
        <button
          :title="ttsPlaying ? i18n.ttsStop : i18n.ttsStart"
          @click="speakArticle(item)"
        >
          <Icon :icon="ttsPlaying ? 'mdi:stop-circle-outline' : 'mdi:volume-high'" />
        </button>
        <!-- 收藏按钮 -->
        <button
          :title="i18n.starred"
          @click="emit('toggleStar')"
        >
          <Icon :icon="item.starred ? 'mdi:star' : 'mdi:star-outline'" />
        </button>
        <!-- 在浏览器中打开按钮 -->
        <button @click="emit('openInBrowser')">
          <Icon icon="mdi:open-in-new" />
          <span class="btn-label">{{ i18n.openInBrowser }}</span>
        </button>
      </span>
    </div>

    <div class="detail-content">
      <!-- 文章标题 -->
      <h2 class="detail-title">
        {{ item.title }}
      </h2>
      <div class="detail-meta">
        <span
          v-if="item.feedTitle"
          class="meta-chip"
        >{{ item.feedTitle }}</span>
        <span
          v-if="item.author"
          class="meta-chip"
        ><span class="meta-key">AUTHOR</span> {{ item.author }}</span>
        <span
          v-if="item.pubDate"
          class="meta-chip"
        >{{ formatDate(item.pubDate) }}</span>
      </div>
      <!-- 正文：v-html 渲染订阅源 HTML，字体大小随设置缩放 -->
      <div
        class="detail-body"
        :style="{ fontSize: `${settings.detailFontSize}px` }"
        v-html="processedDetailContent"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { useTtsReader } from "../../composables/useTtsReader"
import type {
  RssItem,
  RssSettings,
} from "../../types"

interface Props {
  i18n: Record<string, string>
  item: RssItem
  settings: RssSettings
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  changeFontSize: [delta: number]
  toggleStar: []
  openInBrowser: []
}>()

const { ttsPlaying, speakArticle } = useTtsReader()

// ===== 文章详情内容处理（给图片添加懒加载，避免一次性加载全部图片） =====
const processedDetailContent = computed(() => {
  const raw = props.item.content || props.item.description || ""
  if (!raw) return ""
  return raw.replace(/<img\s+/gi, '<img loading="lazy" ')
})

// ===== 日期格式化（相对时间） =====
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
@use "../../styles/ArticleDetail.scss";
@use "../../styles/index.scss";
</style>
