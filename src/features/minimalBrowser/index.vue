<!--
  极简浏览器 — 主面板：工具栏 + 网页 iframe + 收藏侧栏 + 设置弹窗 + 收藏命名/改名弹窗
-->
<template>
  <div class="mb-panel">
    <Toolbar
      :i18n="i18n"
      @toggle-sidebar="showSidebar = !showSidebar"
      @open-settings="showSettings = true"
      @toggle-favorite="handleToggleFavorite"
      @open-external="handleOpenExternal"
      @invalid-url="handleInvalidUrl"
    />

    <div class="mb-body">
      <FavoritesSidebar
        v-if="showSidebar"
        :i18n="i18n"
        @navigate="handleNavigate"
        @edit-name="openEditName"
        @delete-entry="handleDeleteEntry"
      />

      <div class="mb-content">
        <!-- 起始页：未导航且无主页时展示提示 -->
        <div
          v-if="!currentUrl"
          class="mb-start"
        >
          <IconWrapper
            name="minimalBrowser"
            :size="48"
          />
          <!-- 起始提示："输入网址开始浏览" -->
          <p class="mb-start-text">{{ i18n.noHomeConfigured }}</p>
        </div>

        <!-- 网页视图 -->
        <iframe
          v-show="currentUrl"
          ref="frameEl"
          class="mb-frame"
          referrerpolicy="no-referrer"
          allow="fullscreen"
          allowfullscreen
          @load="handleFrameLoad"
        ></iframe>

        <!-- 拖拽缩放置顶遮罩：拖动期间拦截指针事件，防止 iframe 吞掉拖拽 -->
        <div
          v-if="sidebarResizing"
          class="mb-resize-overlay"
        />
      </div>
    </div>

    <SettingsDialog
      v-if="showSettings"
      :i18n="i18n"
      @close="showSettings = false"
      @saved="handleSettingsSaved"
      @save-failed="handleSettingsSaveFailed"
    />

    <!-- 收藏命名 / 改名弹窗 -->
    <div
      v-if="showFavoriteDialog"
      class="mb-dialog-mask"
      @click.self="closeFavoriteDialog"
    >
      <div class="mb-dialog-panel">
        <div class="mb-dialog-header">
          <!-- 弹窗标题：收藏当前页 / 编辑名称 -->
          <span class="mb-dialog-title">{{ editingEntryId ? i18n.editName : i18n.saveFavoriteTitle }}</span>
        </div>
        <div class="mb-dialog-body">
          <label class="mb-dialog-label">
            <!-- 字段名："名称" -->
            {{ i18n.favoriteName }}
          </label>
          <input
            v-model="favoriteNameInput"
            class="mb-dialog-input"
            type="text"
            :placeholder="i18n.favoriteNamePlaceholder"
            @keydown.enter="handleSaveFavorite"
          >
        </div>
        <div class="mb-dialog-footer">
          <Button
            variant="ghost"
            size="small"
            @click="closeFavoriteDialog"
          >
            <!-- 按钮："取消" -->
            {{ i18n.cancel }}
          </Button>
          <Button
            variant="primary"
            size="small"
            @click="handleSaveFavorite"
          >
            <!-- 按钮："保存" -->
            {{ i18n.save }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import { showMessage } from "siyuan"
import type { WebsiteEntry } from "@/utils/sharedStorage/websiteStorage"
import {
  onMounted,
  ref,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { getElectronModules } from "@/utils/nodeModules"
import FavoritesSidebar from "./components/FavoritesSidebar.vue"
import SettingsDialog from "./components/SettingsDialog.vue"
import Toolbar from "./components/Toolbar.vue"
import {
  addFavorite,
  currentUrl,
  frameRef,
  hostnameOf,
  isFavorite,
  loadBrowserSettings,
  loadFavorites,
  loading,
  navigate,
  removeFavorite,
  renameFavorite,
  resolveHomeUrl,
  sidebarResizing,
  useBrowserState,
} from "./composables/useBrowserState"
import type { I18n } from "./types"

interface Props {
  i18n: I18n
  plugin: Plugin
}

const props = defineProps<Props>()

useBrowserState(props.plugin)

const showSidebar = ref(true)
const showSettings = ref(false)
const showFavoriteDialog = ref(false)
const favoriteNameInput = ref("")
/** 非空表示「改名」模式（值为条目 id），空表示「收藏」模式 */
const editingEntryId = ref<string | null>(null)
const frameEl = ref<HTMLIFrameElement | null>(null)
// iframe onload 时同步共享 frameRef（导航函数依赖）
watch(frameEl, (el) => {
  frameRef.value = el
}, { immediate: true })

onMounted(async () => {
  await Promise.all([loadFavorites(), loadBrowserSettings()])
  // 已配置主页时启动即加载，否则停留在收藏列表起始页
  const home = resolveHomeUrl()
  if (home) {
    navigate(home)
  }
})

// ==================== 导航 ====================

const handleNavigate = (url: string) => {
  if (!navigate(url)) {
    showMessage(props.i18n.invalidUrl, 3000, "error")
  }
}

const handleInvalidUrl = () => {
  showMessage(props.i18n.invalidUrl, 3000, "error")
}

const handleFrameLoad = () => {
  loading.value = false
  // 跨域页面无法读 title，以 hostname 兜底显示在收藏命名框中
  if (!favoriteNameInput.value) {
    favoriteNameInput.value = hostnameOf(currentUrl.value)
  }
}

// ==================== 收藏 ====================

const handleToggleFavorite = () => {
  if (!currentUrl.value) return
  const existing = isFavorite(currentUrl.value)
  if (existing) {
    removeFavorite(existing.id).then((ok) => {
      if (ok) {
        showMessage(props.i18n.favoriteRemoved, 2000, "info")
      }
    }).catch(() => {
      showMessage(props.i18n.saveFailed, 3000, "error")
    })
    return
  }
  // 新建收藏：预填名称（iframe 标题取不到时用 hostname）
  editingEntryId.value = null
  favoriteNameInput.value = hostnameOf(currentUrl.value)
  showFavoriteDialog.value = true
}

const openEditName = (entry: WebsiteEntry) => {
  editingEntryId.value = entry.id
  favoriteNameInput.value = entry.name
  showFavoriteDialog.value = true
}

const closeFavoriteDialog = () => {
  showFavoriteDialog.value = false
  editingEntryId.value = null
}

const handleSaveFavorite = async () => {
  const editing = editingEntryId.value
  try {
    if (editing) {
      // 改名模式
      const ok = await renameFavorite(editing, favoriteNameInput.value)
      if (ok) {
        closeFavoriteDialog()
        showMessage(props.i18n.saveSuccess, 2000, "info")
      }
      return
    }
    const url = currentUrl.value
    if (!url) return
    await addFavorite(favoriteNameInput.value, url)
    closeFavoriteDialog()
    showMessage(props.i18n.favoriteAdded, 2000, "info")
  } catch {
    showMessage(props.i18n.saveFailed, 3000, "error")
  }
}

const handleDeleteEntry = (id: string) => {
  // eslint-disable-next-line no-alert
  if (!window.confirm(props.i18n.confirmDelete)) return
  removeFavorite(id).then((ok) => {
    if (!ok) {
      showMessage(props.i18n.saveFailed, 3000, "error")
    }
  }).catch(() => {
    showMessage(props.i18n.saveFailed, 3000, "error")
  })
}

// ==================== 外部打开 ====================

const handleOpenExternal = () => {
  const url = currentUrl.value
  if (!url) return
  const electron = getElectronModules()
  if (electron) {
    void electron.shell.openExternal(url)
  } else {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

// ==================== 设置 ====================

const handleSettingsSaved = () => {
  showSettings.value = false
  showMessage(props.i18n.saveSuccess, 2000, "info")
}

const handleSettingsSaveFailed = () => {
  showMessage(props.i18n.saveFailed, 3000, "error")
}
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
