<!-- gitPush 项目卡片顶栏操作按钮区（平台链接/打开项目/浏览文件/编辑/Git配置/删除，自包含 services/menu；分类调整已合并至编辑项目弹窗） -->
<template>
  <!-- 操作按钮区：平台链接/打开项目/浏览文件/编辑/Git配置/删除（分类调整已合并至编辑项目弹窗） -->
  <div class="gp-card-actions">
    <!-- 平台链接下拉菜单（本地开关，与 IDE/刷新菜单同模式） -->
    <div class="gp-link-wrap gp-menu-wrap">
      <!-- 悬停提示："平台链接"（图标 + 展开箭头，双图标走默认插槽以保留原有形态） -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        :title="i18n.platformLinks"
        aria-haspopup="menu"
        :aria-expanded="openMenu === 'platform'"
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
      </Button>
      <MenuPopover
        v-if="openMenu === 'platform'"
        class="gp-link-popover"
        :aria-label="i18n.platformLinks"
      >
        <!-- 空态项："未配置平台链接" -->
        <button
          v-if="platformLinks.length === 0"
          class="gp-link-item gp-link-item--none"
          role="menuitem"
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
          class="gp-link-item"
          role="menuitem"
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
      </MenuPopover>
    </div>
    <!-- 打开项目菜单（本地开关，与拉取/推送菜单同模式）：打开文件夹 / 终端 / 复制项目路径 -->
    <div class="gp-ide-wrap gp-menu-wrap">
      <!-- 悬停提示："打开项目"（图标 + 展开箭头，双图标走默认插槽以保留原有形态） -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        :title="i18n.openProject"
        aria-haspopup="menu"
        :aria-expanded="openMenu === 'ide'"
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
      </Button>
      <MenuPopover
        v-if="openMenu === 'ide'"
        class="gp-ide-popover"
        :aria-label="i18n.openProject"
      >
        <!-- 菜单项："打开文件夹" -->
        <button
          class="gp-ide-item"
          role="menuitem"
          @click="openLocalPath(projectPath()); openMenu = null"
        >
          <Icon
            icon="mdi:folder-open"
            height="12"
          />
          <span>{{ i18n.openFolder }}</span>
        </button>
        <!-- 终端菜单项组：每个探测到的内置终端一项，点击在项目目录打开（多设备路径经 resolveValidPath 实时解析） -->
        <button
          v-for="t in detectedTerminals"
          :key="`terminal-${t.name}`"
          class="gp-ide-item"
          role="menuitem"
          :title="i18n.openTerminalHint?.replace('{0}', t.name) ?? t.name"
          @click="ops.handleOpenTerminal(projectPath(), t); openMenu = null"
        >
          <Icon
            :icon="t.icon"
            height="12"
          />
          <span>{{ t.name }}</span>
        </button>
        <div
          class="gp-ide-divider"
          role="separator"
        />
        <!-- 菜单项："复制项目路径"（复制当前设备解析出的有效路径，便于在外部终端/工具中贴用） -->
        <button
          class="gp-ide-item"
          role="menuitem"
          :title="i18n.copyProjectPathHint"
          @click="handleCopyProjectPath(projectPath()); openMenu = null"
        >
          <Icon
            icon="mdi:content-copy"
            height="12"
          />
          <span>{{ i18n.copyProjectPath }}</span>
        </button>
      </MenuPopover>
    </div>
    <!-- 悬停提示："浏览工作区文件"（只读文件树弹窗：整库文件 + 类型预览 + 变更角标） -->
    <Button
      variant="ghost"
      size="xsmall"
      dense
      icon="workspaceFiles"
      :title="i18n.workspaceFilesButton"
      @click="openWorkspaceFiles"
    />
    <!-- 悬停提示："编辑项目（标签/备注）" -->
    <Button
      variant="ghost"
      size="xsmall"
      dense
      icon="pencilOutline"
      :title="i18n.editProjectBtn"
      @click="ops.openEditDialog(project)"
    />
    <!-- 悬停提示："查看项目 Git 配置" -->
    <Button
      variant="ghost"
      size="xsmall"
      dense
      icon="fileOutline"
      :title="i18n.viewProjectGitConfig"
      @click="ops.openProjectGitConfig(project.id)"
    />
    <!-- 悬停提示："Reflog 浏览器"（找回 reset / 变基后丢失的提交） -->
    <Button
      variant="ghost"
      size="xsmall"
      dense
      icon="history"
      :title="i18n.reflogOpen"
      @click="emit('openReflog')"
    />
    <!-- 危险操作分隔线：删除与常规操作分组 -->
    <span class="gp-actions-divider" />
    <!-- 悬停提示："删除"（移除项目；悬停变红由 .gp-btn-danger 提供） -->
    <Button
      class="gp-btn-danger"
      variant="ghost"
      size="xsmall"
      dense
      icon="deleteOutline"
      :title="i18n.delete"
      @click="ops.handleRemove(project)"
    />
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
import Button from "@/components/Button.vue"
import MenuPopover from "../common/MenuPopover.vue"

const props = defineProps<{
  project: GitProject
  /** 打开工作区文件浏览器（编排层持有弹窗状态） */
  openWorkspaceFiles: () => void
}>()

const emit = defineEmits<{
  /** 打开 Reflog 浏览器（弹窗由卡片编排层持有） */
  openReflog: []
}>()

const { services } = useCardServices(() => props.project)
const { shared, ops } = services
const i18n = shared.i18n
const detectedTerminals = shared.detectedTerminals

// 菜单开关（顶栏 platform/ide/refresh 与操作栏 pull/push 共用同一互斥状态）
const { openMenu, toggleMenu } = useCardMenu()

// 卡片本地动作（复制项目路径 / 复制链接）
const {
  handleCopyUrl,
  handleCopyProjectPath,
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
</script>

<style lang="scss">
@use "../../styles/CardHeaderActions.scss";
</style>
