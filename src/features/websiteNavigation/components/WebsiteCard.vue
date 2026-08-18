<!--
  网站导航条目卡片 — 展示网站名称/URL/描述 + 操作按钮
-->
<template>
  <div class="entry-card">
    <div class="entry-main">
      <div class="entry-info">
        <div class="entry-name-row">
          <IconWrapper
            name="browser"
            :size="16"
            class="entry-icon"
          />
          <span class="entry-name">{{ entry.name }}</span>
          <span
            class="entry-category-tag"
            :style="{
              backgroundColor: `${category.color}20`,
              color: category.color,
            }"
          >
            <!-- 分类/未分类 -->
            {{ category.name }}
          </span>
        </div>
        <div
          class="entry-url"
          @click="emit('openUrl', entry.url)"
        >
          <IconWrapper
            name="openInNew"
            :size="12"
          />
          <span class="url-text">{{ entry.url }}</span>
        </div>
        <div
          v-if="entry.description"
          class="entry-desc"
        >
          {{ entry.description }}
        </div>
      </div>
      <div class="entry-actions">
        <!-- 复制网址 -->
        <Button
          icon="contentCopy"
          variant="ghost"
          size="xsmall"
          :title="i18n.copyUrl"
          @click="emit('copyUrl', entry.url)"
        />
        <!-- 编辑网站 -->
        <Button
          icon="edit"
          variant="ghost"
          size="xsmall"
          :title="i18n.editWebsite"
          @click="emit('edit', entry)"
        />
        <!-- 删除网站 -->
        <Button
          icon="delete"
          variant="ghost"
          size="xsmall"
          :title="i18n.deleteWebsite"
          @click="emit('delete', entry.id)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  I18n,
  WebsiteEntry,
} from "../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ID,
} from "../types/constants"
import { getCategoryById } from "../composables/useWebsiteNavigation"

const props = defineProps<{
  entry: WebsiteEntry
  i18n: I18n
}>()

const emit = defineEmits<{
  (e: "edit", entry: WebsiteEntry): void
  (e: "delete", id: string): void
  (e: "copyUrl", url: string): void
  (e: "openUrl", url: string): void
}>()

const category = computed(() =>
  getCategoryById(props.entry.category) ?? {
    id: DEFAULT_CATEGORY_ID,
    name: props.i18n.uncategorized ?? "",
    color: DEFAULT_CATEGORY_COLOR,
  },
)
</script>
