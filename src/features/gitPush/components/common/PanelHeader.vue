<!-- gitPush 面板头部工具栏 -->
<template>
  <div class="gp-header">
    <div class="gp-header-left">
      <!-- 批量操作旋转进度指示器（tooltip："操作名 n/m"） -->
      <div
        v-if="progress?.visible"
        class="gp-header-progress"
        :class="{ 'is-done': progress.done }"
        :title="`${progress.label} ${progress.current}/${progress.total}`"
      >
        <Icon
          :icon="progress.done ? 'mdi:check-circle-outline' : 'mdi:loading'"
          height="12"
          :class="{ 'gp-header-progress-spin': !progress.done }"
        />
        <span>{{ progress.current }}/{{ progress.total }}</span>
      </div>

      <!-- 面板标题："Git" -->
      <span class="gp-title">{{ i18n.panelTitle }}</span>
      <span
        v-if="projectCount > 0"
        class="gp-count-badge"
      >{{ projectCount }}</span>
    </div>

    <div class="gp-header-btns">
      <!-- 视图切换（三个入口由 VIEW_GROUPS 配置驱动；统计组内含项目状态/提交分析/代码报告三视图） -->
      <div class="gp-view-toggle">
        <button
          v-for="group in VIEW_GROUPS"
          :key="group.key"
          class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
          :class="{ active: isGroupActive(group) }"
          :title="i18n[group.labelKey]"
          :aria-label="i18n[group.labelKey]"
          :aria-pressed="isGroupActive(group)"
          @click="activateGroup(group)"
        >
          <Icon
            :icon="group.icon"
            height="12"
          />
        </button>
      </div>
      <!-- 平台官网快捷入口 -->
      <span class="gp-header-sep" />
      <div class="gp-platform-wrap">
        <!-- 按钮（tooltip："平台官网"） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-platform-dropdown-btn"
          :title="i18n.platformSites"
          aria-haspopup="menu"
          :aria-expanded="showPlatformMenu"
          @click.stop="showPlatformMenu = !showPlatformMenu"
        >
          <Icon
            icon="mdi:web"
            height="12"
          />
          <Icon
            icon="mdi:unfold-more-horizontal"
            height="12"
            class="gp-platform-caret"
          />
        </button>
        <MenuPopover
          v-if="showPlatformMenu"
          class="gp-platform-popover"
          :aria-label="i18n.platformSites"
          @escape="showPlatformMenu = false"
        >
          <button
            v-for="pl in PLATFORM_META"
            :key="pl.key"
            class="gp-platform-item"
            role="menuitem"
            @click="showPlatformMenu = false; emit('openWeb', pl.webUrl)"
          >
            <Icon
              :icon="pl.icon"
              height="12"
            />
            <span>{{ pl.label }}</span>
          </button>
        </MenuPopover>
      </div>
      <span class="gp-header-sep" />
      <!-- 按钮（tooltip："设置"） -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :title="i18n.settings"
        @click="emit('openSettings')"
      >
        <Icon
          icon="mdi:cog-outline"
          height="12"
        />
      </button>
      <!-- 在独立窗口打开（浮动窗口内隐藏；关闭浮动窗口自动移回主窗口） -->
      <button
        v-if="!isFloating"
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :title="i18n.openFloatingWindow"
        @click="emit('openFloating')"
      >
        <Icon
          icon="mdi:dock-window"
          height="12"
        />
      </button>
      <!-- 添加/导入合并下拉 -->
      <div class="gp-add-wrap">
        <button
          class="vp-btn vp-btn--ghost gp-add-dropdown-btn"
          aria-haspopup="menu"
          :aria-expanded="showAddMenu"
          @click.stop="showAddMenu = !showAddMenu"
        >
          <Icon
            icon="mdi:plus"
            height="12"
          />
        </button>
        <MenuPopover
          v-if="showAddMenu"
          class="gp-add-popover"
          :aria-label="i18n.addProject"
          @escape="showAddMenu = false"
        >
          <!-- 菜单项："添加" -->
          <button
            class="gp-add-item"
            role="menuitem"
            @click="showAddMenu = false; emit('openAddProject')"
          >
            <Icon
              icon="mdi:plus-circle-outline"
              height="12"
            />
            <span>{{ i18n.addProject }}</span>
          </button>
          <!-- 菜单项："导入" -->
          <button
            class="gp-add-item"
            role="menuitem"
            @click="showAddMenu = false; emit('openScan')"
          >
            <Icon
              icon="mdi:file-find-outline"
              height="12"
            />
            <span>{{ i18n.importProject }}</span>
          </button>
        </MenuPopover>
      </div>

      <!-- 项目搜索框（placeholder："搜索项目..."；仅在列表视图显示，避免其余视图出现无效输入框） -->
      <div
        v-if="showProjectSearch && projectCount > 0"
        class="gp-header-search"
      >
        <SearchBox
          v-model="searchQuery"
          :placeholder="i18n.searchPlaceholder"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { PLATFORM_META, type PanelView } from "../../types"
import type { LoadProgress } from "../../types/batchProgress"
import MenuPopover from "./MenuPopover.vue"
import SearchBox from "./SearchBox.vue"

withDefaults(defineProps<{
  i18n: Record<string, any>
  projectCount?: number
  /** 当前是否运行在独立浮动窗口中（浮动窗口内隐藏「在独立窗口打开」按钮） */
  isFloating?: boolean
  /** 是否显示项目搜索框（仅列表视图消费搜索词，其余视图隐藏以免出现无效输入框） */
  showProjectSearch?: boolean
  /** 批量操作进度状态（运行中/完成时在头部最右侧显示旋转进度指示器） */
  progress?: LoadProgress
}>(), {
  projectCount: 0,
  isFloating: false,
  showProjectSearch: false,
})

// ── 双向绑定（defineModel 收敛 props + update: emit 样板） ──
const currentView = defineModel<PanelView>("currentView", { required: true })
const showPlatformMenu = defineModel<boolean>("showPlatformMenu", { default: false })
const showAddMenu = defineModel<boolean>("showAddMenu", { default: false })
const searchQuery = defineModel<string>("searchQuery", { default: "" })

const emit = defineEmits<{
  openSettings: []
  openAddProject: []
  openScan: []
  openWeb: [url: string]
  openFloating: []
}>()

/** 顶层视图入口（每个入口可覆盖多个 PanelView；统计组内含项目状态/提交分析/代码报告） */
interface ViewGroup {
  key: string
  icon: string
  labelKey: string
  views: readonly PanelView[]
}

/**
 * 顶层视图入口配置（单一事实源）。
 * 顺序即渲染顺序；icon 为 Iconify 名（本处 raw <button> 直接用 Iconify，不受 IconKey 约束），
 * labelKey 指向 i18n 键并同时作为 hover 提示与无障碍名称。
 */
const VIEW_GROUPS: ViewGroup[] = [
  { key: "list", icon: "mdi:view-list", labelKey: "listView", views: ["list"] },
  // 规则检查与行数排行为「提交分析」的内部 Tab，不再各占一个入口
  { key: "stats", icon: "mdi:chart-bar", labelKey: "statsGroup", views: ["stats", "analysis", "report"] },
  { key: "repoclean", icon: "mdi:broom", labelKey: "repoCleanView", views: ["repoclean"] },
]

/** 当前视图是否落在该入口覆盖的视图集合内 */
function isGroupActive(group: ViewGroup): boolean {
  return group.views.includes(currentView.value)
}

/** 点击入口：组内已激活时保持当前子视图；跨组进入时落到组内首个视图 */
function activateGroup(group: ViewGroup): void {
  if (isGroupActive(group)) return
  const first = group.views[0]
  if (first) currentView.value = first
}
</script>

<style lang="scss">
@use "../../styles/PanelHeader.scss";
</style>
