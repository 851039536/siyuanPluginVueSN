<!-- gitPush 面板头部工具栏 -->
<template>
  <div class="gp-header">
    <div class="gp-header-left">
      <span class="gp-title">{{ i18n.panelTitle }}</span>
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
          :title="i18n.listView "
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
          :title="i18n.statsView"
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
          :title="i18n.platformSites"
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
        :title="i18n.gitConfigLabel"
        @click="emit('openGitConfig')"
      >
        <Icon
          icon="mdi:information-outline"
          height="12"
        />
      </button>
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
      <div class="gp-header-refresh-wrap">
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :title="i18n.refreshOptions"
          :disabled="refreshingAllLocal || refreshingAllRemote || refreshingAll"
          @click.stop="emit('update:showRefreshMenu', !showRefreshMenu)"
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
          <button
            class="gp-refresh-item"
            :disabled="refreshingAllLocal"
            @click="emit('refreshAllLocal')"
          >
            <Icon
              :icon="refreshingAllLocal ? 'mdi:loading' : 'mdi:file-document-outline'"
              height="12"
              :class="{ 'gp-spin': refreshingAllLocal }"
            />
            <span>{{ i18n.headerRefreshLocal }}</span>
          </button>
          <button
            class="gp-refresh-item"
            :disabled="refreshingAllRemote"
            @click="emit('refreshAllRemote')"
          >
            <Icon
              :icon="refreshingAllRemote ? 'mdi:loading' : 'mdi:cloud-refresh-outline'"
              height="12"
              :class="{ 'gp-spin': refreshingAllRemote }"
            />
            <span>{{ i18n.headerRefreshRemote }}</span>
          </button>
          <div class="gp-refresh-divider" />
          <button
            class="gp-refresh-item gp-refresh-item--all"
            :disabled="refreshingAll"
            @click="emit('refreshAll')"
          >
            <Icon
              icon="mdi:refresh-circle"
              height="12"
              :class="{ 'gp-spin': refreshingAll }"
            />
            <span>{{ i18n.refreshAll }}</span>
          </button>
        </div>
      </div>
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
            <span>{{ i18n.addProject }}</span>
          </button>
          <button
            class="gp-add-item"
            @click="emit('update:showAddMenu', false); emit('openScan')"
          >
            <Icon
              icon="mdi:file-find-outline"
              height="12"
            />
            <span>{{ i18n.importProject }}</span>
          </button>
        </div>
      </div>

          <div
      v-if="projectCount > 0"
      class="gp-header-search"
    >
      <Input
        :model-value="searchQuery"
        size="xsmall"
        :placeholder="searchPlaceholder"
        prefix-icon="search"
        clearable
        autocomplete="off"
        @update:model-value="emit('update:searchQuery', String($event ?? ''))"
      />
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import Input from "@/components/Input.vue"
import { PLATFORM_META } from "../types"

interface Props {
  i18n: Record<string, any>
  projectCount?: number
  currentView: "list" | "stats"
  refreshingAll?: boolean
  refreshingAllLocal?: boolean
  refreshingAllRemote?: boolean

  showPlatformMenu?: boolean
  showAddMenu?: boolean
  showRefreshMenu?: boolean
  searchQuery?: string
  searchPlaceholder?: string
}

withDefaults(defineProps<Props>(), {
  projectCount: 0,
  refreshingAll: false,
  refreshingAllLocal: false,
  refreshingAllRemote: false,

  showPlatformMenu: false,
  showAddMenu: false,
  showRefreshMenu: false,
  searchQuery: "",
  searchPlaceholder: "搜索项目...",
})

const emit = defineEmits<{
  "update:currentView": [value: "list" | "stats"]
  "update:showPlatformMenu": [value: boolean]
  "update:showAddMenu": [value: boolean]
  "update:showRefreshMenu": [value: boolean]
  "update:searchQuery": [value: string]
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
@use "@/index.scss" as *;
@use "../styles/variables" as *;
@use "../styles/PanelHeader.scss";
</style>
