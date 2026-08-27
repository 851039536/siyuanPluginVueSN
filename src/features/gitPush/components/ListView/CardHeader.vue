<!-- gitPush 项目卡片顶栏信息区（星标/名称/路径/md 徽章/分支/备注，操作按钮区委托 CardHeaderActions） -->
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
        <!-- 文件徽章（点击预览，tooltip："预览 <文件名>"） -->
        <button
          v-for="f in visibleMdFiles"
          :key="f.name"
          class="gp-md-badge"
          :class="`gp-md-badge--${f.variant}`"
          :title="i18n.previewFileTitle.replace('{0}', f.name)"
          @click.stop="ops.openMarkdownPreview(project, f.name)"
        >
          {{ getMdLabel(f.name, f.variant) }}
        </button>
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
    <!-- 操作按钮区（分类/平台链接/IDE/刷新/编辑/Git配置/删除，自包含 services/menu） -->
    <CardHeaderActions
      :project="project"
      :reload-log="reloadLog"
      :refresh-tags="refreshTags"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 项目卡片顶栏信息区（操作按钮区委托 CardHeaderActions，共享数据经 CARD_SERVICES_KEY 注入）
import type { BranchInfo, GitProject } from "../../types"
import { getMdLabel, type MdFileEntry } from "../../composables/useMarkdownFiles"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import { activityLevel, highlightSegments, relativeTime } from "../../utils"
import { useCardServices } from "../../composables/useCardServices"
import CardHeaderActions from "./CardHeaderActions.vue"

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

const { services } = useCardServices(() => props.project)
const { shared, ops } = services
const i18n = shared.i18n
const searchQuery = shared.searchQuery

/** 项目名搜索高亮分段（按当前 searchQuery 切分） */
const nameSegments = computed(() => highlightSegments(props.project.name, searchQuery.value))

// ── Markdown 徽章折叠（文件过多时默认只展示高优先级的前 3 个，其余折叠）──
/** 默认直接展示的徽章数量上限 */
const MD_VISIBLE_LIMIT = 3
/** 是否已展开全部 Markdown 徽章 */
const mdExpanded = ref(false)
/** 实际展示的徽章列表（折叠时仅前 N 个，mdFiles 已按 README→AGENTS→CLAUDE→CODEBUDDY→其他 排序） */
const visibleMdFiles = computed(() =>
  mdExpanded.value ? props.mdFiles : props.mdFiles.slice(0, MD_VISIBLE_LIMIT),
)
/** 被折叠的 Markdown 文件数量（<=0 时不显示折叠按钮） */
const hiddenMdCount = computed(() => props.mdFiles.length - MD_VISIBLE_LIMIT)
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardHeader.scss";
</style>
