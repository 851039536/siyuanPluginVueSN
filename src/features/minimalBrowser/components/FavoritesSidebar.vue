<!--
  极简浏览器 — 收藏侧栏：展开=分组书签列表（可拖拽缩放）；收起=缩略图栏（首字母图标，点击直达）
-->
<template>
  <div
    class="mb-favorites"
    :class="{ collapsed }"
    :style="{ width: collapsed ? '44px' : `${sidebarWidth}px` }"
  >
    <!-- 侧栏头部：标题 + 收起/展开切换按钮 -->
    <div class="mb-favorites-header">
      <template v-if="!collapsed">
        <IconWrapper
          name="star"
          :size="14"
        />
        <!-- 侧栏标题："收藏" -->
        <span class="mb-favorites-title">{{ i18n.favoritesTitle }}</span>
      </template>
      <Button
        :icon="collapsed ? 'chevronRight' : 'chevronLeft'"
        variant="ghost"
        size="xsmall"
        class="mb-collapse-btn"
        :title="collapsed ? i18n.expandSidebar : i18n.collapseSidebar"
        @click="collapsed = !collapsed"
      />
    </div>

    <!-- 收起态：缩略图栏（首字母彩色图标，点击直达网站） -->
    <div
      v-if="collapsed"
      class="mb-favorites-thumbs"
    >
      <div
        v-if="entries.length === 0"
        class="mb-favorites-empty"
      >
        <!-- 空状态："暂无收藏" -->
        {{ i18n.noFavorites }}
      </div>
      <button
        v-for="entry in entries"
        :key="entry.id"
        class="mb-thumb"
        :class="{ active: isCurrent(entry.url) }"
        :style="thumbStyle(entry)"
        :title="`${entry.name}\n${entry.url}`"
        @click="emit('navigate', entry.url)"
      >
        {{ thumbLetter(entry.name) }}
      </button>
    </div>

    <!-- 展开态：分组书签列表 -->
    <template v-else>
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
    </template>

    <!-- 拖拽缩放手柄：仅展开态显示，拖动调整侧栏宽度 -->
    <div
      v-if="!collapsed"
      class="mb-favorites-resizer"
      :title="i18n.resizeSidebar"
      @pointerdown="startResize"
      @pointermove="onResizeMove"
      @pointerup="endResize"
      @pointercancel="endResize"
    />
  </div>
</template>

<script setup lang="ts">
import type { WebsiteEntry } from "@/utils/sharedStorage/websiteStorage"
import {
  computed,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type { I18n } from "../types"
import {
  browserSettings,
  currentUrl,
  entries,
  getCategoryById,
  hostnameOf,
  normalizeUrl,
  saveSidebarWidth,
  sidebarResizing,
} from "../composables/useBrowserState"

defineProps<{
  i18n: I18n
}>()

const emit = defineEmits<{
  (e: "navigate", url: string): void
  (e: "editName", entry: WebsiteEntry): void
  (e: "deleteEntry", id: string): void
}>()

/** 侧栏收起/展开状态 */
const collapsed = ref(false)

/** 侧栏当前宽度（随设置加载，拖拽中实时更新） */
const sidebarWidth = ref(browserSettings.value.sidebarWidth)

/** 拖拽起始 X 与起始宽度（pointerdown 记录，pointermove 计算新宽度） */
const dragStartX = ref(0)
const dragStartWidth = ref(0)
const dragging = ref(false)

const startResize = (event: PointerEvent) => {
  event.preventDefault()
  dragging.value = true
  sidebarResizing.value = true
  dragStartX.value = event.clientX
  dragStartWidth.value = sidebarWidth.value
  // 捕获指针：移出侧栏后仍持续收到 move/up，且拖拽期间 iframe 被禁用不会吞掉事件
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

const onResizeMove = (event: PointerEvent) => {
  if (!dragging.value) return
  const next = dragStartWidth.value + (event.clientX - dragStartX.value)
  // 取整宽度：避免小数像素导致文字/边框子像素渲染模糊
  sidebarWidth.value = Math.min(480, Math.max(140, Math.round(next)))
}

const endResize = () => {
  if (!dragging.value) return
  dragging.value = false
  sidebarResizing.value = false
  void saveSidebarWidth(sidebarWidth.value)
}

/** 缩略图首字母（名称首字符大写，空名显示问号） */
const thumbLetter = (name: string): string =>
  (name.trim().charAt(0) || "?").toUpperCase()

/** 缩略图配色：按分类色生成 32px 圆形图标 */
const thumbStyle = (entry: WebsiteEntry): Record<string, string> => {
  const category = getCategoryById(entry.category)
  const color = category?.color ?? "#b0aea5"
  return {
    backgroundColor: `${color}26`,
    color,
    borderColor: `${color}59`,
  }
}

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
