<!-- gitPush 项目卡片顶栏操作按钮区（平台链接/IDE/刷新/编辑/Git配置/删除，自包含 services/menu；分类调整已合并至编辑项目弹窗） -->
<template>
  <!-- 操作按钮区：平台链接/IDE/刷新/编辑/Git配置/删除（分类调整已合并至编辑项目弹窗） -->
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
    <!-- IDE 打开菜单（本地开关，与拉取/推送菜单同模式） -->
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
        <!-- 空态项："未检测到 IDE" -->
        <button
          v-if="detectedIdes.length === 0 && customIdes.length === 0"
          class="gp-ide-item gp-ide-item--none"
          role="menuitem"
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
          role="menuitem"
          @click="ops.handleOpenIde(projectPath(), ide); openMenu = null"
        >
          <Icon
            :icon="ide.icon"
            height="12"
          />
          <span>{{ ide.name }}</span>
        </button>
        <!-- 自定义 IDE：外层为 div[role=menuitem]（原 button 内嵌删除按钮属非法嵌套，且会吞掉键盘激活） -->
        <div
          v-for="custom in uniqueCustomIdes"
          :key="`custom-${custom.name}`"
          class="gp-ide-item gp-ide-item--custom"
          role="menuitem"
          tabindex="0"
          :title="custom.paths.join('\n')"
          @click="ops.handleOpenCustomIde(projectPath(), custom.name); openMenu = null"
          @keydown.enter.prevent="ops.handleOpenCustomIde(projectPath(), custom.name); openMenu = null"
          @keydown.space.prevent="ops.handleOpenCustomIde(projectPath(), custom.name); openMenu = null"
        >
          <Icon
            icon="mdi:application-brackets"
            height="12"
          />
          <span>{{ custom.name }}</span>
          <template v-if="confirmingDelName === custom.name">
            <!-- 二次确认：该名称下有多条候选路径时明确告知删除范围（按名称删除 = 删整组，不止当前这一行） -->
            <span class="gp-ide-del-confirm">{{ deleteConfirmText(custom.paths.length) }}</span>
            <button
              class="gp-ide-del-yes"
              @click.stop="ops.removeCustomIdeByName(custom.name); confirmingDelName = ''"
              @keydown.stop
            >
              {{ i18n.yes }}
            </button>
            <button
              class="gp-ide-del-no"
              @click.stop="confirmingDelName = ''"
              @keydown.stop
            >
              {{ i18n.no }}
            </button>
          </template>
          <button
            v-else
            class="gp-ide-item-del"
            :title="i18n.deleteCustomIde"
            @click.stop="confirmingDelName = custom.name"
            @keydown.stop
          >
            <Icon
              icon="mdi:delete-outline"
              height="12"
            />
          </button>
        </div>
        <div
          class="gp-ide-divider"
          role="separator"
        />
        <!-- 菜单项："管理 IDE..." -->
        <button
          class="gp-ide-item gp-ide-item--add"
          role="menuitem"
          @click.stop="ops.showIdeDialog(); openMenu = null"
        >
          <Icon
            icon="mdi:cog-outline"
            height="12"
          />
          <span>{{ i18n.manageIde }}</span>
        </button>
      </MenuPopover>
    </div>
    <!-- 刷新选项菜单（本地开关，与拉取/推送菜单同模式） -->
    <div class="gp-refresh-wrap gp-menu-wrap">
      <!-- 悬停提示："刷新选项" -->
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="refresh"
        :loading="isRefreshing"
        :title="i18n.refreshOptions"
        aria-haspopup="menu"
        :aria-expanded="openMenu === 'refresh'"
        @click.stop="toggleMenu('refresh')"
      />
      <MenuPopover
        v-if="openMenu === 'refresh'"
        class="gp-refresh-popover"
        :aria-label="i18n.refreshOptions"
      >
        <!-- 菜单项："刷新工作空间" -->
        <button
          class="gp-refresh-item"
          role="menuitem"
          @click="ops.handleRefreshWorkingTree(project.id); openMenu = null"
        >
          <Icon icon="mdi:file-tree" height="12" />
          <span>{{ i18n.refreshWorkingTree }}</span>
        </button>
        <!-- 菜单项："刷新提交日志"（日志已下沉卡片，直调卡内重载） -->
        <button
          class="gp-refresh-item"
          role="menuitem"
          @click="reloadLog(); openMenu = null"
        >
          <Icon icon="mdi:history" height="12" />
          <span>{{ i18n.refreshCommitLog }}</span>
        </button>
        <!-- 菜单项："刷新标签"（标签已下沉卡片，直调卡内重载） -->
        <button
          class="gp-refresh-item"
          role="menuitem"
          @click="refreshTags(); openMenu = null"
        >
          <Icon icon="mdi:tag-outline" height="12" />
          <span>{{ i18n.refreshTags }}</span>
        </button>
        <!-- 菜单项："刷新远程状态" -->
        <button
          class="gp-refresh-item"
          role="menuitem"
          @click="ops.handleRefreshRemoteStatus(project.id); openMenu = null"
        >
          <Icon icon="mdi:cloud-refresh-outline" height="12" />
          <span>{{ i18n.refreshRemoteStatus }}</span>
        </button>
        <div
          class="gp-refresh-divider"
          role="separator"
        />
        <!-- 菜单项："全部刷新" -->
        <button
          class="gp-refresh-item gp-refresh-item--all"
          role="menuitem"
          @click="ops.handleRefresh(project.id); openMenu = null"
        >
          <Icon icon="mdi:refresh-circle" height="12" />
          <span>{{ i18n.refreshAll }}</span>
        </button>
      </MenuPopover>
    </div>
    <!-- 悬停提示："编辑项目（标签/备注）" -->
    <Button
      variant="ghost"
      size="xsmall"
      dense
      icon="pencilOutline"
      :title="i18n.editProjectBtn"
      @click="ops.openEditDialog(project)"
    />
    <!-- 悬停提示："项目脚本（识别/运行）"（自动识别 package.json/.NET/脚本文件命令；有会话运行中显角标） -->
    <div class="gp-script-wrap">
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="scriptLauncher"
        :title="scriptRunning ? i18n.scriptRunnerBtnRunning : i18n.scriptRunnerBtn"
        @click="ops.openScriptRunnerDialog(project)"
      />
      <span
        v-if="scriptRunning"
        class="gp-script-dot"
      />
    </div>
    <!-- 悬停提示："查看项目 Git 配置" -->
    <Button
      variant="ghost"
      size="xsmall"
      dense
      icon="fileOutline"
      :title="i18n.viewProjectGitConfig"
      @click="ops.openProjectGitConfig(project.id)"
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
import { useScriptSessions } from "../../composables/useScriptSessions"
import Button from "@/components/Button.vue"
import MenuPopover from "../common/MenuPopover.vue"

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
const detectedIdes = shared.detectedIdes
const customIdes = shared.customIdes
const detectedTerminals = shared.detectedTerminals

// 菜单开关（顶栏 platform/ide/refresh 与操作栏 pull/push 共用同一互斥状态）
const { openMenu, toggleMenu } = useCardMenu()

// 脚本会话运行角标（会话表变更经 version 信号驱动）
const { hasRunning } = useScriptSessions()
const scriptRunning = computed(() => hasRunning(props.project.id))

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

/**
 * 删除确认文案：按名称删除会移除该 IDE 的全部候选路径，而菜单只显示一行。
 * 多路径时必须显式说明条数，否则用户以为只删当前这一条（实际是整组）。
 */
function deleteConfirmText(pathCount: number): string {
  return pathCount > 1
    ? i18n.deleteCustomIdeMultiConfirm.replace("{0}", String(pathCount))
    : i18n.confirmDeleteShort
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardHeaderActions.scss";
</style>
