<!-- gitPush 列表视图顶部工具栏（视图模式 + 归档/暂停切换 + 分类TAB） -->
<template>
  <!-- 筛选工具栏（智能视图 + 归档 toggle + 暂停 toggle） -->
  <div
    v-if="projects.length > 0"
    class="gp-filter-bar"
  >
    <!-- 智能视图：一组互斥选项 ⇒ Button 分组 + aria-pressed（不引入面板，故不用 Tabs） -->
    <div class="gp-view-modes">
      <Button
        v-for="vm in VIEW_MODES"
        :key="vm"
        class="gp-vm-btn"
        variant="ghost"
        size="xsmall"
        dense
        :icon="VIEW_MODE_ICONS[vm]"
        :aria-pressed="viewMode === vm"
        :title="i18n[VIEW_MODE_META[vm].labelKey]"
        @click="viewMode = vm"
      >
        <!-- 视图模式标签："全部 / 需推送 / 有变更 / 收藏 / 归档" -->
        {{ i18n[VIEW_MODE_META[vm].labelKey] }}
      </Button>
    </div>
    <div class="gp-filter-toggles">
      <!-- 归档 toggle（归档视图下开关无效，直接隐藏；按下时显示"含归档"） -->
      <ToggleButton
        v-if="viewMode !== 'archived'"
        v-model="showArchived"
        class="gp-ft-btn"
        size="xsmall"
        dense
        on-icon="archiveOutline"
        off-icon="archiveOutline"
        :on-label="i18n.archivedIncluded"
        :aria-label="i18n.toggleArchivedTip"
        :title="i18n.toggleArchivedTip"
      />
      <!-- Git 状态加载暂停 toggle（悬停提示随状态变化，可访问名称固定为"暂停 Git 状态加载"） -->
      <ToggleButton
        v-model="gitOpsPaused"
        class="gp-ft-btn"
        size="xsmall"
        dense
        on-icon="pauseCircle"
        off-icon="pauseCircleOutline"
        :on-label="i18n.gitOpsPausedLabel"
        :aria-label="i18n.gitOpsPauseTip"
        :title="gitOpsPaused ? i18n.gitOpsPausedTip : i18n.gitOpsPauseTip"
      />
    </div>
  </div>

  <!-- 分类 TAB 导航（仅 all 模式显示） -->
  <div
    v-if="viewMode === 'all' && groupedProjects.length > 0"
    class="gp-tabs"
  >
    <Button
      v-for="g in groupedProjects"
      :key="g.category.id"
      class="gp-tab"
      variant="ghost"
      size="xsmall"
      dense
      :aria-pressed="activeCategory === g.category.id"
      :style="activeCategory === g.category.id ? { borderBottomColor: g.category.color } : {}"
      @click="activeCategory = g.category.id"
    >
      <span
        class="gp-tab-dot"
        :style="{ background: g.category.color }"
      />
      <span>{{ g.category.name }}</span>
      <span class="gp-tab-count">{{ g.projects.length }}</span>
    </Button>
  </div>
</template>

<script setup lang="ts">
import type { GitProject, ProjectCategory, ViewMode } from "../../types"
import { VIEW_MODE_META, VIEW_MODES } from "../../types"
import type { IconKey } from "@/components/kit/icons"
import Button from "@/components/Button.vue"
import ToggleButton from "@/components/ToggleButton.vue"

/** 视图模式 → IconKey 投影（共享 Button 的 icon 只接受已注册 IconKey，不接受任意 Iconify 名） */
const VIEW_MODE_ICONS: Record<ViewMode, IconKey> = {
  all: "layoutGrid",
  needsPush: "cloudUpload",
  uncommitted: "sourceBranch",
  starred: "star",
  archived: "archiveOutline",
}

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
@use "../../styles/ListViewToolbar.scss";
</style>
