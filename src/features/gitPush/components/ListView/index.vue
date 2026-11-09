<!-- 列表视图入口容器：工具栏 + 分组循环卡片（纯渲染，领域状态由 gitPush 根组件经 CARD_SERVICES_KEY 注入） -->
<template>
  <!-- 筛选工具栏 + 分类 TAB -->
  <ListViewToolbar
    v-model:view-mode="viewMode"
    v-model:active-category="activeCategory"
    v-model:show-archived="showArchived"
    v-model:git-ops-paused="gitOpsPaused"
    v-model:card-layout="cardLayout"
    :i18n="i18n"
    :grouped-projects="groupedProjects"
    :all-tags="allTags"
    :selected-tags="selectedTags"
    @toggle-tag="emit('toggleTag', $event)"
    @clear-tag-filter="emit('clearTagFilter')"
  />

  <!-- 全局搜索提示条：说明搜索已忽略当前视图/分类，并给出命中数与清除入口 -->
  <div
    v-if="searchActive"
    class="gp-search-scope"
  >
    <Icon
      icon="mdi:magnify"
      height="12"
    />
    <span class="gp-search-scope-text">
      <span class="gp-search-scope-strong">{{ i18n.searchScopeGlobal }}</span>
      <!-- 命中数："命中 {0} 个项目" -->
      · {{ i18n.searchResultCount.replace("{0}", String(searchResultCount)) }}
      · {{ i18n.searchScopeIgnored }}
    </span>
    <!-- 标签叠加提示："已按 {0} 个标签筛选" -->
    <span
      v-if="selectedTags.length > 0"
      class="gp-search-scope-tag"
    >{{ i18n.searchTagFiltered.replace("{0}", String(selectedTags.length)) }}</span>
    <!-- 一键清空搜索词 -->
    <Button
      variant="ghost"
      size="xsmall"
      dense
      @click="emit('clearSearch')"
    >
      {{ i18n.clearSearch }}
    </Button>
  </div>

  <!-- 空态提示：搜索零命中 / 未选择分类 / 智能视图为空。文案由 index.vue 计算，本组件保持纯渲染 -->
  <EmptyState
    v-if="emptyHint"
    :icon="searchActive ? 'mdi:file-search-outline' : 'mdi:folder-multiple-outline'"
    :text="emptyHint"
  >
    <!-- 搜索零命中时提供一键清除（其余空态不需要操作） -->
    <template
      v-if="searchActive"
      #action
    >
      <Button
        class="gp-empty-action"
        variant="ghost"
        size="xsmall"
        @click="emit('clearSearch')"
      >
        {{ i18n.clearSearch }}
      </Button>
    </template>
  </EmptyState>

  <!-- 分组循环卡片列表；搜索态跨分类命中，故补分类分组头 -->
  <div
    v-else
    class="gp-list"
    :class="{ 'gp-list--accordion': cardLayout === 'accordion' }"
  >
    <template
      v-for="group in filteredGroups"
      :key="group.category.id"
    >
      <div
        v-if="searchActive"
        class="gp-group-header"
      >
        <span
          class="gp-group-dot"
          :style="{ background: group.category.color }"
        />
        <span class="gp-group-name">{{ group.category.name }}</span>
        <span class="gp-group-count">{{ group.projects.length }}</span>
      </div>
      <ProjectCard
        v-for="project in group.projects"
        :key="project.id"
        :project="project"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// 列表视图容器（纯渲染，卡片数据与操作全部经 useCardServices 注入，无领域状态）
import type { CardLayout, GroupedProject, ViewMode } from "../../types"
import { watch } from "vue"
import { Icon } from "@iconify/vue"
import Button from "@/components/Button.vue"
import EmptyState from "../common/EmptyState.vue"
import ListViewToolbar from "./ListViewToolbar.vue"
import ProjectCard from "./ProjectCard.vue"
import { provideCardAccordion } from "../../composables/useCardAccordion"

const props = defineProps<{
  i18n: Record<string, any>
  groupedProjects: GroupedProject[]
  filteredGroups: GroupedProject[]
  /** 全部项目标签（工具栏筛选 chips 数据源） */
  allTags: string[]
  /** 已选标签（多选，空数组 = 不筛选） */
  selectedTags: string[]
  /** 空态提示文案（null = 不显示空态，走卡片列表；由 index.vue 综合视图模式与搜索词计算） */
  emptyHint: string | null
  /** 是否处于全局搜索态（决定提示条、分组头与空态图标/操作） */
  searchActive: boolean
  /** 全局搜索命中总数（提示条展示） */
  searchResultCount: number
}>()

const emit = defineEmits<{
  toggleTag: [tag: string]
  clearTagFilter: []
  clearSearch: []
}>()

const viewMode = defineModel<ViewMode>("viewMode", { required: true })
const activeCategory = defineModel<string>("activeCategory", { required: true })
const showArchived = defineModel<boolean>("showArchived", { required: true })
const gitOpsPaused = defineModel<boolean>("gitOpsPaused", { required: true })
const cardLayout = defineModel<CardLayout>("cardLayout", { required: true })

/** 手风琴上下文：一次只展开一张卡片（会话内恢复上次展开项） */
const accordion = provideCardAccordion(() => cardLayout.value)

/** 「有变更」视图本轮是否已自动展开过（避免数据刷新反复重置用户的选择） */
let autoExpandedUncommitted = false

/**
 * 切到「有变更」视图（或该视图数据就绪）时展开第一个命中项目：
 * 用户进入该视图的目的就是看变更，直接把他带到内容，省一次点击。
 */
function expandFirstUncommitted() {
  if (autoExpandedUncommitted || viewMode.value !== "uncommitted" || cardLayout.value !== "accordion") return
  const first = props.filteredGroups[0]?.projects[0]
  if (!first) return
  autoExpandedUncommitted = true
  accordion.expand(first.id)
}

watch(viewMode, (mode) => {
  autoExpandedUncommitted = false
  if (mode === "uncommitted") expandFirstUncommitted()
})

// 数据晚于视图切换就绪（首次加载 / 暂停恢复）时补一次
watch(() => props.filteredGroups, expandFirstUncommitted)

// 切到手风琴时，若已在「有变更」视图也直接展开首项
watch(cardLayout, (layout) => {
  if (layout === "accordion") expandFirstUncommitted()
})
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/ListView.scss";
</style>
