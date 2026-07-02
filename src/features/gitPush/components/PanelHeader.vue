<!-- gitPush 面板头部工具栏 -->
<template>
  <div class="gp-header">
    <div class="gp-header-left">
      <span class="gp-title">{{ i18n.panelTitle || 'Git 推送' }}</span>
      <span
        v-if="projectCount > 0"
        class="gp-count-badge"
      >{{ projectCount }}</span>
    </div>
    <div class="gp-header-btns">
      <!-- 视图切换 -->
      <div class="gp-view-toggle">
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
          :class="{ active: currentView === 'list' }"
          title="列表视图"
          @click="emit('update:currentView', 'list')"
        >
          <Icon
            icon="mdi:view-list"
            height="12"
          />
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
          :class="{ active: currentView === 'stats' }"
          title="统计视图"
          @click="emit('update:currentView', 'stats')"
        >
          <Icon
            icon="mdi:chart-bar"
            height="12"
          />
        </button>
      </div>
      <!-- 平台官网快捷入口 -->
      <span class="gp-header-sep" />
      <div class="gp-platform-wrap">
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-platform-dropdown-btn"
          title="平台官网"
          @click.stop="emit('update:showPlatformMenu', !showPlatformMenu)"
        >
          <Icon
            icon="mdi:web"
            height="12"
          />
          <Icon
            icon="mdi:unfold-more-horizontal"
            height="12"
            style="margin-left:1px;opacity:0.5"
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
            @click="emit('update:showPlatformMenu', false); emit('openWeb', pl.webUrl)"
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
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        @click="emit('openCategory')"
      >
        <Icon
          icon="mdi:tag-outline"
          height="12"
        />
      </button>
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        title="设置"
        @click="emit('openSettings')"
      >
        <Icon
          icon="mdi:cog-outline"
          height="12"
        />
      </button>
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        title="手动刷新当前分类"
        :disabled="refreshingAll"
        @click="emit('refreshAll')"
      >
        <Icon
          icon="mdi:sync"
          height="12"
          :class="{ 'gp-spin': refreshingAll }"
        />
      </button>
      <button
        class="vp-btn vp-btn--primary vp-btn--sm"
        title="推送所有待推送项目"
        :disabled="needsPushCount === 0 || pushingAllProjects"
        @click="emit('pushAllProjects')"
      >
        <Icon
          icon="mdi:cloud-upload"
          height="12"
          :class="{ 'gp-spin': pushingAllProjects }"
        />
        <span v-if="pushingAllProjects">推送中 ({{ pushAllDone }}/{{ pushAllTotal }})</span>
        <span v-else>推送全部({{ needsPushCount }})</span>
      </button>
      <div class="gp-add-wrap">
        <button
          class="vp-btn vp-btn--ghost gp-add-dropdown-btn"
          @click.stop="emit('update:showAddMenu', !showAddMenu)"
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
          <button
            class="gp-add-item"
            @click="emit('update:showAddMenu', false); emit('openAddProject')"
          >
            <Icon
              icon="mdi:plus-circle-outline"
              height="12"
            />
            <span>{{ i18n.addProject || '添加单个项目' }}</span>
          </button>
          <button
            class="gp-add-item"
            @click="emit('update:showAddMenu', false); emit('openScan')"
          >
            <Icon
              icon="mdi:file-find-outline"
              height="12"
            />
            <span>{{ i18n.importProject || '批量导入' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { PLATFORM_META } from "../types"

interface Props {
  i18n: Record<string, any>
  projectCount?: number
  currentView: "list" | "stats"
  refreshingAll?: boolean
  needsPushCount?: number
  pushingAllProjects?: boolean
  pushAllDone?: number
  pushAllTotal?: number
  showPlatformMenu?: boolean
  showAddMenu?: boolean
}

withDefaults(defineProps<Props>(), {
  projectCount: 0,
  refreshingAll: false,
  needsPushCount: 0,
  pushingAllProjects: false,
  pushAllDone: 0,
  pushAllTotal: 0,
  showPlatformMenu: false,
  showAddMenu: false,
})

const emit = defineEmits<{
  "update:currentView": [value: "list" | "stats"]
  "update:showPlatformMenu": [value: boolean]
  "update:showAddMenu": [value: boolean]
  openCategory: []
  openSettings: []
  refreshAll: []
  pushAllProjects: []
  openAddProject: []
  openScan: []
  openWeb: [url: string]
}>()
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../styles/variables" as *;
@use "../styles/PanelHeader.scss";
</style>
