<!-- gitPush 项目卡片远程仓库状态（远程列表 + 推送状态徽章，数据经 useCardServices 注入） -->
<template>
  <!-- 远程仓库状态 -->
  <div class="gp-remotes">
    <span class="gp-remotes-label">{{ i18n.remotesLabel }}</span>
    <Button
      class="gp-section-refresh"
      variant="ghost"
      size="xsmall"
      dense
      icon="refresh"
      :loading="remoteStatusLoading"
      :title="i18n.refreshRemoteStatus"
      @click.stop="ops.handleRefreshRemoteStatus(project.id)"
    />
    <!-- 当前分支名（原操作栏分支检查按钮的信息价值合并至此）。
         注：CardHeader 的分支行是懒加载的「可切换分支列表」，首屏通常为空，
         故分支名的首屏展示由此承担；分支行就绪后（branchRowVisible）由其统一承担，
         避免同一分支名两处并列。 -->
    <span
      v-if="pushStatus?.branch && !branchRowVisible"
      class="gp-remote-branch"
    >
      <Icon
        icon="mdi:source-branch"
        height="12"
      />
      {{ pushStatus.branch }}
    </span>
    <div
      v-for="r in remoteRows"
      :key="r.key"
      class="gp-remote-item active"
    >
      <Icon
        :icon="r.icon"
        height="12"
      />
      <span>{{ project[r.remoteProp] }}</span>
      <!-- 推送状态徽章（配色由共享 Tag 的 variant 承担）。
           behind 徽章悬停给出行动建议（原整行警告条已合并至此，title 经 Tag 根元素 attr 透传生效） -->
      <Tag
        v-if="r.label"
        class="gp-status-badge"
        :variant="r.variant"
        size="xsmall"
        :content="r.label"
        :title="r.title"
      />
    </div>
  </div>

</template>

<script setup lang="ts">
// gitPush 项目卡片远程状态区（已配置远程列表 + 状态徽章；behind 行动建议并入徽章悬停提示）
import type { GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { REMOTES, REMOTE_SYNC_VARIANT } from "../../types"
import { useCardServices } from "../../composables/useCardServices"
import Button from "@/components/Button.vue"
import Tag from "@/components/Tag.vue"

const props = defineProps<{
  project: GitProject
  /** 顶栏分支行是否已就绪（CardHeader 分支行渲染中）；就绪后远程区不再重复展示当前分支名 */
  branchRowVisible?: boolean
}>()

const { services, pushStatus, remoteStatusLoading } = useCardServices(() => props.project)
const { shared, derived, ops } = services
const i18n = shared.i18n

/** 已配置 URL 的远程行（未配置的整项不显示，避免灰色图标噪音；状态每远程只查一次） */
const remoteRows = computed(() =>
  REMOTES
    .filter((r) => !!props.project[r.remoteProp])
    .map((r) => {
      const view = derived.remoteView(props.project.id, r.key)
      return {
        ...r,
        ...view,
        variant: view.kind ? REMOTE_SYNC_VARIANT[view.kind] : "success",
        title: view.kind === "behind" ? i18n.conflictWarn : undefined,
      }
    }),
)
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardRemotes.scss";
</style>
