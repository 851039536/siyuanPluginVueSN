<!-- 文档导航容器：面包屑 + 同级/下级/过滤下拉 + 反向链接下拉 + 元数据信息条 -->
<template>
  <div
    v-if="hasNavigation || hasBreadcrumbs || hasSiblings || hasBacklinks || hasMeta"
    class="doc-navigation-container"
    role="navigation"
    aria-label="文档导航"
    :data-doc-id="docId"
  >
    <div class="doc-navigation">
      <!-- 面包屑导航 -->
      <div
        v-if="hasBreadcrumbs"
        class="doc-nav-breadcrumb"
        role="list"
        aria-label="面包屑导航"
      >
        <template
          v-for="(item, index) in breadcrumbs"
          :key="item.id"
        >
          <a
            class="doc-nav-breadcrumb-link"
            :class="{ 'doc-nav-current': item.id === currentDocId }"
            role="listitem"
            :data-doc-id="item.id"
            :title="stripHtml(item.content)"
            :aria-current="item.id === currentDocId ? 'page' : undefined"
            @click="openDoc(item.id)"
          >
            {{ stripHtml(item.content) }}
          </a>
          <span
            v-if="index < breadcrumbs.length - 1"
            class="doc-nav-breadcrumb-separator"
            aria-hidden="true"
          >/</span>
        </template>
      </div>

      <!-- 同级文档下拉面板 -->
      <SiblingDropdown
        v-if="hasSiblings"
        :siblings="siblingDocs.siblings"
        :current-doc-id="currentDocId"
        :i18n="i18n"
        :open-doc="openDoc"
        :strip-html="stripHtml"
      />

      <!-- 上级文档链接：面包屑可见时已包含上级，避免重复显示 -->
      <div
        v-if="parentDoc && !hasBreadcrumbs"
        class="doc-nav-parent"
      >
        <IconWrapper
          name="docNavParent"
          class="doc-nav-icon"
          size="18"
          aria-hidden="true"
        />
        <a
          class="doc-nav-link"
          :data-doc-id="parentDoc.id"
          :title="stripHtml(parentDoc.content)"
          :aria-label="`上级文档: ${stripHtml(parentDoc.content)}`"
          @click="openDoc(parentDoc.id)"
        >
          {{ stripHtml(parentDoc.content) }}
        </a>
      </div>

      <!-- 下级文档下拉树形面板 -->
      <ChildDocDropdown
        v-if="childCount > 0"
        :child-docs="childDocs"
        :notebook="notebook"
        :current-doc-id="currentDocId"
        :i18n="i18n"
        :open-doc="openDoc"
        :strip-html="stripHtml"
        :trigger-text="i18n.docNavShowChildren"
        :panel-title="i18n.docNavPanelTitle"
      />

      <!-- 过滤下拉：仅显示标题命中过滤关键词的子文档，无匹配项时不显示 -->
      <ChildDocDropdown
        v-if="filteredChildCount > 0"
        :child-docs="filteredChildDocs"
        :notebook="notebook"
        :current-doc-id="currentDocId"
        :i18n="i18n"
        :open-doc="openDoc"
        :strip-html="stripHtml"
        :trigger-text="i18n.docNavFilter"
        :panel-title="i18n.docNavFilterPanelTitle"
        trigger-icon="docNavFilter"
      />

      <!-- 过滤关键词编辑按钮：铅笔图标，内联编辑面板 -->
      <FilterKeywordsEditor
        :filter-keywords="filterKeywords"
        :i18n="i18n"
        @saved="handleFilterKeywordsSaved"
      />

      <!-- 反向链接下拉面板：展示引用/提及当前文档的文档 -->
      <BacklinkDropdown
        v-if="hasBacklinks"
        :backlinks="backlinks"
        :i18n="i18n"
        :open-doc="openDoc"
        :strip-html="stripHtml"
      />

      <!-- 文档元数据信息条：创建/更新时间 + 块数 -->
      <DocMetaBar
        v-if="hasMeta"
        :doc-meta="docMeta"
        :i18n="i18n"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import {
  onMounted,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useDocNavigation } from "../composables/useDocNavigation"
import {
  DEFAULT_NAV_SETTINGS,
} from "../types"
import {
  DocNavSettingsStorage,
} from "../types/storage"
import BacklinkDropdown from "./BacklinkDropdown.vue"
import ChildDocDropdown from "./ChildDocDropdown.vue"
import DocMetaBar from "./DocMetaBar.vue"
import FilterKeywordsEditor from "./FilterKeywordsEditor.vue"
import SiblingDropdown from "./SiblingDropdown.vue"

const props = defineProps<{
  docId: string
  plugin: Plugin
}>()

/** 功能 i18n 文案（合并后平铺在 plugin.i18n 顶层，与 tableOfContents 等同级模块一致） */
const i18n = props.plugin.i18n as Record<string, string>

const {
  parentDoc,
  childDocs,
  breadcrumbs,
  siblingDocs,
  backlinks,
  hasBacklinks,
  docMeta,
  hasMeta,
  currentDocId,
  notebook,
  hasNavigation,
  hasBreadcrumbs,
  hasSiblings,
  childCount,
  filteredChildDocs,
  filteredChildCount,
  filterKeywords,
  loadHierarchy,
  openDoc,
  stripHtml,
  setFilterKeywords,
} = useDocNavigation()

/** 持久化存储实例，启动时创建，后续保存关键词时复用 */
let settingsStorage: DocNavSettingsStorage

/**
 * 保存过滤关键词：写入持久化存储 + 更新运行时过滤状态
 * 由 FilterKeywordsEditor 的 @saved 触发
 */
async function handleFilterKeywordsSaved(keywords: string[]): Promise<void> {
  setFilterKeywords(keywords)
  await settingsStorage.settings.set("filterKeywords", keywords)
}

/** 启动时加载设置并应用过滤关键词（默认 ["参考"]，向后兼容旧版硬编码行为） */
onMounted(async () => {
  settingsStorage = new DocNavSettingsStorage(props.plugin)
  const settings = await settingsStorage.settings.loadOrDefault()
  setFilterKeywords(settings.filterKeywords ?? DEFAULT_NAV_SETTINGS.filterKeywords)
})

watch(
  () => props.docId,
  (newDocId) => {
    if (newDocId) {
      loadHierarchy(newDocId)
    }
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;
</style>
