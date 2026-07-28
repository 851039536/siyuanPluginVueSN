<!-- gitPush 列表视图顶部工具栏（视图模式 + 归档/暂停切换 + 分类TAB） -->
<template>
  <!-- 筛选工具栏（智能视图 + 归档 toggle + 暂停 toggle） -->
  <div
    v-if="projects.length > 0"
    class="gp-filter-bar"
  >
    <div class="gp-view-modes">
      <button
        v-for="vm in VIEW_MODES"
        :key="vm"
        class="gp-vm-btn"
        :class="{ active: viewMode === vm }"
        :title="i18n[VIEW_MODE_META[vm].labelKey]"
        @click="viewMode = vm"
      >
        <Icon
          :icon="VIEW_MODE_META[vm].icon"
          height="12"
        />
        <!-- 视图模式标签："全部 / 需推送 / 有变更 / 收藏 / 归档" -->
        <span>{{ i18n[VIEW_MODE_META[vm].labelKey] }}</span>
      </button>
    </div>
    <div class="gp-filter-toggles">
      <!-- 归档 toggle（归档视图下开关无效，直接隐藏） -->
      <button
        v-if="viewMode !== 'archived'"
        class="gp-ft-btn"
        :class="{ active: showArchived }"
        :title="i18n.toggleArchivedTip"
        @click="showArchived = !showArchived"
      >
        <Icon
          icon="mdi:archive-outline"
          height="12"
        />
        <!-- 开启时标签："含归档" -->
        <span v-if="showArchived">{{ i18n.archivedIncluded }}</span>
      </button>
      <!-- Git 状态加载暂停 toggle，title："已暂停 Git 状态加载 / 暂停 Git 状态加载" -->
      <button
        class="gp-ft-btn"
        :class="{ active: gitOpsPaused }"
        :title="gitOpsPaused ? i18n.gitOpsPausedTip : i18n.gitOpsPauseTip"
        @click="gitOpsPaused = !gitOpsPaused"
      >
        <Icon
          :icon="gitOpsPaused ? 'mdi:pause-circle' : 'mdi:pause-circle-outline'"
          height="12"
        />
        <!-- 暂停时标签："已暂停" -->
        <span v-if="gitOpsPaused">{{ i18n.gitOpsPausedLabel }}</span>
      </button>
    </div>
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
      @click="activeCategory = g.category.id"
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
import type { GitProject, ProjectCategory, ViewMode } from "../types"
import { Icon } from "@iconify/vue"
import { VIEW_MODE_META, VIEW_MODES } from "../types"

defineProps<{
  i18n: Record<string, any>
  projects: GitProject[]
  groupedProjects: { category: ProjectCategory, projects: GitProject[] }[]
}>()

const viewMode = defineModel<ViewMode>("viewMode", { required: true })
const activeCategory = defineModel<string>("activeCategory", { required: true })
const showArchived = defineModel<boolean>("showArchived", { required: true })
const gitOpsPaused = defineModel<boolean>("gitOpsPaused", { required: true })
</script>

<style lang="scss">
@use "../styles/ListViewToolbar.scss";
</style>
