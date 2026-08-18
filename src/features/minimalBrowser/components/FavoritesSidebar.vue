<!--
  极简浏览器 — 收藏侧栏：按分类分组展示共享书签，点击导航/改名/删除
-->
<template>
  <div class="mb-favorites">
    <div class="mb-favorites-header">
      <IconWrapper
        name="star"
        :size="14"
      />
      <!-- 侧栏标题："收藏" -->
      <span class="mb-favorites-title">{{ i18n.favoritesTitle }}</span>
    </div>

    <div
      v-if="entries.length === 0"
      class="mb-favorites-empty"
    >
      <!-- 空状态："暂无收藏" -->
      {{ i18n.noFavorites }}
    </div>

    <div
      v-else
      class="mb-favorites-list"
    >
      <template
        v-for="group in groupedEntries"
        :key="group.categoryId"
      >
        <div class="mb-favorites-group">
          <span class="mb-favorites-group-name">
            <!-- 分类名 -->
            {{ group.categoryName }}
          </span>
          <div
            v-for="entry in group.items"
            :key="entry.id"
            class="mb-favorite-item"
            :class="{ active: isCurrent(entry.url) }"
          >
            <button
              class="mb-favorite-main"
              :title="entry.url"
              @click="emit('navigate', entry.url)"
            >
              <span class="mb-favorite-name">{{ entry.name }}</span>
              <span class="mb-favorite-host">{{ hostnameOf(entry.url) }}</span>
            </button>
            <Button
              icon="edit"
              variant="ghost"
              size="xsmall"
              :title="i18n.editName"
              @click="emit('editName', entry)"
            />
            <Button
              icon="delete"
              variant="ghost"
              size="xsmall"
              :title="i18n.delete"
              @click="emit('deleteEntry', entry.id)"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WebsiteEntry } from "@/utils/sharedStorage/websiteStorage"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type { I18n } from "../types"
import {
  currentUrl,
  entries,
  getCategoryById,
  hostnameOf,
  normalizeUrl,
} from "../composables/useBrowserState"

defineProps<{
  i18n: I18n
}>()

const emit = defineEmits<{
  (e: "navigate", url: string): void
  (e: "editName", entry: WebsiteEntry): void
  (e: "deleteEntry", id: string): void
}>()

/** 当前条目是否高亮 */
const isCurrent = (url: string) => normalizeUrl(url) === normalizeUrl(currentUrl.value)

/** 按分类分组的收藏列表 */
const groupedEntries = computed(() => {
  const groups = new Map<string, { categoryId: string, categoryName: string, items: WebsiteEntry[] }>()
  for (const entry of entries.value) {
    const category = getCategoryById(entry.category)
    const categoryId = category?.id ?? entry.category
    // 分类不存在时以分类 ID 兜底展示
    const categoryName = category?.name ?? categoryId
    let group = groups.get(categoryId)
    if (!group) {
      group = { categoryId, categoryName, items: [] }
      groups.set(categoryId, group)
    }
    group.items.push(entry)
  }
  return [...groups.values()]
})
</script>

<style lang="scss">
@use '../styles/FavoritesSidebar.scss';
</style>
