<!-- gitPush 项目卡片顶栏（信息区 + 操作按钮区，数据经 useCardServices 注入） -->
<template>
  <div class="gp-card-top">
    <div class="gp-card-info">
      <div class="gp-card-name-row">
        <!-- 收藏星标（悬停提示："取消收藏"/"收藏置顶"） -->
        <button
          class="gp-star-btn"
          :class="{ active: project.starred }"
          :title="project.starred ? i18n.unstar : i18n.starPin"
          @click.stop="ops.toggleStar(project.id)"
        >
          <Icon
            :icon="project.starred ? 'mdi:star' : 'mdi:star-outline'"
            height="12"
          />
        </button>
        <!-- 项目名（含搜索命中高亮分段） -->
        <span class="gp-card-name"><template
          v-for="(seg, i) in nameSegments"
          :key="i"
        ><span
          v-if="seg.hit"
          class="gp-hl"
        >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></span>
        <!-- 归档角标："归档"（悬停："已归档"） -->
        <span
          v-if="project.archived"
          class="gp-archived-tag"
          :title="i18n.archivedTitle"
        >
          <Icon
            icon="mdi:archive-outline"
            height="12"
          />{{ i18n.archivedShort }}
        </span>
      </div>
      <!-- 项目路径行：路径 + 多设备路径角标（"已配置 {0} 个设备路径"）+ 活跃度（悬停："长时间未活动，建议归档"） -->
      <div
        class="gp-card-path"
        :title="project.path"
      >
        <Icon
          icon="mdi:folder-outline"
          height="11"
          class="gp-path-icon"
        />
        <span class="gp-path-text">{{ project.path }}</span>
        <span
          v-if="project.localPaths?.length"
          class="gp-multi-path-badge"
          :title="i18n.devicePathsCount.replace('{0}', String(project.localPaths.length + 1))"
        >+{{ project.localPaths.length }}{{ i18n.pathsSuffix }}</span>
        <span
          v-if="project.lastActivity"
          class="gp-activity"
          :class="`gp-act-${activityLevel(project.lastActivity)}`"
          :title="activityLevel(project.lastActivity) === 'dead' ? i18n.inactiveHint : ''"
        >
          <Icon
            icon="mdi:clock-outline"
            height="12"
          />
          <!-- 相对活动时间："刚刚 / N分钟前 / N天前…" -->
          {{ relativeTime(project.lastActivity, i18n) }}
        </span>
      </div>
      <!-- Markdown 文件标识（前 3 个直接展示，其余折叠为 "+N" 按钮，点击展开/收起） -->
      <div
        v-if="mdFiles.length"
        class="gp-md-files"
      >
        <MarkdownFileBadge
          v-for="f in visibleMdFiles"
          :key="f.name"
          :filename="f.name"
          :label="f.label"
          :variant="f.variant"
          :i18n="i18n"
          @select="ops.openMarkdownPreview(project, f.name)"
        />
        <!-- 折叠按钮（tooltip：展开/收起其余 Markdown 文件） -->
        <button
          v-if="hiddenMdCount > 0"
          class="gp-md-more"
          :class="{ expanded: mdExpanded }"
          :title="mdExpanded
            ? i18n.mdFilesCollapse
            : i18n.mdFilesExpand.replace('{0}', String(hiddenMdCount))"
          @click.stop="mdExpanded = !mdExpanded"
        >
          {{ mdExpanded ? `-${hiddenMdCount}` : `+${hiddenMdCount}` }}
        </button>
      </div>
      <!-- 分支标签（悬停："当前分支"/"切换到 {0}"） -->
      <div
        v-if="branches?.length"
        class="gp-branch-row"
      >
        <Icon
          icon="mdi:source-branch"
          height="12"
        />
        <button
          v-for="b in branches"
          :key="b.name"
          class="gp-branch-tag"
          :class="{ current: b.current }"
          :title="b.current ? i18n.currentBranch : i18n.switchToBranch.replace('{0}', b.name)"
          @click="ops.switchBranch(project.id, b.name)"
        >
          {{ b.name }}
          <Icon
            v-if="b.current"
            icon="mdi:check"
            height="12"
          />
        </button>
      </div>
      <!-- 备注 -->
      <div
        v-if="project.note"
        class="gp-card-note"
        :title="project.note"
      >
        <Icon
          icon="mdi:note-text-outline"
          height="12"
        />
        <span>{{ project.note }}</span>
      </div>
    </div>
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
  </div>
</template>

<script setup lang="ts">
// gitPush 项目卡片顶栏（信息区 + 操作区，共享数据与操作经 CARD_SERVICES_KEY 注入）
import type { BranchInfo, GitProject } from "../../types"
import type { MdFileEntry } from "../../composables/useMarkdownFiles"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import { PLATFORM_META } from "../../types"
import { activityLevel, highlightSegments, openLocalPath, openRepoWebUrl, relativeTime, resolveValidPath } from "../../utils"
import { useCardActions } from "../../composables/useCardActions"
import { useCardServices } from "../../composables/useCardServices"
import { useCardMenu } from "../../composables/useCardMenu"
import MarkdownFileBadge from "./MarkdownFileBadge.vue"

const props = defineProps<{
  project: GitProject
  /** 卡内自持分支列表（编排层 useCardData 派生传入） */
  branches: BranchInfo[]
  /** 卡内自持 Markdown 文件标识（编排层 useCardData 派生传入） */
  mdFiles: MdFileEntry[]
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
const searchQuery = shared.searchQuery

// 菜单开关（顶栏 platform/ide/refresh 与操作栏 pull/push 共用同一互斥状态）
const { openMenu, toggleMenu } = useCardMenu()

// 卡片本地动作（IDE 删除确认 / 复制链接）
const {
  confirmingDelName,
  handleCopyUrl,
} = useCardActions({ i18n })

/** 项目名搜索高亮分段（按当前 searchQuery 切分） */
const nameSegments = computed(() => highlightSegments(props.project.name, searchQuery.value))

// ── Markdown 徽章折叠（文件过多时默认只展示高优先级的前 3 个，其余折叠）──
/** 默认直接展示的徽章数量上限 */
const MD_VISIBLE_LIMIT = 3
/** 是否已展开全部 Markdown 徽章 */
const mdExpanded = ref(false)
/** 实际展示的徽章列表（折叠时仅前 N 个，mdFiles 已按 README→CLAUDE→其他 排序） */
const visibleMdFiles = computed(() =>
  mdExpanded.value ? props.mdFiles : props.mdFiles.slice(0, MD_VISIBLE_LIMIT),
)
/** 被折叠的 Markdown 文件数量（<=0 时不显示折叠按钮） */
const hiddenMdCount = computed(() => props.mdFiles.length - MD_VISIBLE_LIMIT)

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
@use "../../styles/CardHeader.scss";
</style>
