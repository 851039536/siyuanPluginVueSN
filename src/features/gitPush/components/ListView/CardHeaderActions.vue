<!-- gitPush 项目卡片顶栏操作按钮区（分类/平台链接/IDE/刷新/编辑/Git配置/删除，自包含 services/menu） -->
<template>
  <!-- 操作按钮区：分类选择/平台链接/IDE/刷新/编辑/Git配置/删除 -->
  <div class="gp-card-actions">
    <!-- 分类下拉（悬停提示："移动分类"） -->
    <select
      class="gp-cat-select"
      :value="project.categoryId"
      :title="i18n.moveCategory"
      @change.stop="ops.moveProject(project.id, ($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="cat in categories"
        :key="cat.id"
        :value="cat.id"
        :selected="cat.id === project.categoryId"
      >
        {{ cat.name }}
      </option>
    </select>
    <!-- 平台链接下拉菜单（本地开关，与 IDE/刷新菜单同模式） -->
    <div class="gp-platform-wrap gp-menu-wrap">
      <!-- 悬停提示："平台链接" -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :title="i18n.platformLinks"
        @click.stop="toggleMenu('platform')"
      >
        <Icon
          icon="mdi:link-variant"
          height="12"
        />
        <Icon
          icon="mdi:unfold-more-horizontal"
          height="12"
          class="gp-caret-icon"
        />
      </button>
      <div
        v-if="openMenu === 'platform'"
        class="gp-platform-popover"
        @click.stop
      >
        <!-- 空态项："未配置平台链接" -->
        <button
          v-if="platformLinks.length === 0"
          class="gp-platform-item gp-platform-item--none"
          disabled
        >
          <Icon
            icon="mdi:link-off"
            height="12"
          />
          <span>{{ i18n.noPlatformLink }}</span>
        </button>
        <!-- 平台项（左键打开 / 右键复制链接），悬停："打开 {0}（右键复制链接）" -->
        <button
          v-for="pl in platformLinks"
          :key="pl.key"
          class="gp-platform-item"
          :title="i18n.openPlatformHint.replace('{0}', pl.label)"
          @click="openRepoWebUrl(pl.url); openMenu = null"
          @contextmenu.prevent="handleCopyUrl(pl.url)"
        >
          <Icon
            :icon="pl.icon"
            height="12"
          />
          <span>{{ pl.label }}</span>
        </button>
      </div>
    </div>
    <!-- IDE 打开菜单（本地开关，与拉取/推送菜单同模式） -->
    <div class="gp-ide-wrap gp-menu-wrap">
      <!-- 悬停提示："打开项目" -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :title="i18n.openProject"
        @click.stop="toggleMenu('ide')"
      >
        <Icon
          icon="mdi:folder-open"
          height="12"
        />
        <Icon
          icon="mdi:unfold-more-horizontal"
          height="12"
          class="gp-caret-icon"
        />
      </button>
      <div
        v-if="openMenu === 'ide'"
        class="gp-ide-popover"
        @click.stop
      >
        <!-- 菜单项："打开文件夹" -->
        <button
          class="gp-ide-item"
          @click="openLocalPath(projectPath()); openMenu = null"
        >
          <Icon
            icon="mdi:folder-open"
            height="12"
          />
          <span>{{ i18n.openFolder }}</span>
        </button>
        <div class="gp-ide-divider" />
        <!-- 空态项："未检测到 IDE" -->
        <button
          v-if="detectedIdes.length === 0 && customIdes.length === 0"
          class="gp-ide-item gp-ide-item--none"
          disabled
        >
          <Icon
            icon="mdi:information-outline"
            height="12"
          />
          <span>{{ i18n.noIdeDetected }}</span>
        </button>
        <button
          v-for="ide in detectedIdes"
          :key="`detected-${ide.name}`"
          class="gp-ide-item"
          @click="ops.handleOpenIde(projectPath(), ide); openMenu = null"
        >
          <Icon
            :icon="ide.icon"
            height="12"
          />
          <span>{{ ide.name }}</span>
        </button>
        <button
          v-for="custom in uniqueCustomIdes"
          :key="`custom-${custom.name}`"
          class="gp-ide-item gp-ide-item--custom"
          :title="custom.paths.join('\n')"
          @click="ops.handleOpenCustomIde(projectPath(), custom.name); openMenu = null"
        >
          <Icon
            icon="mdi:application-brackets"
            height="12"
          />
          <span>{{ custom.name }}</span>
          <template v-if="confirmingDelName === custom.name">
            <!-- 二次确认："确认删除?" -->
            <span class="gp-ide-del-confirm">{{ i18n.confirmDeleteShort }}</span>
            <button
              class="gp-ide-del-yes"
              @click.stop="ops.removeCustomIdeByName(custom.name); confirmingDelName = ''"
            >
              {{ i18n.yes }}
            </button>
            <button
              class="gp-ide-del-no"
              @click.stop="confirmingDelName = ''"
            >
              {{ i18n.no }}
            </button>
          </template>
          <button
            v-else
            class="gp-ide-item-del"
            :title="i18n.deleteCustomIde"
            @click.stop="confirmingDelName = custom.name"
          >
            <Icon
              icon="mdi:delete-outline"
              height="12"
            />
          </button>
        </button>
        <div class="gp-ide-divider" />
        <!-- 菜单项："管理 IDE..." -->
        <button
          class="gp-ide-item gp-ide-item--add"
          @click.stop="ops.showIdeDialog(); openMenu = null"
        >
          <Icon
            icon="mdi:cog-outline"
            height="12"
          />
          <span>{{ i18n.manageIde }}</span>
        </button>
      </div>
    </div>
    <!-- 刷新选项菜单（本地开关，与拉取/推送菜单同模式） -->
    <div class="gp-refresh-wrap gp-menu-wrap">
      <!-- 悬停提示："刷新选项" -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :title="i18n.refreshOptions"
        @click.stop="toggleMenu('refresh')"
      >
        <Icon
          :icon="isRefreshing ? 'mdi:loading' : 'mdi:refresh'"
          height="12"
          :class="{ 'gp-spin': isRefreshing }"
        />
      </button>
      <div
        v-if="openMenu === 'refresh'"
        class="gp-refresh-popover"
        @click.stop
      >
        <!-- 菜单项："刷新工作空间" -->
        <button class="gp-refresh-item" @click="ops.handleRefreshWorkingTree(project.id); openMenu = null">
          <Icon icon="mdi:file-tree" height="12" />
          <span>{{ i18n.refreshWorkingTree }}</span>
        </button>
        <!-- 菜单项："刷新提交日志"（日志已下沉卡片，直调卡内重载） -->
        <button class="gp-refresh-item" @click="reloadLog(); openMenu = null">
          <Icon icon="mdi:history" height="12" />
          <span>{{ i18n.refreshCommitLog }}</span>
        </button>
        <!-- 菜单项："刷新标签"（标签已下沉卡片，直调卡内重载） -->
        <button class="gp-refresh-item" @click="refreshTags(); openMenu = null">
          <Icon icon="mdi:tag-outline" height="12" />
          <span>{{ i18n.refreshTags }}</span>
        </button>
        <!-- 菜单项："刷新远程状态" -->
        <button class="gp-refresh-item" @click="ops.handleRefreshRemoteStatus(project.id); openMenu = null">
          <Icon icon="mdi:cloud-refresh-outline" height="12" />
          <span>{{ i18n.refreshRemoteStatus }}</span>
        </button>
        <div class="gp-refresh-divider" />
        <!-- 菜单项："全部刷新" -->
        <button class="gp-refresh-item gp-refresh-item--all" @click="ops.handleRefresh(project.id); openMenu = null">
          <Icon icon="mdi:refresh-circle" height="12" />
          <span>{{ i18n.refreshAll }}</span>
        </button>
      </div>
    </div>
    <!-- 悬停提示："编辑项目（标签/备注）" -->
    <button
      class="vp-btn vp-btn--ghost vp-btn--sm"
      :title="i18n.editProjectBtn"
      @click="ops.openEditDialog(project)"
    >
      <Icon
        icon="mdi:pencil-outline"
        height="12"
      />
    </button>
    <!-- 悬停提示："查看项目 Git 配置" -->
    <button
      class="vp-btn vp-btn--ghost vp-btn--sm"
      :title="i18n.viewProjectGitConfig"
      @click="ops.openProjectGitConfig(project.id)"
    >
      <Icon
        icon="mdi:file-document-outline"
        height="12"
      />
    </button>
    <!-- 危险操作分隔线：删除与常规操作分组 -->
    <span class="gp-actions-divider" />
    <!-- 悬停提示："删除"（移除项目） -->
    <button
      class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
      :title="i18n.delete"
      @click="ops.handleRemove(project)"
    >
      <Icon
        icon="mdi:delete-outline"
        height="12"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
// gitPush 项目卡片顶栏操作按钮区（自包含 useCardServices/useCardMenu，父仅传 project 与卡内刷新回调）
import type { GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { PLATFORM_META } from "../../types"
import { openLocalPath, openRepoWebUrl, resolveValidPath } from "../../utils"
import { useCardActions } from "../../composables/useCardActions"
import { useCardServices } from "../../composables/useCardServices"
import { useCardMenu } from "../../composables/useCardMenu"

const props = defineProps<{
  project: GitProject
  /** 刷新菜单"刷新提交日志"（卡内重载，编排层传入） */
  reloadLog: (count?: number | "all") => Promise<void>
  /** 刷新菜单"刷新标签"（卡内重载，编排层传入） */
  refreshTags: () => Promise<void>
}>()

const { services, isRefreshing } = useCardServices(() => props.project)
const { shared, ops } = services
const i18n = shared.i18n
const categories = shared.categories
const detectedIdes = shared.detectedIdes
const customIdes = shared.customIdes

// 菜单开关（顶栏 platform/ide/refresh 与操作栏 pull/push 共用同一互斥状态）
const { openMenu, toggleMenu } = useCardMenu()

// 卡片本地动作（IDE 删除确认 / 复制链接）
const {
  confirmingDelName,
  handleCopyUrl,
} = useCardActions({ i18n })

/** 当前项目有效路径（多设备路径解析，点击时实时检测磁盘存在性，不用 computed 缓存） */
function projectPath(): string {
  return resolveValidPath(props.project)
}

/** 已配置 URL 的平台链接列表（平台下拉菜单数据源） */
const platformLinks = computed(() =>
  PLATFORM_META
    .filter((pm) => props.project[pm.urlProp])
    .map((pm) => ({ key: pm.key, icon: pm.icon, label: pm.label, url: props.project[pm.urlProp]! })),
)

/** 自定义 IDE 按名称去重（同名多条 = 多台电脑的候选路径，菜单只展示一项，tooltip 列出全部路径） */
const uniqueCustomIdes = computed(() => {
  const map = new Map<string, string[]>()
  for (const c of customIdes.value) {
    const paths = map.get(c.name)
    if (paths) paths.push(c.path)
    else map.set(c.name, [c.path])
  }
  return [...map.entries()].map(([name, paths]) => ({ name, paths }))
})
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardHeaderActions.scss";
</style>
