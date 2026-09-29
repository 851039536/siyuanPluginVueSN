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
      <!-- 视图切换（六个视图按钮由 VIEW_TABS 配置驱动：差异仅 view/icon/labelKey 三项） -->
      <div class="gp-view-toggle">
        <button
          v-for="tab in VIEW_TABS"
          :key="tab.view"
          class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
          :class="{ active: currentView === tab.view }"
          :title="i18n[tab.labelKey]"
          @click="currentView = tab.view"
        >
          <Icon
            :icon="tab.icon"
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
        <div
          v-if="showPlatformMenu"
          class="gp-platform-popover"
          @click.stop
        >
          <button
            v-for="pl in PLATFORM_META"
            :key="pl.key"
            class="gp-platform-item"
            @click="showPlatformMenu = false; emit('openWeb', pl.webUrl)"
          >
            <Icon
              :icon="pl.icon"
              height="12"
            />
            <span>{{ pl.label }}</span>
          </button>
        </div>
      </div>
      <span class="gp-header-sep" />
      <!-- 按钮（tooltip："远程与本地一致性分析"） -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :title="i18n.consistencyTitle"
        @click="emit('openConsistency')"
      >
        <Icon
          icon="mdi:source-branch-check"
          height="12"
        />
      </button>
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
          @click.stop="showAddMenu = !showAddMenu"
        >
          <Icon
            icon="mdi:plus"
            height="12"
          />
        </button>
        <div
          v-if="showAddMenu"
          class="gp-add-popover"
          @click.stop
        >
          <!-- 菜单项："添加" -->
          <button
            class="gp-add-item"
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
            @click="showAddMenu = false; emit('openScan')"
          >
            <Icon
              icon="mdi:file-find-outline"
              height="12"
            />
            <span>{{ i18n.importProject }}</span>
          </button>
        </div>
      </div>

      <!-- 项目搜索框（placeholder："搜索项目..."） -->
      <div
        v-if="projectCount > 0"
        class="gp-header-search"
      >
        <Input
          v-model="searchQuery"
          size="xsmall"
          :placeholder="i18n.searchPlaceholder"
          prefix-icon="search"
          clearable
          autocomplete="off"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import Input from "@/components/Input.vue"
import { PLATFORM_META, type PanelView } from "../../types"
import type { LoadProgress } from "../../types/batchProgress"

withDefaults(defineProps<{
  i18n: Record<string, any>
  projectCount?: number
  /** 当前是否运行在独立浮动窗口中（浮动窗口内隐藏「在独立窗口打开」按钮） */
  isFloating?: boolean
  /** 批量操作进度状态（运行中/完成时在头部最右侧显示旋转进度指示器） */
  progress?: LoadProgress
}>(), {
  projectCount: 0,
  isFloating: false,
})

// ── 双向绑定（defineModel 收敛 props + update: emit 样板） ──
const currentView = defineModel<PanelView>("currentView", { required: true })
const showPlatformMenu = defineModel<boolean>("showPlatformMenu", { default: false })
const showAddMenu = defineModel<boolean>("showAddMenu", { default: false })
const searchQuery = defineModel<string>("searchQuery", { default: "" })

const emit = defineEmits<{
  openConsistency: []
  openSettings: []
  openAddProject: []
  openScan: []
  openWeb: [url: string]
  openFloating: []
}>()

/**
 * 视图切换按钮配置（六个视图的唯一事实源）。
 * 顺序即渲染顺序；icon 为 Iconify 名（本处 raw <button> 直接用 Iconify，不受 IconKey 约束），
 * labelKey 指向 i18n 键并同时作为 hover 提示。
 */
const VIEW_TABS: { view: PanelView, icon: string, labelKey: string }[] = [
  { view: "list", icon: "mdi:view-list", labelKey: "listView" },
  { view: "stats", icon: "mdi:chart-bar", labelKey: "statsView" },
  // 规则检查与行数排行为「提交分析」的内部 Tab，不再各占一个入口
  { view: "analysis", icon: "mdi:chart-timeline-variant", labelKey: "analysisView" },
  { view: "log", icon: "mdi:history", labelKey: "logView" },
  { view: "report", icon: "mdi:chart-box", labelKey: "reportView" },
  { view: "repoclean", icon: "mdi:broom", labelKey: "repoCleanView" },
]
</script>

<style lang="scss">
@use "../../styles/PanelHeader.scss";
</style>
