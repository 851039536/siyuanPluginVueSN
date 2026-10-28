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

  <!-- 空态提示：未选择分类时引导用户点选上方 TAB（首次进入不自动选择，避免加载全部项目的 git 状态）。
       文案由 index.vue 计算（需综合 viewMode / searchQuery 判据），本组件保持纯渲染 -->
  <EmptyState
    v-if="emptyHint"
    icon="mdi:folder-multiple-outline"
    :text="emptyHint"
  />

  <!-- 分组循环卡片列表 -->
  <div
    v-else
    class="gp-list"
  >
    <template
      v-for="group in filteredGroups"
      :key="group.category.id"
    >
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
import EmptyState from "../common/EmptyState.vue"
import ListViewToolbar from "./ListViewToolbar.vue"
import ProjectCard from "./ProjectCard.vue"
import { provideCardAccordion } from "../../composables/useCardAccordion"

defineProps<{
  i18n: Record<string, any>
  groupedProjects: GroupedProject[]
  filteredGroups: GroupedProject[]
  /** 全部项目标签（工具栏筛选 chips 数据源） */
  allTags: string[]
  /** 已选标签（多选，空数组 = 不筛选） */
  selectedTags: string[]
  /** 空态提示文案（null = 不显示空态，走卡片列表；由 index.vue 综合视图模式与搜索词计算） */
  emptyHint: string | null
}>()

const emit = defineEmits<{
  toggleTag: [tag: string]
  clearTagFilter: []
}>()

const viewMode = defineModel<ViewMode>("viewMode", { required: true })
const activeCategory = defineModel<string>("activeCategory", { required: true })
const showArchived = defineModel<boolean>("showArchived", { required: true })
const gitOpsPaused = defineModel<boolean>("gitOpsPaused", { required: true })
const cardLayout = defineModel<CardLayout>("cardLayout", { required: true })

/** 手风琴上下文：一次只展开一张卡片（状态随列表视图实例存活） */
provideCardAccordion(() => cardLayout.value)
</script>

<style lang="scss">
@use "@/index.scss" as *;
</style>
