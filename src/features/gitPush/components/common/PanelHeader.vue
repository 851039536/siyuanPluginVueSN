<!-- gitPush 面板头部工具栏 -->
<template>
  <div class="gp-header">
    <div class="gp-header-left">
      <!-- 面板标题："Git 推送" -->
      <span class="gp-title">{{ i18n.panelTitle }}</span>
      <span
        v-if="projectCount > 0"
        class="gp-count-badge"
      >{{ projectCount }}</span>
    </div>

    <div class="gp-header-btns">
      <!-- 视图切换 -->
      <div class="gp-view-toggle">
        <!-- 按钮（tooltip："列表视图"） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
          :class="{ active: currentView === 'list' }"
          :title="i18n.listView"
          @click="currentView = 'list'"
        >
          <Icon
            icon="mdi:view-list"
            height="12"
          />
        </button>
        <!-- 按钮（tooltip：“统计视图”） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
          :class="{ active: currentView === 'stats' }"
          :title="i18n.statsView"
          @click="currentView = 'stats'"
        >
          <Icon
            icon="mdi:chart-bar"
            height="12"
          />
        </button>
        <!-- 按钮（tooltip：“提交分析”） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
          :class="{ active: currentView === 'analysis' }"
          :title="i18n.analysisView"
          @click="currentView = 'analysis'"
        >
          <Icon
            icon="mdi:chart-timeline-variant"
            height="12"
          />
        </button>
        <!-- 按钮（tooltip："操作日志"） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
          :class="{ active: currentView === 'log' }"
          :title="i18n.logView"
          @click="currentView = 'log'"
        >
          <Icon
            icon="mdi:history"
            height="12"
          />
        </button>
        <!-- 按钮（tooltip："行数统计"） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
          :class="{ active: currentView === 'linestats' }"
          :title="i18n.lineStatsView"
          @click="currentView = 'linestats'"
        >
          <Icon
            icon="mdi:code-tags"
            height="12"
          />
        </button>
        <!-- 按钮（tooltip："统计报告"） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
          :class="{ active: currentView === 'report' }"
          :title="i18n.reportView"
          @click="currentView = 'report'"
        >
          <Icon
            icon="mdi:chart-box"
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
      <!-- 按钮（tooltip："管理分类"） -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :title="i18n.manageCategories"
        @click="emit('openCategory')"
      >
        <Icon
          icon="mdi:tag-outline"
          height="12"
        />
      </button>
      <!-- 按钮（tooltip："Git 配置"） -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :title="i18n.gitConfigLabel"
        @click="emit('openGitConfig')"
      >
        <Icon
          icon="mdi:information-outline"
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
      <!-- 刷新下拉菜单 -->
      <div class="gp-header-refresh-wrap">
        <!-- 按钮（tooltip："刷新选项"，刷新进行中图标转圈） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :title="i18n.refreshOptions"
          :disabled="refreshingAllLocal || refreshingAllRemote || refreshingAll"
          @click.stop="showRefreshMenu = !showRefreshMenu"
        >
          <Icon
            icon="mdi:sync"
            height="12"
            :class="{ 'gp-spin': refreshingAllLocal || refreshingAllRemote || refreshingAll }"
          />
        </button>
        <div
          v-if="showRefreshMenu"
          class="gp-refresh-popover"
          @click.stop
        >
          <!-- 菜单项："刷新本地状态"（点击后关闭菜单，进度由头部 sync 图标转圈体现） -->
          <button
            class="gp-refresh-item"
            :disabled="refreshingAllLocal"
            @click="showRefreshMenu = false; emit('refreshAllLocal')"
          >
            <Icon
              icon="mdi:file-document-outline"
              height="12"
            />
            <span>{{ i18n.headerRefreshLocal }}</span>
          </button>
          <!-- 菜单项："刷新远程状态" -->
          <button
            class="gp-refresh-item"
            :disabled="refreshingAllRemote"
            @click="showRefreshMenu = false; emit('refreshAllRemote')"
          >
            <Icon
              icon="mdi:cloud-refresh-outline"
              height="12"
            />
            <span>{{ i18n.headerRefreshRemote }}</span>
          </button>
          <div class="gp-refresh-divider" />
          <!-- 菜单项："全部刷新" -->
          <button
            class="gp-refresh-item gp-refresh-item--all"
            :disabled="refreshingAll"
            @click="showRefreshMenu = false; emit('refreshAll')"
          >
            <Icon
              icon="mdi:refresh-circle"
              height="12"
            />
            <span>{{ i18n.refreshAll }}</span>
          </button>
        </div>
      </div>
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

withDefaults(defineProps<{
  i18n: Record<string, any>
  projectCount?: number
  refreshingAll?: boolean
  refreshingAllLocal?: boolean
  refreshingAllRemote?: boolean
}>(), {
  projectCount: 0,
  refreshingAll: false,
  refreshingAllLocal: false,
  refreshingAllRemote: false,
})

// ── 双向绑定（defineModel 收敛 props + update: emit 样板） ──
const currentView = defineModel<PanelView>("currentView", { required: true })
const showPlatformMenu = defineModel<boolean>("showPlatformMenu", { default: false })
const showAddMenu = defineModel<boolean>("showAddMenu", { default: false })
const showRefreshMenu = defineModel<boolean>("showRefreshMenu", { default: false })
const searchQuery = defineModel<string>("searchQuery", { default: "" })

const emit = defineEmits<{
  openCategory: []
  openGitConfig: []
  openSettings: []
  refreshAll: []
  refreshAllLocal: []
  refreshAllRemote: []
  openAddProject: []
  openScan: []
  openWeb: [url: string]
}>()
</script>

<style lang="scss">
@use "../../styles/PanelHeader.scss";
</style>
