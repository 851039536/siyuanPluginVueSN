<!-- 反向链接下拉面板：DropdownShell 外壳 + 搜索过滤 + 扁平反链文档列表 -->
<template>
  <DropdownShell
    trigger-icon="docNavBacklink"
    :trigger-text="i18n.docNavBacklinks"
    :count="backlinks.length"
    panel-role="listbox"
    :panel-aria-label="i18n.docNavBacklinkPanelTitle"
    :panel-title="i18n.docNavBacklinkPanelTitle"
    @toggle="handlePanelToggle"
  >
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
  </DropdownShell>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type { BacklinkItem } from "../types"
import DropdownShell from "./DropdownShell.vue"

const props = defineProps<{
  backlinks: BacklinkItem[]
  i18n: Record<string, string>
  openDoc: (docId: string) => void
  stripHtml: (html: string) => string
}>()

const searchQuery = ref("")

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

/** 反链列表按关键词即时过滤（computed 响应式，无 debounce）：同时匹配文档标题与完整路径 */
const filteredBacklinks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return props.backlinks
  }
  return props.backlinks.filter((item) =>
    item.content.toLowerCase().includes(query)
    || item.hpath.toLowerCase().includes(query),
  )
})

/** 面板打开时重置搜索框，避免残留上次查询 */
function handlePanelToggle(open: boolean): void {
  if (open) {
    searchQuery.value = ""
  }
}
</script>

<style scoped lang="scss">
@use "../styles/BacklinkDropdown.scss";
@use "../styles/index.scss";
</style>
