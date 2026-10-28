<!-- gitPush 手风琴模式卡片摘要行（收起态：名称/标记/分支/变更与同步状态/主推送；点击展开详情） -->
<template>
  <div
    class="gp-summary"
    @click="expand"
  >
    <!-- 展开按钮（键盘可达；tooltip："展开详情"） -->
    <Button
      class="gp-summary-expand"
      variant="ghost"
      text
      size="xsmall"
      dense
      icon="chevronDown"
      :title="i18n.cardExpand"
      aria-expanded="false"
      @click.stop="expand"
    />
    <!-- 项目名 -->
    <span
      class="gp-summary-name"
      :title="project.path"
    >{{ project.name }}</span>
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
      />{{ branchLabel }}
    </span>
    <!-- 待提交变更数（tooltip："变更"） -->
    <span
      v-if="changesCount > 0"
      class="gp-summary-metric"
      :title="i18n.cardTabChanges"
    >
      <Icon
        icon="mdi:file-document-multiple-outline"
        height="11"
      />{{ changesCount }}
    </span>
    <!-- 合并冲突提示（文案："检测到合并冲突"） -->
    <Tag
      v-if="hasConflicts"
      size="xsmall"
      variant="danger"
      fill
      :content="i18n.conflictDetected"
    />
    <!-- 各远程同步状态（仅展示已配置且状态已知的远程） -->
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
        v-if="r.label"
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
import { platformLabel } from "../../utils"
import { useCardAccordion } from "../../composables/useCardAccordion"
import { useCardServices } from "../../composables/useCardServices"
import Button from "@/components/Button.vue"
import Tag from "@/components/Tag.vue"
import CardPushAllButton from "./CardPushAllButton.vue"

const props = defineProps<{ project: GitProject }>()

const { services, pushStatus, workingTree } = useCardServices(() => props.project)
const { shared, derived } = services
const i18n = shared.i18n
const { expand } = useCardAccordion(() => props.project.id)

/** 当前分支名（分支行未加载时 pushStatus.branch 仍可用） */
const branchLabel = computed(() => pushStatus.value?.branch || "")

/** 待提交变更数（暂存 + 未暂存 + 未跟踪） */
const changesCount = computed(() => {
  const wt = workingTree.value
  return (wt?.stagedCount || 0) + (wt?.unstagedCount || 0) + (wt?.untrackedCount || 0)
})

/** 是否存在合并冲突（porcelain 的 unmerged 状态，无需额外 git 调用） */
const hasConflicts = computed(() =>
  workingTree.value?.files.some((f) => f.status === "unmerged") ?? false,
)

/** 已配置且状态已知的远程（kind 为空 = 尚未检测，摘要不展示以避免噪音） */
const remoteRows = computed(() =>
  REMOTES
    .filter((r) => !!props.project[r.remoteProp])
    .map((r) => {
      const view = derived.remoteView(props.project.id, r.key)
      return {
        ...r,
        ...view,
        platform: platformLabel(r.key),
        variant: view.kind ? REMOTE_SYNC_VARIANT[view.kind] : "success",
      }
    })
    .filter((r) => r.kind !== ""),
)
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardSummary.scss";
</style>
