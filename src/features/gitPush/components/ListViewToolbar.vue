<!-- gitPush 列表视图顶部工具栏（视图模式 + 归档/暂停切换 + 标签筛选 + 分类TAB） -->
<template>
  <!-- 筛选工具栏（智能视图 + 归档 toggle + 暂停 toggle） -->
  <div
    v-if="projects.length > 0"
    class="gp-filter-bar"
  >
    <div class="gp-view-modes">
      <button
        v-for="vm in viewModes"
        :key="vm"
        class="gp-vm-btn"
        :class="{ active: viewMode === vm }"
        :title="viewModeMeta[vm].label"
        @click="$emit('update:viewMode', vm)"
      >
        <Icon
          :icon="viewModeMeta[vm].icon"
          height="12"
        />
        <span>{{ viewModeMeta[vm].label }}</span>
      </button>
    </div>
    <div class="gp-filter-toggles">
      <button
        class="gp-ft-btn"
        :class="{ active: showArchived }"
        title="显示/隐藏归档项目"
        @click="$emit('update:showArchived', !showArchived)"
      >
        <Icon
          icon="mdi:archive-outline"
          height="12"
        />
        <span v-if="showArchived">含归档</span>
      </button>
      <button
        class="gp-ft-btn"
        :class="{ active: gitOpsPaused }"
        :title="gitOpsPaused ? '已暂停 Git 状态加载' : '暂停 Git 状态加载'"
        @click="$emit('update:gitOpsPaused', !gitOpsPaused)"
      >
        <Icon
          :icon="gitOpsPaused ? 'mdi:pause-circle' : 'mdi:pause-circle-outline'"
          height="12"
        />
        <span v-if="gitOpsPaused">已暂停</span>
      </button>
    </div>
  </div>

  <!-- 标签筛选条（有标签时显示） -->
  <div
    v-if="allTags.length > 0 && projects.length > 0"
    class="gp-tag-filter"
  >
    <button
      v-for="t in allTags"
      :key="t"
      class="gp-tag-chip"
      :class="{ active: selectedTags.has(t) }"
      @click="$emit('toggleTagFilter', t)"
    >{{ t }}</button>
  </div>

  <!-- 分类 TAB 导航（仅 all 模式显示） -->
  <div
    v-if="viewMode === 'all' && groupedProjects.length > 0"
    class="gp-tabs"
  >
    <button
      v-for="g in groupedProjects"
      :key="g.category.id"
      class="gp-tab"
      :class="{ active: activeCategory === g.category.id }"
      :style="activeCategory === g.category.id ? { borderBottomColor: g.category.color } : {}"
      @click="$emit('update:activeCategory', g.category.id)"
    >
      <span
        class="gp-tab-dot"
        :style="{ background: g.category.color }"
      />
      <span>{{ g.category.name }}</span>
      <span class="gp-tab-count">{{ g.projects.length }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type {
  GitProject,
  ProjectCategory,
} from "../types"
import { Icon } from "@iconify/vue"
import { VIEW_MODE_META } from "../composables/useProjectFilters"

type ViewMode = "all" | "needsPush" | "uncommitted" | "starred" | "archived"

defineProps<{
  projects: GitProject[]
  groupedProjects: { category: ProjectCategory, projects: GitProject[] }[]
  allTags: string[]
  selectedTags: Set<string>
  viewMode: ViewMode
  activeCategory: string
  showArchived: boolean
  gitOpsPaused: boolean
}>()

defineEmits<{
  "update:viewMode": [mode: ViewMode]
  "update:activeCategory": [id: string]
  "update:showArchived": [v: boolean]
  "update:gitOpsPaused": [v: boolean]
  "toggleTagFilter": [tag: string]
}>()

const viewModes = ["all", "needsPush", "uncommitted", "starred", "archived"] as const
const viewModeMeta = VIEW_MODE_META
</script>

<style lang="scss">
@use "../styles/ListViewToolbar.scss";
</style>
