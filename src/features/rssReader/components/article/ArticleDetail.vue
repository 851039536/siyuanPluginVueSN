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
        ><span class="meta-key">{{ i18n.author }}</span> {{ item.author }}</span>
        <span
          v-if="item.pubDate"
          class="meta-chip"
        >{{ formatRelativeDate(item.pubDate, i18n) }}</span>
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
import {
  computed,
  onBeforeUnmount,
  onMounted,
} from "vue"
import { useTtsReader } from "../../composables/useTtsReader"
import { formatRelativeDate } from "../../utils/date"
import { sanitizeHtml } from "@/utils/mdRenderer"
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

// ===== 文章详情内容处理 =====
// RSS 正文是第三方不受信内容，v-html 渲染前必须经 DOMPurify 消毒（项目 v-html 规范）
const processedDetailContent = computed(() => {
  const raw = props.item.content || props.item.description || ""
  if (!raw) return ""
  return sanitizeHtml(raw.replace(/<img\s+/gi, '<img loading="lazy" '))
})

// ===== Esc 关闭详情 =====
function onDocKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close")
}
onMounted(() => document.addEventListener("keydown", onDocKeydown))
onBeforeUnmount(() => document.removeEventListener("keydown", onDocKeydown))

</script>

<style lang="scss">
/* 仅引组件自身样式；全局基座由 index.vue 统一引入一次（避免重复输出） */
@use "../../styles/ArticleDetail.scss";
</style>
