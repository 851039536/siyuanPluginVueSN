<!-- 列表视图入口容器：工具栏 + 分组循环卡片（纯渲染，领域状态由 gitPush 根组件经 CARD_SERVICES_KEY 注入） -->
<template>
  <!-- 筛选工具栏 + 分类 TAB -->
  <ListViewToolbar
    v-model:view-mode="viewMode"
    v-model:active-category="activeCategory"
    v-model:show-archived="showArchived"
    v-model:git-ops-paused="gitOpsPaused"
    :i18n="i18n"
    :projects="projects"
    :grouped-projects="groupedProjects"
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
import type { GitProject, ProjectCategory, ViewMode } from "../../types"
import EmptyState from "../common/EmptyState.vue"
import ListViewToolbar from "./ListViewToolbar.vue"
import ProjectCard from "./ProjectCard.vue"

/** 分组：分类 + 该分类下的项目列表 */
export interface GroupedProject {
  category: ProjectCategory
  projects: GitProject[]
}

defineProps<{
  i18n: Record<string, any>
  projects: GitProject[]
  groupedProjects: GroupedProject[]
  filteredGroups: GroupedProject[]
  /** 空态提示文案（null = 不显示空态，走卡片列表；由 index.vue 综合视图模式与搜索词计算） */
  emptyHint: string | null
}>()

const viewMode = defineModel<ViewMode>("viewMode", { required: true })
const activeCategory = defineModel<string>("activeCategory", { required: true })
const showArchived = defineModel<boolean>("showArchived", { required: true })
const gitOpsPaused = defineModel<boolean>("gitOpsPaused", { required: true })
</script>

<style lang="scss">
@use "@/index.scss" as *;
</style>
