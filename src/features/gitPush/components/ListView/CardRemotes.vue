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
        v-if="r.badge"
        class="gp-status-badge"
        :variant="r.badge.variant"
        size="xsmall"
        :content="r.badge.label"
        :title="r.badge.title"
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
}>()

const { services, remoteStatusLoading } = useCardServices(() => props.project)
const { shared, derived, ops } = services
const i18n = shared.i18n

/** 已配置远程名的行（未配置的整项不显示，避免灰色图标噪音；状态每远程只查一次） */
const remoteRows = computed(() =>
  REMOTES
    .filter((r) => !!props.project[r.remoteProp])
    .map((r) => {
      const view = derived.remoteView(props.project.id, r.key)
      const kind = view.kind
      return {
        ...r,
        // 仅在有徽章文案时构造配色：无状态/已同步的远程不渲染徽章，
        // 因此不再需要 「kind 为空时给个 success」这种不可达兜底
        badge: kind && view.label
          ? {
              label: view.label,
              variant: REMOTE_SYNC_VARIANT[kind],
              title: kind === "behind" ? i18n.conflictWarn : undefined,
            }
          : null,
      }
    }),
)
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardRemotes.scss";
</style>
