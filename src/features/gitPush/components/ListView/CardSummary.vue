<!-- gitPush 手风琴模式卡片摘要行（收起态：整行可点 + 名称/分支/变更/同步状态/主推送） -->
<template>
  <!-- 整行点击展开（鼠标）；键盘走左侧名称按钮（Enter/Space 展开，↑/↓ 在行间移动） -->
  <div
    class="gp-summary"
    @click="expand"
  >
    <!-- 摘要主按钮：只承载箭头与项目名（Tag 等块级元素不能放进 button） -->
    <Button
      class="gp-summary-main"
      variant="ghost"
      text
      size="xsmall"
      dense
      :title="i18n.cardExpand"
      :aria-label="`${i18n.cardExpand} ${project.name}`"
      aria-expanded="false"
      @click.stop="expand"
      @keydown="onKeydown"
    >
      <!-- 展开指示箭头 -->
      <Icon
        icon="mdi:chevron-down"
        height="12"
        class="gp-summary-chevron"
      />
      <!-- 项目名（搜索命中高亮分段） -->
      <span
        class="gp-summary-name"
        :title="project.path"
      >
        <template
          v-for="(seg, i) in nameSegments"
          :key="i"
        ><span
          v-if="seg.hit"
          class="gp-hl"
        >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template>
      </span>
    </Button>
    <!-- 归档角标（文案："归档"） -->
    <Tag
      v-if="project.archived"
      size="xsmall"
      variant="contrast"
      fill
      :content="i18n.archivedShort"
      :title="i18n.archivedTitle"
    />
    <!-- 当前分支（tooltip："当前分支"） -->
    <span
      v-if="branchLabel"
      class="gp-summary-branch"
      :title="i18n.currentBranch"
    >
      <Icon
        icon="mdi:source-branch"
        height="11"
      />
      <span class="gp-summary-branch-text">{{ branchLabel }}</span>
    </span>
    <!-- 最近提交时间（只展示相对时间；提交消息会挤占项目名，完整时间见 tooltip） -->
    <span
      v-if="commitAge"
      class="gp-summary-commit"
      :title="commitTitle"
    >
      <Icon
        icon="mdi:clock-outline"
        height="11"
      />
      <span class="gp-summary-commit-age">{{ commitAge }}</span>
    </span>
    <!-- 待提交变更数（tooltip 拆分「已暂存 / 未暂存 / 未跟踪」） -->
    <Tag
      v-if="changesCount > 0"
      class="gp-summary-changes"
      size="xsmall"
      variant="warning"
      icon="fileDocumentMultipleOutline"
      :content="String(changesCount)"
      :title="changesTitle"
    />
    <!-- Stash 数（仅已缓存的卡片有值；>0 时提示） -->
    <Tag
      v-if="stashCount"
      size="xsmall"
      variant="info"
      icon="archiveOutline"
      :content="String(stashCount)"
      :title="i18n.cardTabStash"
    />
    <!-- 合并冲突提示（文案："检测到合并冲突"） -->
    <Tag
      v-if="hasConflicts"
      size="xsmall"
      variant="danger"
      fill
      :content="i18n.conflictDetected"
    />
    <!-- 各远程同步异常（仅领先 / 落后 / 分叉；正常同步留给展开态 CardRemotes） -->
    <span
      v-for="r in remoteRows"
      :key="r.key"
      class="gp-summary-remote"
      :title="`${r.platform} ${r.label}`"
    >
      <Icon
        :icon="r.icon"
        height="11"
      />
      <Tag
        size="xsmall"
        :variant="r.variant"
        :content="r.label"
      />
    </span>
    <span class="gp-summary-spacer" />
    <!-- 主操作：推送全部 / 推送中切换为取消 -->
    <CardPushAllButton :project="project" />
  </div>
</template>

<script setup lang="ts">
// gitPush 手风琴模式卡片摘要行（仅收起态渲染；展开后由 ProjectCard 渲染完整卡片）
import type { GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { REMOTES, REMOTE_SYNC_VARIANT } from "../../types"
import { highlightSegments, platformLabel, relativeTime } from "../../utils"
import { useCardAccordion } from "../../composables/useCardAccordion"
import { useCardServices } from "../../composables/useCardServices"
import Button from "@/components/Button.vue"
import Tag from "@/components/Tag.vue"
import CardPushAllButton from "./CardPushAllButton.vue"

const props = defineProps<{
  project: GitProject
  /** 最近提交时间（ISO；仅日志已缓存时传入，缺失则退回项目最后活动时间） */
  latestCommitDate?: string | null
  /** 已缓存的 Stash 数（>0 时展示） */
  stashCount?: number
}>()

const { services, pushStatus, workingTree, changesCount } = useCardServices(() => props.project)
const { shared, derived } = services
const i18n = shared.i18n
const { expand } = useCardAccordion(() => props.project.id)

/** 项目名搜索高亮分段（与展开态 CardHeader 同一口径） */
const nameSegments = computed(() => highlightSegments(props.project.name, shared.searchQuery.value))

/** 当前分支名（分支行未加载时 pushStatus.branch 仍可用） */
const branchLabel = computed(() => pushStatus.value?.branch || "")

/** 最近提交/活动时间（优先真实提交时间；都没有则不占版面） */
const commitIso = computed(() => props.latestCommitDate || props.project.lastActivity || "")
const commitAge = computed(() => (commitIso.value ? relativeTime(commitIso.value, i18n) : ""))
const commitTitle = computed(() => (commitIso.value ? new Date(commitIso.value).toLocaleString() : ""))

/** 变更数 tooltip：按三类拆分（为 0 的类别不列；缓存缺失时退回通用文案） */
const changesTitle = computed(() => {
  const wt = workingTree.value
  if (!wt) return i18n.cardTabChanges
  const parts: string[] = []
  if (wt.stagedCount > 0) parts.push(`${i18n.staged} ${wt.stagedCount}`)
  if (wt.unstagedCount > 0) parts.push(`${i18n.unstaged} ${wt.unstagedCount}`)
  if (wt.untrackedCount > 0) parts.push(`${i18n.untracked} ${wt.untrackedCount}`)
  return parts.join(" · ")
})

/** 是否存在合并冲突（porcelain 的 unmerged 状态，无需额外 git 调用） */
const hasConflicts = computed(() =>
  workingTree.value?.files.some((f) => f.status === "unmerged") ?? false,
)

/**
 * 远程同步异常（ahead / behind / diverged）。正常同步（synced）不占摘要版面 ——
 * 收起行的职责是「扫出需要动作的项目」，完整远程状态在展开态 CardRemotes 中展示。
 */
const remoteRows = computed(() =>
  REMOTES.flatMap((r) => {
    if (!props.project[r.remoteProp]) return []
    const view = derived.remoteView(props.project.id, r.key)
    const kind = view.kind
    if (!kind || kind === "synced") return []
    return [{
      key: r.key,
      icon: r.icon,
      platform: platformLabel(r.key),
      label: view.label,
      variant: REMOTE_SYNC_VARIANT[kind],
    }]
  }),
)

/**
 * ↑/↓ 在当前列表的摘要行之间移动焦点（Enter/Space 由原生 button 直接展开）。
 * 只在最近的 `.gp-list` 内查找，避免多窗口 / 独立页签之间互相串焦点。
 */
function onKeydown(e: KeyboardEvent) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
  const host = (e.currentTarget as HTMLElement).closest(".gp-list")
  const rows = Array.from(host?.querySelectorAll<HTMLElement>(".gp-summary-main") ?? [])
  const index = rows.indexOf(e.currentTarget as HTMLElement)
  const next = rows[index + (e.key === "ArrowDown" ? 1 : -1)]
  if (!next) return
  e.preventDefault()
  next.focus()
}
</script>

<style lang="scss">
@use "../../styles/CardSummary.scss";
</style>
