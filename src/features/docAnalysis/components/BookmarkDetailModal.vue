<!-- 书签详情弹窗 - 展示全部书签列表，点击项跳转对应文档查询 -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="bookmark-detail-overlay"
      @click.self="$emit('close')"
    >
      <div
        class="bookmark-detail-panel"
        tabindex="-1"
        @keydown.esc="$emit('close')"
      >
        <div class="bookmark-detail-header">
          <span class="bookmark-detail-title">
            <Icon icon="mdi:bookmark-outline" />
            全部书签
          </span>
          <button
            class="close-btn"
            @click="$emit('close')"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="bookmark-detail-body">
          <div
            v-if="loading"
            class="bookmark-detail-loading"
          >
            <Icon icon="mdi:loading" class="spin-icon" /> 加载中...
          </div>
          <div
            v-else-if="details.length === 0"
            class="bookmark-detail-empty"
          >
            <Icon icon="mdi:bookmark-off-outline" class="empty-icon" />
            <p>暂无书签数据</p>
          </div>
          <div
            v-else
            class="bookmark-detail-list"
          >
            <button
              v-for="item in details"
              :key="item.value"
              class="bookmark-detail-item"
              @click="$emit('select', item.value)"
            >
              <div class="bd-item-left">
                <span
                  class="bd-item-name"
                  :title="item.value"
                >{{ item.value || '(空值)' }}</span>
              </div>
              <span class="bd-item-count">{{ item.count }} 篇</span>
              <Icon icon="mdi:chevron-right" class="bd-item-arrow" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import type { BookmarkDetail } from "../types/index"

interface Props {
  visible: boolean
  loading: boolean
  details: BookmarkDetail[]
}

defineProps<Props>()

defineEmits<{
  (e: "close"): void
  (e: "select", bookmark: string): void
}>()
</script>

<style lang="scss" scoped>
@use "../styles/BookmarkDetailModal.scss";
@use "../styles/index.scss";
</style>
