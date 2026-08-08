<!-- 反向链接下拉面板：触发按钮 + 搜索过滤 + 扁平反链文档列表，点击外部关闭 -->
<template>
  <div
    class="doc-nav-dropdown"
    ref="rootRef"
  >
    <!-- 下拉触发按钮：反向链接 (N) -->
    <button
      class="doc-nav-dropdown-trigger"
      :class="{ 'doc-nav-dropdown-trigger-open': isOpen }"
      type="button"
      :aria-expanded="isOpen"
      @click="togglePanel"
    >
      <IconWrapper
        name="docNavBacklink"
        size="14"
        aria-hidden="true"
      />
      <span class="doc-nav-dropdown-trigger-text">{{ i18n.docNavBacklinks }} ({{ backlinkCount }})</span>
      <IconWrapper
        name="chevronDown"
        class="doc-nav-dropdown-caret"
        size="12"
        aria-hidden="true"
      />
    </button>

    <!-- 下拉面板：搜索框 + 扁平反链文档列表 -->
    <Transition name="doc-nav-dropdown-fade">
      <div
        v-if="isOpen"
        class="doc-nav-dropdown-panel"
        role="listbox"
        :aria-label="i18n.docNavBacklinkPanelTitle"
      >
        <!-- 面板标题："反向链接" -->
        <div class="doc-nav-dropdown-header">{{ i18n.docNavBacklinkPanelTitle }}</div>
        <!-- 搜索输入框："搜索..." -->
        <div class="doc-nav-backlink-search">
          <IconWrapper
            name="docNavBacklinkSearch"
            size="12"
            class="doc-nav-backlink-search-icon"
            aria-hidden="true"
          />
          <input
            v-model="searchQuery"
            class="doc-nav-backlink-search-input"
            type="text"
            :placeholder="i18n.docNavBacklinkSearchPlaceholder"
            :aria-label="i18n.docNavBacklinkSearchPlaceholder"
          />
        </div>
        <!-- 反链文档列表 -->
        <template v-if="filteredBacklinks.length">
          <div
            v-for="item in filteredBacklinks"
            :key="item.id"
            class="doc-nav-backlink-item"
            role="option"
            :title="stripHtml(item.content)"
            @click="openDoc(item.id)"
          >
            <span class="doc-nav-backlink-item-text">
              <template
                v-for="(seg, index) in highlightSegments(stripHtml(item.content))"
                :key="index"
              >
                <mark
                  v-if="seg.match"
                  class="doc-nav-backlink-mark"
                >{{ seg.text }}</mark>
                <template v-else>{{ seg.text }}</template>
              </template>
            </span>
          </div>
        </template>
        <!-- 无匹配结果："无结果" -->
        <div
          v-else
          class="doc-nav-backlink-empty"
        >
          {{ i18n.docNavBacklinkNoResults }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type { BacklinkItem } from "../types"

const props = defineProps<{
  backlinks: BacklinkItem[]
  backlinkCount: number
  i18n: Record<string, string>
  openDoc: (docId: string) => void
  stripHtml: (html: string) => string
}>()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const searchQuery = ref("")
/** 防止同一点击事件中 togglePanel 打开面板后 handleDocumentClick 立即关闭 */
let justOpened = false

/** 高亮片段：text 为文本内容，match 标记是否命中搜索关键词 */
interface HighlightSegment {
  text: string
  match: boolean
}

/**
 * 将内容按搜索关键词切分为普通片段与匹配片段
 * 纯文本切割 + 模板条件渲染，不使用 v-html，无 XSS 风险
 */
function highlightSegments(content: string): HighlightSegment[] {
  const query = searchQuery.value.trim()
  if (!query) {
    return [{ text: content, match: false }]
  }
  const lowerContent = content.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const segments: HighlightSegment[] = []
  let from = 0
  let index = 0
  while ((index = lowerContent.indexOf(lowerQuery, from)) !== -1) {
    if (index > from) {
      segments.push({ text: content.slice(from, index), match: false })
    }
    segments.push({ text: content.slice(index, index + query.length), match: true })
    from = index + query.length
  }
  if (from < content.length) {
    segments.push({ text: content.slice(from), match: false })
  }
  return segments
}

/** 反链列表按关键词即时过滤（computed 响应式，无 debounce） */
const filteredBacklinks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return props.backlinks
  }
  return props.backlinks.filter((item) =>
    item.content.toLowerCase().includes(query),
  )
})

/** 打开面板时重置搜索框，避免残留上次查询；设置 justOpened 防止 document click 立即关闭 */
function togglePanel(): void {
  // eslint-disable-next-line no-console
  console.log("[docNav] BacklinkDropdown togglePanel, before isOpen:", isOpen.value)
  isOpen.value = !isOpen.value
  // eslint-disable-next-line no-console
  console.log("[docNav] BacklinkDropdown togglePanel, after isOpen:", isOpen.value)
  if (isOpen.value) {
    searchQuery.value = ""
    justOpened = true
    requestAnimationFrame(() => {
      justOpened = false
    })
  }
}

/** 点击下拉面板外部区域时关闭面板（justOpened 时跳过，防止打开即关闭） */
function handleDocumentClick(event: MouseEvent) {
  if (justOpened) {
    return
  }
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    // eslint-disable-next-line no-console
    console.log("[docNav] BacklinkDropdown handleDocumentClick closing panel")
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener("click", handleDocumentClick)
})
</script>

<style scoped lang="scss">
@use "../styles/BacklinkDropdown.scss";
@use "../styles/index.scss";
</style>
